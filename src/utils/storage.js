import { supabase } from './supabase';

// Set by AuthContext after login; all storage functions require this to be set.
let _uid = null;
export function setUserId(id) { _uid = id; }
export function getUserId() { return _uid; }
function uid() {
  if (!_uid) throw new Error('Not authenticated');
  return _uid;
}

// ── Row mappers (snake_case DB → camelCase JS) ────────────────────────────────

function mapGoal(r) {
  return {
    id: r.id, title: r.title, description: r.description || '',
    goalType: r.goal_type || 'general', traits: r.traits || [],
    startDate: r.start_date || '', endDate: r.end_date || '',
    activeDays: r.active_days || [], vacationDays: r.vacation_days || [],
    weeklyPlan: r.weekly_plan || null,
    notificationsEnabled: r.notifications_enabled || 0,
    notificationTime: r.notification_time || null,
    notificationIds: r.notification_ids || [],
    createdAt: r.created_at,
  };
}

function mapAction(r) {
  return {
    id: r.id, goalId: r.goal_id, name: r.name,
    pointValue: r.point_value, notificationEnabled: r.notification_enabled || 0,
    notificationTime: r.notification_time || null,
    notificationIds: r.notification_ids || [],
    metricType: r.metric_type || 'checkbox',
    metricTarget: r.metric_target ?? null, metricUnit: r.metric_unit || null,
    dayOfWeek: r.day_of_week ?? null, createdAt: r.created_at,
  };
}

function mapCompletion(r) {
  return {
    id: r.id, actionId: r.action_id, goalId: r.goal_id,
    completedDate: r.completed_date, createdAt: r.created_at,
  };
}

function mapTodo(r) {
  return { id: r.id, label: r.label, createdAt: r.created_at };
}

function mapPlannerItem(r) {
  return {
    id: r.id, planDate: r.plan_date, label: r.label,
    startTime: r.start_time || null,
    sourceType: r.source_type || 'custom', sourceId: r.source_id || null,
    completed: Boolean(r.completed),
    notificationId: r.notification_id || null,
    notificationTime: r.notification_time || null,
    pointValue: r.point_value || 10,
    goalId: r.goal_id || null, goalTitle: r.goal_title || null,
    metricType: r.metric_type || 'checkbox', createdAt: r.created_at,
  };
}

function mapPointLog(r) {
  return {
    id: r.id, sourceType: r.source_type, sourceId: r.source_id,
    points: r.points, logDate: r.log_date, createdAt: r.created_at,
  };
}

function mapHabit(r) {
  return {
    id: r.id, name: r.name, type: r.type,
    pointValue: r.point_value, traits: r.traits || [], createdAt: r.created_at,
  };
}

function mapHabitLog(r) {
  return { id: r.id, habitId: r.habit_id, logDate: r.log_date, createdAt: r.created_at };
}

function mapProject(r) {
  return {
    id: r.id, goalId: r.goal_id, name: r.name,
    description: r.description || '', status: r.status || 'active',
    orderIndex: r.order_index || 0, createdAt: r.created_at,
  };
}

function mapProjectTask(r) {
  return {
    id: r.id, projectId: r.project_id, name: r.name,
    completed: r.completed || 0, dueDate: r.due_date || null,
    orderIndex: r.order_index || 0, createdAt: r.created_at,
  };
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function getGoals() {
  const { data, error } = await supabase.from('goals').select('*')
    .eq('user_id', uid()).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapGoal);
}

export async function getGoal(id) {
  const { data, error } = await supabase.from('goals').select('*')
    .eq('id', id).eq('user_id', uid()).maybeSingle();
  if (error || !data) return null;
  return mapGoal(data);
}

