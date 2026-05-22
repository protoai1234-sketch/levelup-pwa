import { getGoals, getActionsForGoal, getPlannerItemsForSource, insertPlannerItem } from './storage';
import { isActiveDay, isVacationDay } from './dateHelpers';

// Runs on every app open for today's date (and when the Planner screen mounts).
// Creates planner items for all goal actions that should appear today.
// Never duplicates — checks for existing items before inserting.
export function autoPopulatePlannerForDate(date) {
  const dateDow = new Date(date + 'T12:00:00').getDay();
  const goals = getGoals();

  for (const goal of goals) {
    if (date < goal.startDate) continue;
    if (goal.endDate && date > goal.endDate) continue;

    const activeDays   = Array.isArray(goal.activeDays)   ? goal.activeDays   : JSON.parse(goal.activeDays   || '[]');
    const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');

    if (!isActiveDay(date, activeDays) || isVacationDay(date, vacationDays)) continue;

    const actions = getActionsForGoal(goal.id);
    for (const action of actions) {
      // dayOfWeek === null means every active day; a set value means that specific day only
      const dow = action.dayOfWeek;
      if (dow !== null && dow !== undefined && String(dow) !== 'null' && Number(dow) !== dateDow) continue;

      // Skip if a planner item already exists for this action on this date
      if (getPlannerItemsForSource(date, 'action', action.id).length > 0) continue;

      insertPlannerItem({
        planDate:         date,
        label:            action.name,
        startTime:        action.notificationTime || '08:00',
        sourceType:       'action',
        sourceId:         action.id,
        notificationId:   null,
        notificationTime: null,
        pointValue:       action.pointValue,
        goalId:           goal.id,
        goalTitle:        goal.title,
        metricType:       action.metricType,
      });
    }
  }
}
