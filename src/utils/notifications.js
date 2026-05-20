// Web Notifications API. Schedules stored in localStorage so the service
// worker can read them and fire even when the app tab isn't active.

const SCHEDULE_KEY = 'levelup_notif_schedules';

function loadSchedules() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || []; } catch { return []; }
}
function saveSchedules(s) { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s)); }

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Show a notification immediately (used for testing / alerts when app is open)
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

// Stores a schedule entry per active day. The service worker (or the in-app
// scheduler) reads these and fires them when due.
export function scheduleActionNotifications(actionName, activeDays, notificationTime) {
  if (!notificationTime || !activeDays.length) return [];
  const schedules = loadSchedules();
  const ids = [];
  for (const jsDay of activeDays) {
    const id = `action-${actionName.replace(/\s+/g, '-')}-${jsDay}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    schedules.push({
      id,
      type: 'weekly',
      jsDay,            // 0=Sun … 6=Sat
      time: notificationTime,
      title: 'Daily Action',
      body: `Time for: ${actionName}`,
    });
    ids.push(id);
  }
  saveSchedules(schedules);
  registerInAppScheduler();
  return ids;
}

export function cancelNotifications(ids = []) {
  if (!ids.length) return;
  const set = new Set(Array.isArray(ids) ? ids : JSON.parse(ids || '[]'));
  saveSchedules(loadSchedules().filter(s => !set.has(s.id)));
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
  schedules.push({
    id,
    type: 'once',
    fireAt: triggerDate.toISOString(),
    title: 'Planner',
    body: label,
  });
  saveSchedules(schedules);
  registerInAppScheduler();
  return id;
}

export function cancelPlannerNotification(id) {
  if (!id) return;
  saveSchedules(loadSchedules().filter(s => s.id !== id));
}

// ── In-app scheduler ──────────────────────────────────────────────────────────
// Runs a 30-second tick while the page is open. For background delivery
// the service worker reads the same schedule from localStorage (via postMessage).

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
      const fireAt = new Date(s.fireAt);
      if (now >= fireAt) {
        showNow(s.title, s.body);
        changed = true;
        continue;
      }
    } else if (s.type === 'weekly') {
      const [h, m] = s.time.split(':').map(Number);
      if (nowDay === s.jsDay && nowHH === h && nowMM === m) {
        showNow(s.title, s.body);
      }
    }
    remaining.push(s);
  }

  if (changed) saveSchedules(remaining);
}
