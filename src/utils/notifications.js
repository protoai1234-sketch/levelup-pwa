import { savePushSubscription } from './supabase';
import { getUser } from './storage';

const SCHEDULE_KEY = 'levelup_notif_schedules';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Log VAPID key presence immediately on module load so it shows up in every session
console.log('[Push] Module loaded. VAPID_PUBLIC_KEY:', VAPID_PUBLIC_KEY
  ? `${VAPID_PUBLIC_KEY.slice(0, 12)}… (${VAPID_PUBLIC_KEY.length} chars)`
  : 'MISSING — set VITE_VAPID_PUBLIC_KEY in Vercel env vars');

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
  if (!('Notification' in window)) {
    console.warn('[Push] Notification API not supported on this browser/device');
    return false;
  }
  if (Notification.permission === 'granted') {
    console.log('[Push] Permission already granted — ensuring subscription');
    await ensurePushSubscription();
    return true;
  }
  if (Notification.permission === 'denied') {
    console.warn('[Push] Permission denied by user');
    return false;
  }
  console.log('[Push] Requesting permission...');
  const result = await Notification.requestPermission();
  console.log('[Push] Permission result:', result);
  if (result === 'granted') {
    await ensurePushSubscription();
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
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] serviceWorker not in navigator');
    return null;
  }
  if (!('PushManager' in window)) {
    console.warn('[Push] PushManager not in window — add app to home screen (iOS 16.4+ required)');
    return null;
  }
  try {
    console.log('[Push] Waiting for service worker to become ready...');
    const reg = await navigator.serviceWorker.ready;
    console.log('[Push] Service worker ready. active state:', reg.active?.state ?? 'none');
    return reg;
  } catch (e) {
    console.error('[Push] serviceWorker.ready rejected:', e.message);
    return null;
  }
}

async function subscribeToPush() {
  console.log('[Push] subscribeToPush() called');

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VAPID_PUBLIC_KEY is undefined. Add VITE_VAPID_PUBLIC_KEY to Vercel environment variables and redeploy.');
    return null;
  }

  const reg = await getPushRegistration();
  if (!reg) return null;

  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      console.log('[Push] Reusing existing subscription:', existing.endpoint.slice(0, 50) + '…');
      return existing;
    }
    console.log('[Push] No existing subscription — calling pushManager.subscribe()');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    console.log('[Push] New subscription created:', sub.endpoint.slice(0, 50) + '…');
    return sub;
  } catch (e) {
    console.error('[Push] pushManager.subscribe() failed:', e.name, '—', e.message);
    return null;
  }
}

async function syncSchedulesToServer() {
  console.log('[Push] syncSchedulesToServer() called');

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('[Push] Notification permission not granted — skipping server sync');
    return;
  }

  const reg = await getPushRegistration();
  if (!reg) {
    console.error('[Push] No SW registration — cannot sync');
    return;
  }

  let sub;
  try {
    sub = await reg.pushManager.getSubscription();
  } catch (e) {
    console.error('[Push] getSubscription() threw:', e.message);
    return;
  }

  if (!sub) {
    console.warn('[Push] No active push subscription found — cannot sync to server');
    return;
  }

  const user = getUser();
  if (!user?.userId) {
    console.warn('[Push] No user ID found — skipping sync');
    return;
  }

  const json = sub.toJSON();
  const schedules = loadSchedules();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('[Push] Syncing to Supabase — user:', user.userId, '| timezone:', timezone, '| schedules:', schedules.length);

  await savePushSubscription({
    user_id: user.userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    timezone,
    schedules,
  });
}

// Called on every app load and after permission is granted.
// Idempotent — re-uses existing subscription if one exists.
export async function ensurePushSubscription() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  console.log('[Push] ensurePushSubscription() — running on app load');
  try {
    const sub = await subscribeToPush();
    if (sub) {
      await syncSchedulesToServer();
    } else {
      console.warn('[Push] subscribeToPush() returned null — subscription not synced');
    }
  } catch (e) {
    console.error('[Push] ensurePushSubscription() threw:', e.message);
  }
}

// Returns 'active' | 'inactive' | 'unsupported' | 'error' — used by SettingsScreen
export async function getPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'active' : 'inactive';
  } catch {
    return 'error';
  }
}

// ── Immediate notification (in-app, when tab is open) ─────────────────────────

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
  syncSchedulesToServer().catch(e => console.error('[Push] Post-schedule sync failed:', e.message));
  return ids;
}

export function cancelNotifications(ids = []) {
  if (!ids.length) return;
  const set = new Set(Array.isArray(ids) ? ids : JSON.parse(ids || '[]'));
  saveSchedules(loadSchedules().filter(s => !set.has(s.id)));
  syncSchedulesToServer().catch(e => console.error('[Push] Post-cancel sync failed:', e.message));
}

// ── Planner item notification (one-shot) ──────────────────────────────────────

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
  syncSchedulesToServer().catch(e => console.error('[Push] Post-planner sync failed:', e.message));
  return id;
}

export function cancelPlannerNotification(id) {
  if (!id) return;
  saveSchedules(loadSchedules().filter(s => s.id !== id));
  syncSchedulesToServer().catch(e => console.error('[Push] Post-cancel-planner sync failed:', e.message));
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
