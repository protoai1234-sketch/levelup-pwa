import { useState, useEffect, useRef } from 'react';
import {
  getPlannerItemsForDate, insertPlannerItem, updatePlannerItemCompleted,
  deletePlannerItem, getPlannerItemsForSource,
  getGoals, getAllActionsForGoals, getHabits, getTodos,
  insertCompletion, insertHabitLog, deleteTodo, insertPointLog,
  getActionById, getHabitById, getCompletionForActionDate, getHabitLogForDate,
} from '../utils/storage';
import { schedulePlannerItemNotification, cancelPlannerNotification } from '../utils/notifications';
import { todayString, formatDateFull, formatTime, timeFromDate, addDays, isActiveDay, isVacationDay } from '../utils/dateHelpers';
import BottomSheet from '../components/BottomSheet';

const SOURCE_BADGE = {
  action: { label: 'Goal',   color: '#185FA5' },
  habit:  { label: 'Habit',  color: '#1D9E75' },
  todo:   { label: 'To-Do',  color: '#D85A30' },
  custom: { label: 'Custom', color: '#8E8E93' },
};

function PlannerRow({ item, onComplete, onDelete }) {
  const badge = SOURCE_BADGE[item.sourceType] || SOURCE_BADGE.custom;
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(null);

  function onTouchStart(e) { startX.current = e.touches[0].clientX; }
  function onTouchMove(e) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -88));
  }
  function onTouchEnd() {
    if (swipeX < -50) { /* keep open */ }
    else { setSwipeX(0); startX.current = null; }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Red Remove bg */}
      <button
        className="absolute right-0 top-0 bottom-0 bg-destructive flex items-center justify-center px-5"
        style={{ width: 88 }}
        onClick={() => onDelete(item)}
      >
        <span className="text-white font-bold text-[14px]">Remove</span>
      </button>
      {/* Row */}
      <div
        className="flex items-center gap-3 px-3.5 py-3 bg-card"
        style={{ transform: `translateX(${swipeX}px)`, transition: startX.current ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex flex-col gap-1 min-w-[56px]">
          {item.startTime && <span className="text-[11px] font-bold text-primary">{formatTime(item.startTime)}</span>}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: badge.color + '22', color: badge.color }}>
            {badge.label}
          </span>
        </div>
        <span className={`flex-1 text-[15px] ${item.completed ? 'line-through text-textMuted' : 'text-textPrimary'}`} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.label}
        </span>
        <button
          onClick={() => onComplete(item)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-success border-success' : 'border-border'}`}
        >
          {item.completed && <span className="text-white text-xs font-bold">✓</span>}
        </button>
      </div>
    </div>
  );
}

