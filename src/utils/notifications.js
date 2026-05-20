import { savePushSubscription } from './supabase';
import { getUser } from './storage';

const SCHEDULE_KEY = 'levelup_notif_schedules';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Converts a base64url VAPID public key to a Uint8Array for PushManager.subscribe()
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function loadSchedules() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || []; } catch { return []; }
}
function saveSchedules(s) { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s)); }

// ── Permission ─────────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    subscribeToPush().then(syncSchedulesToServer).catch(() => {});
    return true;
  }
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    subscribeToPush().then(syncSchedulesToServer).catch(() => {});
    return true;
  }
  return false;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ── Push subscription ──────────────────────────────────────────────────────────

async function getPushRegistration() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try { return await navigator.serviceWorker.ready; } catch { return null; }
}

async function subscribeToPush() {
  if (!VAPID_PUBLIC_KEY) return null;
  const reg = await getPushRegistration();
  if (!reg) return null;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (e) {
    console.warn('Push subscribe failed:', e.message);
    return null;
  }
}

async function syncSchedulesToServer() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await getPushRegistration();
  if (!reg) return;
  let sub;
  try { sub = await reg.pushManager.getSubscription(); } catch { return; }
  if (!sub) return;
  const user = getUser();
  if (!user?.userId) return;
  const json = sub.toJSON();
  await savePushSubscription({
    user_id: user.userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    schedules: loadSchedules(),
  });
}

// ── Immediate notification (in-app / when tab is open) ────────────────────────

function showNow(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body });
    } else {
      new Notification(title, { body, icon: '/icons/icon-192.png' });
    }
  } catch (_) {}
}

// ── Action reminders (weekly, per active day) ──────────────────────────────────

export function scheduleActionNotifications(actionName, activeDays, notificationTime) {
  if (!notificationTime || !activeDays.length) return [];
  const schedules = loadSchedules();
  const ids = [];
  for (const jsDay of activeDays) {
    const id = `action-${actionName.replace(/\s+/g, '-')}-${jsDay}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    schedules.push({
      id,
      type: 'weekly',
      jsDay,
      time: notificationTime,
      title: 'Daily Action',
      body: `Time for: ${actionName}`,
    });
    ids.push(id);
  }
  saveSchedules(schedules);
  registerInAppScheduler();
  syncSchedulesToServer().catch(() => {});
  return ids;
}

export function cancelNotifications(ids = []) {
  if (!ids.length) return;
  const set = new Set(Array.isArray(ids) ? ids : JSON.parse(ids || '[]'));
  saveSchedules(loadSchedules().filter(s => !set.has(s.id)));
  syncSchedulesToServer().catch(() => {});
}

// ── Planner item notification (one-shot on a specific date+time) ───────────────

export function schedulePlannerItemNotification(label, planDate, notificationTime) {
  if (!notificationTime) return null;
  const [h, m] = notificationTime.split(':').map(Number);
  const triggerDate = new Date(planDate + 'T00:00:00');
  triggerDate.setHours(h, m, 0, 0);
  if (triggerDate <= new Date()) return null;
  const id = `planner-${planDate}-${Date.now()}`;
  const schedules = loadSchedules();
  schedules.push({ id, type: 'once', fireAt: triggerDate.toISOString(), title: 'Planner', body: label });
  saveSchedules(schedules);
  registerInAppScheduler();
  syncSchedulesToServer().catch(() => {});
  return id;
}

export function cancelPlannerNotification(id) {
  if (!id) return;
  saveSchedules(loadSchedules().filter(s => s.id !== id));
  syncSchedulesToServer().catch(() => {});
}

// ── In-app scheduler (30-second tick while the tab is open) ───────────────────

let _schedulerTimer = null;

export function registerInAppScheduler() {
  if (_schedulerTimer) return;
  _schedulerTimer = setInterval(checkSchedules, 30_000);
  checkSchedules();
}

function checkSchedules() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const nowDay = now.getDay();
  const nowHH = now.getHours();
  const nowMM = now.getMinutes();
  let changed = false;
  const schedules = loadSchedules();
  const remaining = [];
  for (const s of schedules) {
    if (s.type === 'once') {
      if (now >= new Date(s.fireAt)) { showNow(s.title, s.body); changed = true; continue; }
    } else if (s.type === 'weekly') {
      const [h, m] = s.time.split(':').map(Number);
      if (nowDay === s.jsDay && nowHH === h && nowMM === m) showNow(s.title, s.body);
    }
    remaining.push(s);
  }
  if (changed) saveSchedules(remaining);
}
