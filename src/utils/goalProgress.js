import { getDatesInRange, isActiveDay, isVacationDay, todayString } from './dateHelpers';
import { DAY_SHORT } from '../constants';

export function calculateGoalStats(goal, actions, completions) {
  const activeDays = Array.isArray(goal.activeDays) ? goal.activeDays : JSON.parse(goal.activeDays || '[]');
  const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');
  const today = todayString();

  const allActiveDates = getDatesInRange(goal.startDate, goal.endDate).filter(
    d => isActiveDay(d, activeDays) && !isVacationDay(d, vacationDays)
  );
  const elapsedActiveDates = allActiveDates.filter(d => d <= today);

  const actionIds = actions.map(a => a.id);
  const byDate = {};
  completions.forEach(c => {
    if (!byDate[c.completedDate]) byDate[c.completedDate] = new Set();
    byDate[c.completedDate].add(c.actionId);
  });

  let daysCompleted = 0;
  elapsedActiveDates.forEach(date => {
    const done = byDate[date];
    if (actionIds.length === 0) return;
    if (done && actionIds.every(id => done.has(id))) daysCompleted++;
  });

  const totalActiveDays = allActiveDates.length;
  const activeDaysElapsed = elapsedActiveDates.length;
  const expectedProgress = totalActiveDays > 0 ? activeDaysElapsed / totalActiveDays : 0;
  const actualProgress = totalActiveDays > 0 ? daysCompleted / totalActiveDays : 0;
  const behindPercent = Math.max(0, Math.round((expectedProgress - actualProgress) * 100));
  const isOnTrack = actualProgress >= expectedProgress - 0.05;

  return { totalActiveDays, activeDaysElapsed, daysCompleted, expectedProgress, actualProgress, isOnTrack, behindPercent };
}

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function formatActiveDays(activeDays) {
  const days = Array.isArray(activeDays) ? activeDays : JSON.parse(activeDays || '[]');
  return DISPLAY_ORDER.filter(d => days.includes(d)).map(d => DAY_SHORT[d]).join(' ');
}
