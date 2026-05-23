import { getGoals, getActionsForGoal, getPlannerItemsForSource, insertPlannerItem } from './storage';
import { isActiveDay, isVacationDay } from './dateHelpers';

export async function autoPopulatePlannerForDate(date) {
  const dateDow = new Date(date + 'T12:00:00').getDay();
  let goals;
  try {
    goals = await getGoals();
  } catch {
    return; // not authenticated yet
  }

  for (const goal of goals) {
    if (date < goal.startDate) continue;
    if (goal.endDate && date > goal.endDate) continue;

    const activeDays   = Array.isArray(goal.activeDays)   ? goal.activeDays   : [];
    const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : [];

    if (!isActiveDay(date, activeDays) || isVacationDay(date, vacationDays)) continue;

    const actions = await getActionsForGoal(goal.id);
    for (const action of actions) {
      const dow = action.dayOfWeek;
      if (dow !== null && dow !== undefined && Number(dow) !== dateDow) continue;

      const existing = await getPlannerItemsForSource(date, 'action', action.id);
      if (existing.length > 0) continue;

      await insertPlannerItem({
        planDate:    date,
        label:       action.name,
        startTime:   action.notificationTime || '08:00',
        sourceType:  'action',
        sourceId:    action.id,
        pointValue:  action.pointValue,
        goalId:      goal.id,
        goalTitle:   goal.title,
        metricType:  action.metricType,
      });
    }
  }
}