export async function insertGoal(g) {
  const { data, error } = await supabase.from('goals').insert({
    user_id: uid(), title: g.title, description: g.description || '',
    goal_type: g.goalType || 'general', traits: g.traits || [],
    start_date: g.startDate || null, end_date: g.endDate || null,
    active_days: g.activeDays || [], vacation_days: g.vacationDays || [],
    weekly_plan: g.weeklyPlan || {}, notifications_enabled: 0,
    notification_time: null, notification_ids: [],
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateGoal(id, g) {
  const u = {};
  if (g.title !== undefined) u.title = g.title;
  if (g.description !== undefined) u.description = g.description;
  if (g.goalType !== undefined) u.goal_type = g.goalType;
  if (g.traits !== undefined) u.traits = g.traits;
  if (g.startDate !== undefined) u.start_date = g.startDate;
  if (g.endDate !== undefined) u.end_date = g.endDate;
  if (g.activeDays !== undefined) u.active_days = g.activeDays;
  if (g.vacationDays !== undefined) u.vacation_days = g.vacationDays;
  if (g.weeklyPlan !== undefined) u.weekly_plan = g.weeklyPlan || {};
  const { error } = await supabase.from('goals').update(u)
    .eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

export async function deleteGoal(id) {
  // Delete in dependency order since FKs may not have CASCADE
  await supabase.from('action_completions').delete().eq('goal_id', id).eq('user_id', uid());
  await supabase.from('daily_actions').delete().eq('goal_id', id).eq('user_id', uid());
  await supabase.from('projects').delete().eq('goal_id', id).eq('user_id', uid());
  const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

// ── Daily Actions ──────────────────────────────────────────────────────────────

export async function getActionsForGoal(goalId) {
  const { data, error } = await supabase.from('daily_actions').select('*')
    .eq('goal_id', goalId).eq('user_id', uid()).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapAction);
}

export async function getActionById(id) {
  const { data, error } = await supabase.from('daily_actions').select('*')
    .eq('id', id).eq('user_id', uid()).maybeSingle();
  if (error || !data) return null;
  return mapAction(data);
}

export async function getAllActionsForGoals(goalIds) {
  if (!goalIds.length) return [];
  const { data, error } = await supabase.from('daily_actions').select('*')
    .in('goal_id', goalIds).eq('user_id', uid());
  if (error) throw error;
  return (data || []).map(mapAction);
}

export async function insertAction(a) {
  const { data, error } = await supabase.from('daily_actions').insert({
    user_id: uid(), goal_id: a.goalId, name: a.name,
    point_value: a.pointValue || 30,
    notification_enabled: a.notificationEnabled ? 1 : 0,
    notification_time: a.notificationTime || null,
    notification_ids: a.notificationIds || [],
    metric_type: a.metricType || 'checkbox',
    metric_target: a.metricTarget ?? null, metric_unit: a.metricUnit || null,
    day_of_week: a.dayOfWeek ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteActionsForGoal(goalId) {
  const { error } = await supabase.from('daily_actions').delete()
    .eq('goal_id', goalId).eq('user_id', uid());
  if (error) throw error;
}

// ── Action Completions ─────────────────────────────────────────────────────────

export async function getCompletionsForGoal(goalId) {
  const { data, error } = await supabase.from('action_completions').select('*')
    .eq('goal_id', goalId).eq('user_id', uid());
  if (error) throw error;
  return (data || []).map(mapCompletion);
}

export async function getCompletionsForGoals(goalIds) {
  if (!goalIds.length) return [];
  const { data, error } = await supabase.from('action_completions').select('*')
    .in('goal_id', goalIds).eq('user_id', uid());
  if (error) throw error;
  return (data || []).map(mapCompletion);
}

export async function getCompletionForActionDate(actionId, date) {
  const { data, error } = await supabase.from('action_completions').select('id')
    .eq('action_id', actionId).eq('completed_date', date).eq('user_id', uid()).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function insertCompletion(c) {
  const { data, error } = await supabase.from('action_completions').insert({
    user_id: uid(), action_id: c.actionId, goal_id: c.goalId,
    completed_date: c.completedDate,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteCompletion(actionId, date) {
  const { error } = await supabase.from('action_completions').delete()
    .eq('action_id', actionId).eq('completed_date', date).eq('user_id', uid());
  if (error) throw error;
}

export async function getCompletionsInRange(startDate, endDate) {
  const { data, error } = await supabase.from('action_completions').select('*')
    .eq('user_id', uid()).gte('completed_date', startDate).lte('completed_date', endDate);
  if (error) throw error;
  return (data || []).map(mapCompletion);
}

// ── Habits ─────────────────────────────────────────────────────────────────────

export async function getHabits() {
  const { data, error } = await supabase.from('habits').select('*')
    .eq('user_id', uid()).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapHabit);
}

export async function insertHabit(h) {
  const { data, error } = await supabase.from('habits').insert({
    user_id: uid(), name: h.name, type: h.type,
    point_value: h.pointValue || 20, traits: h.traits || [],
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteHabit(id) {
  await supabase.from('habit_logs').delete().eq('habit_id', id).eq('user_id', uid());
  const { error } = await supabase.from('habits').delete().eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

export async function getHabitLogsForDate(date) {
  const { data, error } = await supabase.from('habit_logs').select('*')
    .eq('user_id', uid()).eq('log_date', date);
  if (error) throw error;
  return (data || []).map(mapHabitLog);
}

export async function getHabitLogForDate(habitId, date) {
  const { data } = await supabase.from('habit_logs').select('*')
    .eq('habit_id', habitId).eq('log_date', date).eq('user_id', uid()).maybeSingle();
  return data ? mapHabitLog(data) : null;
}

export async function insertHabitLog(habitId, date) {
  const { data, error } = await supabase.from('habit_logs').insert({
    user_id: uid(), habit_id: habitId, log_date: date,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

// ── Todos ──────────────────────────────────────────────────────────────────────

export async function getTodos() {
  const { data, error } = await supabase.from('todos').select('*')
    .eq('user_id', uid()).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTodo);
}

export async function insertTodo(t) {
  const { data, error } = await supabase.from('todos').insert({
    user_id: uid(), label: t.label,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteTodo(id) {
  const { error } = await supabase.from('todos').delete()
    .eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

// ── Planner Items ──────────────────────────────────────────────────────────────

export async function getPlannerItemsForDate(date) {
  const { data, error } = await supabase.from('planner_items').select('*')
    .eq('user_id', uid()).eq('plan_date', date)
    .order('start_time', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map(mapPlannerItem);
}

export async function getPlannerItemsForSource(planDate, sourceType, sourceId) {
  const { data } = await supabase.from('planner_items').select('id')
    .eq('user_id', uid()).eq('plan_date', planDate)
    .eq('source_type', sourceType).eq('source_id', sourceId);
  return data || [];
}

export async function insertPlannerItem(item) {
  const { data, error } = await supabase.from('planner_items').insert({
    user_id: uid(), plan_date: item.planDate, label: item.label,
    start_time: item.startTime || null, source_type: item.sourceType || 'custom',
    source_id: item.sourceId || null, completed: 0,
    notification_id: item.notificationId || null,
    notification_time: item.notificationTime || null,
    point_value: item.pointValue || 10,
    goal_id: item.goalId || null, goal_title: item.goalTitle || null,
    metric_type: item.metricType || 'checkbox',
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updatePlannerItemCompleted(id, completed) {
  const { error } = await supabase.from('planner_items')
    .update({ completed: completed ? 1 : 0 }).eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

export async function deletePlannerItem(id) {
  const { error } = await supabase.from('planner_items').delete()
    .eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

export async function updatePlannerItemStartTime(id, startTime) {
  const { error } = await supabase.from('planner_items')
    .update({ start_time: startTime }).eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

// ── Point Log ──────────────────────────────────────────────────────────────────

export async function insertPointLog(entry) {
  const { error } = await supabase.from('point_log').insert({
    user_id: uid(), source_type: entry.sourceType,
    source_id: entry.sourceId || null,
    points: entry.points, log_date: entry.logDate,
  });
  if (error) throw error;
}

export async function deletePointLogEntry(sourceType, sourceId, date) {
  let q = supabase.from('point_log').delete()
    .eq('user_id', uid()).eq('source_type', sourceType).eq('log_date', date);
  if (sourceId) q = q.eq('source_id', sourceId);
  await q;
}

export async function getTodayPoints(date) {
  const { data } = await supabase.from('point_log').select('points')
    .eq('user_id', uid()).eq('log_date', date);
  return (data || []).reduce((s, e) => s + (e.points || 0), 0);
}

export async function getTotalXP() {
  const { data } = await supabase.from('point_log').select('points')
    .eq('user_id', uid()).gt('points', 0);
  return (data || []).reduce((s, e) => s + e.points, 0);
}

export async function getPointsByDate(dates) {
  if (!dates.length) return {};
  const { data } = await supabase.from('point_log').select('points, log_date')
    .eq('user_id', uid()).in('log_date', dates);
  const map = {};
  (data || []).forEach(e => { map[e.log_date] = (map[e.log_date] || 0) + e.points; });
  return map;
}

export async function getStreak(today) {
  const { data } = await supabase.from('point_log').select('log_date')
    .eq('user_id', uid()).gt('points', 0);
  const dates = new Set((data || []).map(e => e.log_date));
  if (!dates.size) return 0;
  let streak = 0;
  let check = today;
  while (dates.has(check)) {
    streak++;
    const d = new Date(check + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    check = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return streak;
}

export async function getLogsInRange(startDate, endDate) {
  const { data } = await supabase.from('point_log').select('*')
    .eq('user_id', uid()).gte('log_date', startDate).lte('log_date', endDate);
  return (data || []).map(mapPointLog);
}

// ── Projects ───────────────────────────────────────────────────────────────────

export async function getProjects() {
  const { data } = await supabase.from('projects').select('*').eq('user_id', uid());
  return (data || []).map(mapProject);
}

export async function getProjectsForGoal(goalId) {
  const { data } = await supabase.from('projects').select('*')
    .eq('goal_id', goalId).eq('user_id', uid()).order('order_index', { ascending: true });
  return (data || []).map(mapProject);
}

export async function getProject(id) {
  const { data } = await supabase.from('projects').select('*')
    .eq('id', id).eq('user_id', uid()).maybeSingle();
  return data ? mapProject(data) : null;
}

export async function insertProject(p) {
  const { data, error } = await supabase.from('projects').insert({
    user_id: uid(), goal_id: p.goalId,
    name: String(p.name || '').slice(0, 100),
    description: String(p.description || ''),
    status: p.status || 'active', order_index: p.orderIndex || 0,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateProject(id, updates) {
  const { error } = await supabase.from('projects').update(updates)
    .eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete()
    .eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

export async function deleteProjectsForGoal(goalId) {
  const { error } = await supabase.from('projects').delete()
    .eq('goal_id', goalId).eq('user_id', uid());
  if (error) throw error;
}

// ── Project Tasks ──────────────────────────────────────────────────────────────

export async function getAllProjectTasks() {
  const { data } = await supabase.from('project_tasks').select('*').eq('user_id', uid());
  return (data || []).map(mapProjectTask);
}

export async function getTasksForProject(projectId) {
  const { data } = await supabase.from('project_tasks').select('*')
    .eq('project_id', projectId).eq('user_id', uid()).order('order_index', { ascending: true });
  return (data || []).map(mapProjectTask);
}

export async function insertProjectTask(t) {
  const { data, error } = await supabase.from('project_tasks').insert({
    user_id: uid(), project_id: t.projectId,
    name: String(t.name || '').slice(0, 200),
    completed: 0, due_date: t.dueDate || null, order_index: t.orderIndex || 0,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateProjectTask(id, updates) {
  const u = {};
  if (updates.completed !== undefined) u.completed = updates.completed;
  if (updates.name !== undefined) u.name = updates.name;
  if (updates.dueDate !== undefined) u.due_date = updates.dueDate;
  const { error } = await supabase.from('project_tasks').update(u)
    .eq('id', id).eq('user_id', uid());
  if (error) throw error;
}

export async function deleteProjectTask(id) {
  const { error } = await supabase.from('project_tasks').delete()
    .eq('id', id).eq('user_id', uid());
  if (error) throw error;
}
