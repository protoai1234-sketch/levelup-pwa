import { createClient } from '@supabase/supabase-js';
import { getDatesInRange, isActiveDay, isVacationDay, addDays } from './dateHelpers';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log Supabase config on every page load so it's visible in the console
console.log('[Supabase] VITE_SUPABASE_URL:', url ? `${url.slice(0, 30)}…` : 'MISSING');
console.log('[Supabase] VITE_SUPABASE_ANON_KEY:', key ? `set (${key.length} chars)` : 'MISSING');

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null;
console.log('[Supabase] client:', supabase ? 'initialized' : 'NULL — both env vars required');

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

const CACHE_KEY = 'levelup_leaderboard_cache';

// consistency_score = ((completion_rate + on_track_rate) / 2) * 100
export function calcConsistencyScore(goals, allActions, completionsIn30, today) {
  const thirtyDaysAgo = addDays(today, -29);
  const range30 = getDatesInRange(thirtyDaysAgo, today);

  const actionMap = {};
  allActions.forEach(a => {
    if (!actionMap[a.goalId]) actionMap[a.goalId] = [];
    actionMap[a.goalId].push(a);
  });

  const byGoalDate = {};
  completionsIn30.forEach(c => {
    const key = `${c.goalId}__${c.completedDate}`;
    if (!byGoalDate[key]) byGoalDate[key] = new Set();
    byGoalDate[key].add(c.actionId);
  });

  let expectedDays = 0, completedDays = 0;
  const activeGoals = goals.filter(g => g.startDate <= today && g.endDate >= today);
  let onTrackGoals = 0;

  for (const goal of goals) {
    const activeDays   = Array.isArray(goal.activeDays)   ? goal.activeDays   : JSON.parse(goal.activeDays   || '[]');
    const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');
    const acts = actionMap[goal.id] || [];
    if (!acts.length) continue;
    const actionIds = acts.map(a => a.id);

    let goalExpected = 0, goalCompleted = 0;
    range30.forEach(d => {
      if (d < goal.startDate || d > goal.endDate) return;
      if (!isActiveDay(d, activeDays) || isVacationDay(d, vacationDays)) return;
      goalExpected++;
      const done = byGoalDate[`${goal.id}__${d}`];
      if (done && actionIds.every(id => done.has(id))) goalCompleted++;
    });
    expectedDays += goalExpected;
    completedDays += goalCompleted;

    // on-track: completion rate for this goal >= expected so far
    if (goalExpected > 0 && goalCompleted / goalExpected >= 0.95) onTrackGoals++;
  }

  const completionRate = expectedDays > 0 ? completedDays / expectedDays : 0;
  const onTrackRate    = activeGoals.length > 0 ? onTrackGoals / activeGoals.length : 0;
  return Math.round(((completionRate + onTrackRate) / 2) * 100);
}

// Returns { ok: true } or { ok: false, error: string }
export async function savePushSubscription({ user_id, endpoint, p256dh, auth, timezone, schedules }) {
  console.log('[Push] savePushSubscription() called');
  console.log('[Push] user_id:', user_id);
  console.log('[Push] endpoint:', endpoint ? endpoint.slice(0, 50) + '…' : 'undefined');
  console.log('[Push] p256dh:', p256dh ? `set (${p256dh.length} chars)` : 'undefined');
  console.log('[Push] auth:', auth ? `set (${auth.length} chars)` : 'undefined');
  console.log('[Push] timezone:', timezone);
  console.log('[Push] schedules count:', Array.isArray(schedules) ? schedules.length : typeof schedules);

  if (!supabase) {
    const err = `Supabase client is null — VITE_SUPABASE_URL: ${url ? 'set' : 'MISSING'}, VITE_SUPABASE_ANON_KEY: ${key ? 'set' : 'MISSING'}`;
    console.error('[Push]', err);
    return { ok: false, error: err };
  }

  try {
    console.log('[Push] Calling supabase.from(push_subscriptions).upsert() …');
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id, endpoint, p256dh, auth, timezone, schedules, updated_at: new Date().toISOString() },
        { onConflict: 'endpoint' }
      );

    if (error) {
      // Dump the full raw error object — sometimes message is empty but code/details aren't
      console.error('[Push] Supabase error raw:', JSON.stringify(error));
      const parts = [
        error.code    ? `code=${error.code}`         : null,
        error.message ? `msg="${error.message}"`     : null,
        error.details ? `details="${error.details}"` : null,
        error.hint    ? `hint="${error.hint}"`        : null,
      ].filter(Boolean);
      const err = parts.length ? parts.join(' | ') : `Unknown error: ${JSON.stringify(error)}`;
      console.error('[Push] savePushSubscription failed:', err);
      return { ok: false, error: err };
    }

    console.log('[Push] Upsert succeeded. Returned data:', JSON.stringify(data));
    return { ok: true };
  } catch (e) {
    console.error('[Push] savePushSubscription() threw:', e.name, e.message, e.stack);
    return { ok: false, error: `${e.name}: ${e.message}` };
  }
}

export async function syncLeaderboard(userId, displayName, score) {
  if (!supabase) return;
  try {
    await supabase.from('leaderboard').upsert(
      { user_id: userId, display_name: displayName, consistency_score: score, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch (e) {
    console.warn('Leaderboard sync failed:', e.message);
  }
}

export async function fetchLeaderboard() {
  if (!supabase) return getCachedLeaderboard();
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('user_id, display_name, consistency_score')
      .order('consistency_score', { ascending: false })
      .limit(20);
    if (error) throw error;
    if (data) { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); return data; }
  } catch (e) {
    console.warn('Leaderboard fetch failed:', e.message);
  }
  return getCachedLeaderboard();
}

function getCachedLeaderboard() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch { return []; }
}
