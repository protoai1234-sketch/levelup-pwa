import { useState, useEffect } from 'react';
import {
  getTotalXP, getTodayPoints, getStreak, getGoals, getAllActionsForGoals,
  getCompletionsInRange, getPointsByDate, getLogsInRange, getHabits,
} from '../utils/storage';
import { getLevel, getLevelName, getProgressToNextLevel, getXPToNextLevel } from '../utils/points';
import { todayString, getWeekDates, addDays, getDatesInRange, isActiveDay, isVacationDay } from '../utils/dateHelpers';
import { TRAITS, TRAIT_COLORS } from '../constants';
import { fetchLeaderboard, syncLeaderboard, calcConsistencyScore } from '../utils/supabase';
import { getUser } from '../utils/storage';

export default function StatsScreen({ onSettings }) {
  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
    const today = todayString();
    const thirtyDaysAgo = addDays(today, -29);

    const totalXP = getTotalXP();
    const todayPts = getTodayPoints(today);
    const streak = getStreak(today);
    const goals = getGoals();
    const habits = getHabits();
    const goalIds = goals.map(g => g.id);
    const allActions = getAllActionsForGoals(goalIds);
    const completionsIn30 = getCompletionsInRange(thirtyDaysAgo, today);
    const logsIn30 = getLogsInRange(thirtyDaysAgo, today);
    const weekDates = getWeekDates(today);
    const weekPoints = getPointsByDate(weekDates.map(d => d.date));

    const actionMap = {};
    allActions.forEach(a => {
      if (!actionMap[a.goalId]) actionMap[a.goalId] = [];
      actionMap[a.goalId].push(a);
    });

    // 30-day completion rate
    let expectedDays = 0, completedDays = 0;
    const range30 = getDatesInRange(thirtyDaysAgo, today);
    const byGoalDate = {};
    completionsIn30.forEach(c => {
      const key = `${c.goalId}__${c.completedDate}`;
      if (!byGoalDate[key]) byGoalDate[key] = new Set();
      byGoalDate[key].add(c.actionId);
    });
    for (const goal of goals) {
      const activeDays   = Array.isArray(goal.activeDays)   ? goal.activeDays   : JSON.parse(goal.activeDays   || '[]');
      const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');
      const acts = actionMap[goal.id] || [];
      if (!acts.length) continue;
      const actionIds = acts.map(a => a.id);
      range30.forEach(d => {
        if (d < goal.startDate || d > goal.endDate) return;
        if (!isActiveDay(d, activeDays) || isVacationDay(d, vacationDays)) return;
        expectedDays++;
        const done = byGoalDate[`${goal.id}__${d}`];
        if (done && actionIds.every(id => done.has(id))) completedDays++;
      });
    }
    const completionRate = expectedDays > 0 ? Math.round((completedDays / expectedDays) * 100) : 0;
    const activeGoalsCount = goals.filter(g => g.endDate >= today && g.startDate <= today).length;

    // Trait data
    const habitMap = {};
    habits.forEach(h => { habitMap[h.id] = h; });
    const goalMap = {};
    goals.forEach(g => { goalMap[g.id] = g; });
    const traitEarned = {};
    const traitMax = {};

    logsIn30.forEach(log => {
      if (log.points <= 0) return;
      let logTraits = [];
      if (log.sourceType === 'action') {
        const action = allActions.find(a => a.id === log.sourceId);
        if (action) { const g = goalMap[action.goalId]; if (g) logTraits = Array.isArray(g.traits) ? g.traits : JSON.parse(g.traits || '[]'); }
      } else if (log.sourceType === 'habit') {
        const h = habitMap[log.sourceId];
        if (h) logTraits = Array.isArray(h.traits) ? h.traits : JSON.parse(h.traits || '[]');
      }
      logTraits.forEach(t => { traitEarned[t] = (traitEarned[t] || 0) + log.points; });
    });
    for (const goal of goals) {
      const gTraits = Array.isArray(goal.traits) ? goal.traits : JSON.parse(goal.traits || '[]');
      if (!gTraits.length) continue;
      const acts = actionMap[goal.id] || [];
      if (!acts.length) continue;
      const activeDays   = Array.isArray(goal.activeDays)   ? goal.activeDays   : JSON.parse(goal.activeDays   || '[]');
      const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');
      const maxPtsPerDay = acts.reduce((s, a) => s + a.pointValue, 0);
      range30.forEach(d => {
        if (d < goal.startDate || d > goal.endDate) return;
        if (!isActiveDay(d, activeDays) || isVacationDay(d, vacationDays)) return;
        gTraits.forEach(t => { traitMax[t] = (traitMax[t] || 0) + maxPtsPerDay; });
      });
    }
    habits.filter(h => h.type === 'good').forEach(h => {
      const hTraits = Array.isArray(h.traits) ? h.traits : JSON.parse(h.traits || '[]');
      hTraits.forEach(t => { traitMax[t] = (traitMax[t] || 0) + h.pointValue * 30; });
    });
    const usedTraits = TRAITS.filter(t => traitMax[t] > 0 || traitEarned[t] > 0);

    setData({ totalXP, todayPts, streak, activeGoalsCount, completionRate, weekDates, weekPoints, today, usedTraits, traitEarned, traitMax });

    // Sync leaderboard
    const user = getUser();
    if (user?.userId && user?.displayName) {
      const score = calcConsistencyScore(goals, allActions, completionsIn30, today);
      syncLeaderboard(user.userId, user.displayName, score);
    }

    setLbLoading(true);
    try {
      const lb = await fetchLeaderboard();
      setLeaderboard(lb);
    } catch (_) {}
    setLbLoading(false);
    } catch (e) {
      console.warn('Stats load error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) return <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>;

  const level = getLevel(data.totalXP);
  const levelName = getLevelName(level);
  const levelPct = getProgressToNextLevel(data.totalXP);
  const xpToNext = getXPToNextLevel(data.totalXP);
  const maxBar = Math.max(...data.weekDates.map(d => data.weekPoints[d.date] || 0), 1);
  const user = getUser();

  return (
    <div className="flex flex-col h-full">
      {/* Header with settings */}
      <div className="flex items-center justify-end px-4 py-2 bg-card border-b border-border flex-shrink-0">
        <button onClick={onSettings} className="text-textSecondary text-2xl w-10 h-10 flex items-center justify-center">⚙️</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8">
          {/* XP Card */}
          <div className="bg-primary rounded-2xl p-5 mb-3">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[22px] font-black text-white mb-0.5">{levelName}</div>
                <div className="text-[13px] text-white/70 font-semibold">Level {level}</div>
              </div>
              <div className="bg-white/20 rounded-full px-3 py-1.5">
                <span className="text-white font-black text-[15px]">{data.totalXP.toLocaleString()} XP</span>
              </div>
            </div>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-white rounded-full" style={{ width: `${Math.round(levelPct * 100)}%` }} />
            </div>
            <div className="text-white/75 text-[12px] font-semibold">{xpToNext} XP to Level {level + 1}</div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {[
              { icon: '🔥', value: `${data.streak} days`, label: 'Current Streak' },
              { icon: '📈', value: `${data.completionRate}%`, label: '30-Day Rate' },
              { icon: '🎯', value: String(data.activeGoalsCount), label: 'Active Goals' },
              { icon: '⭐', value: `+${data.todayPts}`, label: 'Points Today' },
            ].map(tile => (
              <div key={tile.label} className="card text-center py-4">
                <div className="text-2xl mb-1.5">{tile.icon}</div>
                <div className="text-[20px] font-black text-textPrimary">{tile.value}</div>
                <div className="text-[11px] font-semibold text-textSecondary mt-0.5">{tile.label}</div>
              </div>
            ))}
          </div>

          {/* Week bar chart */}
          <div className="card mb-3">
            <div className="section-label">This Week</div>
            <div className="flex items-end justify-between h-[130px]">
              {data.weekDates.map(d => {
                const pts = data.weekPoints[d.date] || 0;
                const barH = pts > 0 ? Math.max((pts / maxBar) * 100, 6) : 2;
                const isToday = d.date === data.today;
                const isFuture = d.date > data.today;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] text-textMuted mb-1">{pts > 0 ? pts : ''}</span>
                    <div className="flex-1 w-full flex items-end justify-center px-1">
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${barH}px`,
                          backgroundColor: isFuture ? 'transparent' : isToday ? '#185FA5' : pts === 0 ? '#3A3A3C' : '#3A3A3C',
                          minHeight: 2,
                        }}
                      />
                    </div>
                    <span className={`text-[11px] font-semibold mt-1.5 ${isToday ? 'text-primary' : 'text-textSecondary'}`}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trait progress */}
          {data.usedTraits.length > 0 && (
            <div className="card mb-3">
              <div className="section-label">Trait Progress (30 days)</div>
              {data.usedTraits.map(trait => {
                const earned = data.traitEarned[trait] || 0;
                const max = data.traitMax[trait] || 1;
                const pct = Math.min(Math.round((earned / max) * 100), 100);
                const color = TRAIT_COLORS[trait];
                return (
                  <div key={trait} className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[14px] font-semibold text-textPrimary">{trait}</span>
                      <span className="text-[14px] font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Leaderboard */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="section-label !mb-0">Leaderboard</div>
              <button onClick={loadStats} className="text-primary text-[12px] font-semibold">Refresh</button>
            </div>
            {lbLoading ? (
              <div className="flex justify-center py-4"><div className="spinner" /></div>
            ) : leaderboard.length === 0 ? (
              <p className="text-textMuted text-center italic text-[14px] py-4">No data yet. Come back once friends join!</p>
            ) : leaderboard.map((row, i) => {
              const isMe = user?.userId === row.user_id;
              return (
                <div key={row.user_id} className={`flex items-center gap-3 py-2.5 ${i < leaderboard.length - 1 ? 'border-b border-border' : ''} ${isMe ? 'bg-primary/10 -mx-4 px-4 rounded-lg' : ''}`}>
                  <span className={`text-[15px] font-black w-6 text-center flex-shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-textMuted'}`}>
                    {i + 1}
                  </span>
                  <span className={`flex-1 text-[15px] font-semibold ${isMe ? 'text-primary' : 'text-textPrimary'}`}>
                    {row.display_name}{isMe ? ' (you)' : ''}
                  </span>
                  <span className={`text-[14px] font-bold ${isMe ? 'text-primary' : 'text-textSecondary'}`}>
                    {Math.round(row.consistency_score)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