export default function PlannerScreen() {
  const today = todayString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [items, setItems] = useState([]);
  const [addStep, setAddStep] = useState(null);
  const [dailySources, setDailySources] = useState([]);
  const [todoSources, setTodoSources] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(timeFromDate(new Date()));
  const [customLabel, setCustomLabel] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customPoints, setCustomPoints] = useState('5');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadItems(); }, [selectedDate]);

  function loadItems() { setItems(getPlannerItemsForDate(selectedDate)); }

  function openModal() {
    resetForm(); setAddStep('options');
  }
  function closeModal() { setAddStep(null); resetForm(); }
  function resetForm() {
    setDailySources([]); setTodoSources([]); setLoadingList(false);
    setPendingSource(null); setStartTime(''); setReminderEnabled(false);
    setReminderTime(timeFromDate(new Date())); setCustomLabel('');
    setCustomTime(''); setCustomPoints('5');
  }

  async function handlePickDaily() {
    setAddStep('daily-list'); setLoadingList(true);
    const goals = getGoals();
    const goalIds = goals.map(g => g.id);
    const allActions = getAllActionsForGoals(goalIds);
    const habits = getHabits();

    const activeGoals = goals.filter(g => {
      if (selectedDate < g.startDate || selectedDate > g.endDate) return false;
      const activeDays   = Array.isArray(g.activeDays)   ? g.activeDays   : JSON.parse(g.activeDays   || '[]');
      const vacationDays = Array.isArray(g.vacationDays) ? g.vacationDays : JSON.parse(g.vacationDays || '[]');
      return isActiveDay(selectedDate, activeDays) && !isVacationDay(selectedDate, vacationDays);
    });
    const activeGoalIds = new Set(activeGoals.map(g => g.id));

    const sources = [];
    for (const action of allActions) {
      if (!activeGoalIds.has(action.goalId)) continue;
      const existing = getPlannerItemsForSource(selectedDate, 'action', action.id);
      if (!existing.length) sources.push({ type: 'action', id: action.id, label: action.name, pointValue: action.pointValue, goalId: action.goalId });
    }
    for (const habit of habits.filter(h => h.type === 'good')) {
      const existing = getPlannerItemsForSource(selectedDate, 'habit', habit.id);
      if (!existing.length) sources.push({ type: 'habit', id: habit.id, label: habit.name, pointValue: habit.pointValue });
    }
    setDailySources(sources); setLoadingList(false);
  }

  function handlePickTodos() {
    setAddStep('todo-list'); setLoadingList(true);
    const todos = getTodos();
    const available = todos.filter(t => !getPlannerItemsForSource(selectedDate, 'todo', t.id).length);
    setTodoSources(available); setLoadingList(false);
  }

  function selectSource(source) {
    setPendingSource(source);
    setStartTime(''); setReminderEnabled(false); setReminderTime(timeFromDate(new Date()));
    setAddStep('time-picker');
  }

  function handleConfirmTime() {
    let notifId = null;
    if (reminderEnabled && reminderTime) {
      notifId = schedulePlannerItemNotification(pendingSource.label, selectedDate, reminderTime);
    }
    insertPlannerItem({
      planDate: selectedDate, label: pendingSource.label, startTime: startTime || null,
      sourceType: pendingSource.type, sourceId: pendingSource.id,
      notificationId: notifId, notificationTime: reminderEnabled ? reminderTime : null, pointValue: 5,
    });
    closeModal(); loadItems();
  }

  function handleAddCustom() {
    const trimmed = customLabel.trim();
    if (!trimmed) return;
    let notifId = null;
    if (reminderEnabled && reminderTime && customTime) {
      notifId = schedulePlannerItemNotification(trimmed, selectedDate, reminderTime);
    }
    const pts = parseInt(customPoints, 10);
    insertPlannerItem({
      planDate: selectedDate, label: trimmed, startTime: customTime || null,
      sourceType: 'custom', sourceId: null,
      notificationId: notifId, notificationTime: reminderEnabled ? reminderTime : null,
      pointValue: isNaN(pts) || pts < 1 ? 5 : pts,
    });
    closeModal(); loadItems();
  }

  function handleComplete(item) {
    if (item.completed) return;
    updatePlannerItemCompleted(item.id, true);
    insertPointLog({ sourceType: 'planner', sourceId: item.id, points: 5, logDate: selectedDate });
    cancelPlannerNotification(item.notificationId);

    if (item.sourceType === 'action') {
      const action = getActionById(item.sourceId);
      if (action) {
        const existing = getCompletionForActionDate(action.id, selectedDate);
        if (!existing) {
          insertCompletion({ actionId: action.id, goalId: action.goalId, completedDate: selectedDate });
          insertPointLog({ sourceType: 'action', sourceId: action.id, points: action.pointValue, logDate: selectedDate });
        }
      }
    } else if (item.sourceType === 'habit') {
      const existing = getHabitLogForDate(item.sourceId, selectedDate);
      if (!existing) {
        const habit = getHabitById(item.sourceId);
        insertHabitLog(item.sourceId, selectedDate);
        if (habit) insertPointLog({ sourceType: 'habit', sourceId: item.sourceId, points: habit.pointValue, logDate: selectedDate });
      }
    } else if (item.sourceType === 'todo') {
      deleteTodo(item.sourceId);
      insertPointLog({ sourceType: 'todo', sourceId: item.sourceId, points: 10, logDate: selectedDate });
    }
    loadItems();
  }

  function handleDelete(item) {
    setDeleteConfirm(item);
  }

  function confirmRemove() {
    cancelPlannerNotification(deleteConfirm.notificationId);
    deletePlannerItem(deleteConfirm.id);
    setDeleteConfirm(null);
    loadItems();
  }

  const doneCount = items.filter(i => i.completed).length;
  const stepTitle = { options: 'Add to Planner', 'daily-list': 'Pick a Daily', 'todo-list': 'Pick a To-Do', 'time-picker': 'Set Time', 'custom-form': 'New Task' };

  return (
    <div className="flex flex-col h-full">
      {/* Date nav header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => setSelectedDate(d => addDays(d, -1))} className="text-primary text-3xl font-light w-10 flex items-center justify-center">‹</button>
        <div className="flex flex-col items-center flex-1">
          <span className="text-[15px] font-bold text-textPrimary">{formatDateFull(selectedDate)}</span>
          {selectedDate !== today && (
            <button onClick={() => setSelectedDate(today)} className="text-[12px] text-primary font-bold mt-1 bg-primary/[0.15] px-3 py-0.5 rounded-lg">Today</button>
          )}
        </div>
        <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="text-primary text-3xl font-light w-10 flex items-center justify-center">›</button>
      </div>

      <div className="text-[12px] text-textMuted font-semibold text-center py-2 flex-shrink-0">
        {items.length === 0 ? 'Nothing planned yet' : `${items.length} item${items.length !== 1 ? 's' : ''} planned · ${doneCount} done`}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-14">
              <div className="text-5xl mb-3">📋</div>
              <div className="text-textMuted text-[15px]">Tap + to schedule your day</div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden mb-3">
              {items.map((item, i) => (
                <div key={item.id}>
                  {i > 0 && <div className="h-px bg-border" />}
                  <PlannerRow item={item} onComplete={handleComplete} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          )}
          <button onClick={openModal} className="dashed-btn w-full">+ Add to Plan</button>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card rounded-t-[20px] border-t border-border p-5 w-full max-w-app slide-up">
            <p className="text-textPrimary font-semibold text-[15px] mb-1">Remove from planner</p>
            <p className="text-textSecondary text-[13px] mb-5">"{deleteConfirm.label}" will be removed. The original item is not affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-border rounded-xl py-3 text-textSecondary font-semibold">Cancel</button>
              <button onClick={confirmRemove} className="flex-1 bg-destructive rounded-xl py-3 text-white font-bold">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      <BottomSheet visible={addStep !== null} onClose={closeModal} title={stepTitle[addStep] || ''}>
        {addStep === 'options' && (
          <div className="flex flex-col gap-3 pb-2">
            <OptionBtn label="From Daily Actions" sub="Goals & habits active today" onClick={handlePickDaily} />
            <OptionBtn label="From To-Do's" sub="Add an existing to-do" onClick={handlePickTodos} />
            <OptionBtn label="Create New" sub="One-off task with custom points" onClick={() => setAddStep('custom-form')} />
          </div>
        )}

        {addStep === 'daily-list' && (
          <div>
            <button onClick={() => setAddStep('options')} className="text-primary font-semibold text-[14px] mb-3">‹ Back</button>
            {loadingList ? <div className="flex justify-center py-6"><div className="spinner" /></div>
              : dailySources.length === 0 ? <p className="text-textMuted text-center italic py-6">All dailies are already planned for this day.</p>
              : dailySources.map((src, i) => (
                <div key={`${src.type}-${src.id}`}>
                  {i > 0 && <div className="h-px bg-border" />}
                  <button onClick={() => selectSource(src)} className="flex items-center gap-3 py-3 w-full">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ backgroundColor: SOURCE_BADGE[src.type].color + '22', color: SOURCE_BADGE[src.type].color }}>
                      {SOURCE_BADGE[src.type].label}
                    </span>
                    <span className="flex-1 text-left text-[15px] text-textPrimary">{src.label}</span>
                    <span className="text-[12px] font-bold text-success">+{src.pointValue}</span>
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {addStep === 'todo-list' && (
          <div>
            <button onClick={() => setAddStep('options')} className="text-primary font-semibold text-[14px] mb-3">‹ Back</button>
            {loadingList ? <div className="flex justify-center py-6"><div className="spinner" /></div>
              : todoSources.length === 0 ? <p className="text-textMuted text-center italic py-6">No to-dos available to plan.</p>
              : todoSources.map((todo, i) => (
                <div key={todo.id}>
                  {i > 0 && <div className="h-px bg-border" />}
                  <button onClick={() => selectSource({ type: 'todo', id: todo.id, label: todo.label, pointValue: 5 })}
                    className="flex items-center gap-3 py-3 w-full">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-warning/20 text-warning">To-Do</span>
                    <span className="flex-1 text-left text-[15px] text-textPrimary">{todo.label}</span>
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {addStep === 'time-picker' && pendingSource && (
          <div>
            <button onClick={() => setAddStep(pendingSource.type === 'todo' ? 'todo-list' : 'daily-list')} className="text-primary font-semibold text-[14px] mb-3">‹ Back</button>
            <p className="text-[16px] font-bold text-textPrimary mb-4">{pendingSource.label}</p>
            <label className="field-label">Start Time</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mb-3" />
            <ReminderToggle enabled={reminderEnabled} time={reminderTime} onToggle={() => setReminderEnabled(v => !v)} onTime={setReminderTime} />
            <button onClick={handleConfirmTime} className="btn-primary w-full mt-4">Add to Plan</button>
          </div>
        )}

        {addStep === 'custom-form' && (
          <div>
            <button onClick={() => setAddStep('options')} className="text-primary font-semibold text-[14px] mb-3">‹ Back</button>
            <label className="field-label">Task</label>
            <input type="text" placeholder="What do you want to do?" value={customLabel} onChange={e => setCustomLabel(e.target.value)} className="mb-3" />
            <label className="field-label">Start Time (optional)</label>
            <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} className="mb-3" />
            <label className="field-label">Points</label>
            <input type="number" placeholder="5" value={customPoints} onChange={e => setCustomPoints(e.target.value)} className="mb-3" />
            {customTime && <ReminderToggle enabled={reminderEnabled} time={reminderTime} onToggle={() => setReminderEnabled(v => !v)} onTime={setReminderTime} />}
            <button onClick={handleAddCustom} className="btn-primary w-full mt-3">Add to Plan</button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function ReminderToggle({ enabled, time, onToggle, onTime }) {
  return (
    <div>
      <button onClick={onToggle} className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-[14px] font-semibold transition-colors mb-2 ${
        enabled ? 'border-success bg-success/10 text-success' : 'border-border bg-input text-textSecondary'
      }`}>
        {enabled ? `🔔 Reminder at ${formatTime(time)}` : '🔔 Set reminder'}
      </button>
      {enabled && (
        <input type="time" value={time} onChange={e => onTime(e.target.value)} className="mb-2" />
      )}
    </div>
  );
}

function OptionBtn({ label, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left bg-input rounded-xl border border-border p-4">
      <div className="text-[16px] font-bold text-textPrimary mb-0.5">{label}</div>
      <div className="text-[13px] text-textSecondary">{sub}</div>
    </button>
  );
}
