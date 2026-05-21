import { createClient } from '@supabase/supabase-js';
import { getDatesInRange, isActiveDay, isVacationDay, addDays } from './dateHelpers';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

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
  if (!supabase) {
    const err = 'Supabase client is null — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel env vars';
    console.error('[Push]', err);
    return { ok: false, error: err };
  }
  try {
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id, endpoint, p256dh, auth, timezone, schedules, updated_at: new Date().toISOString() },
      { onConflict: 'endpoint' }
    );
    if (error) {
      const err = [error.message, error.details, error.hint].filter(Boolean).join(' — ');
      console.error('[Push] Supabase upsert error:', err);
      return { ok: false, error: err };
    }
    console.log('[Push] push_subscriptions row saved OK for user', user_id);
    return { ok: true };
  } catch (e) {
    console.error('[Push] savePushSubscription() threw:', e.message);
    return { ok: false, error: e.message };
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
