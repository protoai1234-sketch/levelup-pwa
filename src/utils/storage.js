// localStorage-backed data layer. All public functions mirror the original db.js API
// and return plain values (not Promises) unless noted.

const KEYS = {
  goals:        'levelup_goals',
  actions:      'levelup_daily_actions',
  completions:  'levelup_action_completions',
  habits:       'levelup_habits',
  habitLogs:    'levelup_habit_logs',
  todos:        'levelup_todos',
  planner:      'levelup_planner_items',
  pointLog:     'levelup_point_log',
  user:         'levelup_user',
  badHabits:    'levelup_bad_habits',
  badHabitLogs: 'levelup_bad_habit_logs',
};

function load(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function nextId(items) {
  return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1;
}
function nowStr() { return new Date().toISOString(); }

// ── User ──────────────────────────────────────────────────────────────────────

export function getUser() { return load(KEYS.user, null); }
export function saveUser(u) { save(KEYS.user, u); }

export function ensureUser() {
  let u = getUser();
  if (!u) {
    u = { userId: crypto.randomUUID(), displayName: '' };
    saveUser(u);
  }
  return u;
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export function getGoals() {
  return load(KEYS.goals).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getGoal(id) {
  return load(KEYS.goals).find(g => g.id === id) || null;
}

export function insertGoal(g) {
  const goals = load(KEYS.goals);
  const id = nextId(goals);
  goals.push({
    id, ...g,
    activeDays:   Array.isArray(g.activeDays)   ? g.activeDays   : JSON.parse(g.activeDays   || '[]'),
    vacationDays: Array.isArray(g.vacationDays) ? g.vacationDays : JSON.parse(g.vacationDays || '[]'),
    traits:       Array.isArray(g.traits)        ? g.traits       : JSON.parse(g.traits        || '[]'),
    goalType:     g.goalType || 'general',
    weeklyPlan:   typeof g.weeklyPlan === 'string' ? JSON.parse(g.weeklyPlan || 'null') : (g.weeklyPlan || null),
    notificationsEnabled: 0, notificationTime: null, notificationIds: '[]',
    createdAt: nowStr(),
  });
  save(KEYS.goals, goals);
  return id;
}

export function updateGoal(id, g) {
  const goals = load(KEYS.goals);
  const idx = goals.findIndex(x => x.id === id);
  if (idx === -1) return;
  goals[idx] = {
    ...goals[idx], ...g,
    activeDays:   Array.isArray(g.activeDays)   ? g.activeDays   : JSON.parse(g.activeDays   || '[]'),
    vacationDays: Array.isArray(g.vacationDays) ? g.vacationDays : JSON.parse(g.vacationDays || '[]'),
    traits:       Array.isArray(g.traits)        ? g.traits       : JSON.parse(g.traits        || '[]'),
    goalType:     g.goalType || goals[idx].goalType || 'general',
    weeklyPlan:   g.weeklyPlan !== undefined
      ? (typeof g.weeklyPlan === 'string' ? JSON.parse(g.weeklyPlan || 'null') : g.weeklyPlan)
      : goals[idx].weeklyPlan,
  };
  save(KEYS.goals, goals);
}

export function deleteGoal(id) {
  save(KEYS.goals,       load(KEYS.goals).filter(g => g.id !== id));
  save(KEYS.actions,     load(KEYS.actions).filter(a => a.goalId !== id));
  save(KEYS.completions, load(KEYS.completions).filter(c => c.goalId !== id));
}

// ── Daily Actions ──────────────────────────────────────────────────────────────

export function getActionsForGoal(goalId) {
  return load(KEYS.actions).filter(a => a.goalId === goalId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getActionById(id) {
  return load(KEYS.actions).find(a => a.id === id) || null;
}

export function getAllActionsForGoals(goalIds) {
  if (!goalIds.length) return [];
  const set = new Set(goalIds);
  return load(KEYS.actions).filter(a => set.has(a.goalId));
}

export function insertAction(a) {
  const actions = load(KEYS.actions);
  const id = nextId(actions);
  actions.push({
    id, ...a,
    notificationIds: Array.isArray(a.notificationIds) ? a.notificationIds : JSON.parse(a.notificationIds || '[]'),
    createdAt: nowStr(),
  });
  save(KEYS.actions, actions);
  return id;
}

export function deleteActionsForGoal(goalId) {
  save(KEYS.actions, load(KEYS.actions).filter(a => a.goalId !== goalId));
}

// ── Action Completions ─────────────────────────────────────────────────────────

export function getCompletionsForDate(date) {
  return load(KEYS.completions).filter(c => c.completedDate === date);
}

export function getCompletionsForGoal(goalId) {
  return load(KEYS.completions).filter(c => c.goalId === goalId);
}

export function getCompletionsForGoals(goalIds) {
  const set = new Set(goalIds);
  return load(KEYS.completions).filter(c => set.has(c.goalId));
}

export function getCompletionForActionDate(actionId, date) {
  return load(KEYS.completions).find(c => c.actionId === actionId && c.completedDate === date) || null;
}

export function insertCompletion(c) {
  const completions = load(KEYS.completions);
  const id = nextId(completions);
  completions.push({ id, ...c, createdAt: nowStr() });
  save(KEYS.completions, completions);
  return id;
}

export function deleteCompletion(actionId, date) {
  save(KEYS.completions, load(KEYS.completions).filter(
    c => !(c.actionId === actionId && c.completedDate === date)
  ));
}

export function updateCompletionNote(actionId, date, workoutNote) {
  const completions = load(KEYS.completions);
  const idx = completions.findIndex(c => c.actionId === actionId && c.completedDate === date);
  if (idx !== -1) { completions[idx].workoutNote = workoutNote; save(KEYS.completions, completions); }
}

export function getCompletionsInRange(startDate, endDate) {
  return load(KEYS.completions).filter(c => c.completedDate >= startDate && c.completedDate <= endDate);
}

// ── Habits ─────────────────────────────────────────────────────────────────────

export function getHabits() {
  return load(KEYS.habits).sort((a, b) => {
    if (a.type !== b.type) return b.type.localeCompare(a.type);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function getHabitById(id) {
  return load(KEYS.habits).find(h => h.id === id) || null;
}

export function insertHabit(h) {
  const habits = load(KEYS.habits);
  const id = nextId(habits);
  habits.push({
    id, ...h,
    traits: Array.isArray(h.traits) ? h.traits : JSON.parse(h.traits || '[]'),
    createdAt: nowStr(),
  });
  save(KEYS.habits, habits);
  return id;
}

export function deleteHabit(id) {
  save(KEYS.habits,    load(KEYS.habits).filter(h => h.id !== id));
  save(KEYS.habitLogs, load(KEYS.habitLogs).filter(l => l.habitId !== id));
}

// ── Habit Logs ─────────────────────────────────────────────────────────────────

export function getHabitLogsForDate(date) {
  return load(KEYS.habitLogs).filter(l => l.logDate === date);
}

export function getHabitLogForDate(habitId, date) {
  return load(KEYS.habitLogs).find(l => l.habitId === habitId && l.logDate === date) || null;
}

export function insertHabitLog(habitId, date) {
  const logs = load(KEYS.habitLogs);
  const id = nextId(logs);
  logs.push({ id, habitId, logDate: date, createdAt: nowStr() });
  save(KEYS.habitLogs, logs);
  return id;
}

// ── Todos ──────────────────────────────────────────────────────────────────────

export function getTodos() {
  return load(KEYS.todos).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getTodoById(id) {
  return load(KEYS.todos).find(t => t.id === id) || null;
}

export function insertTodo(t) {
  const todos = load(KEYS.todos);
  const id = nextId(todos);
  todos.push({ id, label: t.label, createdAt: nowStr() });
  save(KEYS.todos, todos);
  return id;
}

export function deleteTodo(id) {
  save(KEYS.todos, load(KEYS.todos).filter(t => t.id !== id));
}

// ── Planner Items ──────────────────────────────────────────────────────────────

export function getPlannerItemsForDate(date) {
  return load(KEYS.planner)
    .filter(i => i.planDate === date)
    .sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export function getPlannerItemsForSource(planDate, sourceType, sourceId) {
  return load(KEYS.planner).filter(
    i => i.planDate === planDate && i.sourceType === sourceType && i.sourceId === sourceId
  );
}

export function insertPlannerItem(item) {
  const items = load(KEYS.planner);
  const id = nextId(items);
  items.push({ id, ...item, completed: false, createdAt: nowStr() });
  save(KEYS.planner, items);
  return id;
}

export function updatePlannerItemCompleted(id, completed) {
  const items = load(KEYS.planner);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) { items[idx].completed = completed; save(KEYS.planner, items); }
}

export function deletePlannerItem(id) {
  save(KEYS.planner, load(KEYS.planner).filter(i => i.id !== id));
}

export function updatePlannerItemStartTime(id, startTime) {
  const items = load(KEYS.planner);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) { items[idx].startTime = startTime; save(KEYS.planner, items); }
}

// ── Point Log ──────────────────────────────────────────────────────────────────

export function insertPointLog(entry) {
  const log = load(KEYS.pointLog);
  const id = nextId(log);
  log.push({ id, ...entry, createdAt: nowStr() });
  save(KEYS.pointLog, log);
}

export function deletePointLogEntry(sourceType, sourceId, date) {
  save(KEYS.pointLog, load(KEYS.pointLog).filter(
    e => !(e.sourceType === sourceType && e.sourceId === sourceId && e.logDate === date)
  ));
}

export function getTodayPoints(date) {
  return load(KEYS.pointLog)
    .filter(e => e.logDate === date)
    .reduce((s, e) => s + (e.points || 0), 0);
}

export function getTotalXP() {
  return load(KEYS.pointLog)
    .filter(e => e.points > 0)
    .reduce((s, e) => s + e.points, 0);
}

export function getPointsByDate(dates) {
  const set = new Set(dates);
  const map = {};
  load(KEYS.pointLog).forEach(e => {
    if (set.has(e.logDate)) map[e.logDate] = (map[e.logDate] || 0) + e.points;
  });
  return map;
}

export function getStreak(today) {
  const dates = new Set(
    load(KEYS.pointLog).filter(e => e.points > 0).map(e => e.logDate)
  );
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

export function getLogsInRange(startDate, endDate) {
  return load(KEYS.pointLog).filter(e => e.logDate >= startDate && e.logDate <= endDate);
}

// ── Bad Habits ─────────────────────────────────────────────────────────────────

export function getBadHabits() {
  return load(KEYS.badHabits).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function insertBadHabit(h) {
  const habits = load(KEYS.badHabits);
  const id = nextId(habits);
  habits.push({ id, name: String(h.name || '').trim(), pointValue: Math.abs(parseInt(h.pointValue, 10) || 15), createdAt: nowStr() });
  save(KEYS.badHabits, habits);
  return id;
}

export function deleteBadHabit(id) {
  save(KEYS.badHabits,    load(KEYS.badHabits).filter(h => h.id !== id));
  save(KEYS.badHabitLogs, load(KEYS.badHabitLogs).filter(l => l.habitId !== id));
}

export function getBadHabitLogsForDate(date) {
  return load(KEYS.badHabitLogs).filter(l => l.logDate === date);
}

export function insertBadHabitLog(habitId, date) {
  const logs = load(KEYS.badHabitLogs);
  const id = nextId(logs);
  logs.push({ id, habitId, logDate: date, createdAt: nowStr() });
  save(KEYS.badHabitLogs, logs);
  return id;
}

export function deleteBadHabitLog(habitId, date) {
  save(KEYS.badHabitLogs, load(KEYS.badHabitLogs).filter(l => !(l.habitId === habitId && l.logDate === date)));
}
