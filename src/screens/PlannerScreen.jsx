import { useState, useEffect, useRef } from 'react';
import {
  getPlannerItemsForDate, insertPlannerItem, updatePlannerItemCompleted,
  updatePlannerItemStartTime, deletePlannerItem, getPlannerItemsForSource,
  getTodos, insertTodo,
  getBadHabits, getBadHabitLogsForDate, insertBadHabit, deleteBadHabit,
  insertBadHabitLog, deleteBadHabitLog,
  insertCompletion, deleteTodo, insertPointLog, deletePointLogEntry,
  getActionById, getGoal, getCompletionForActionDate, getTodayPoints,
} from '../utils/storage';
import { autoPopulatePlannerForDate } from '../utils/plannerUtils';
import { cancelPlannerNotification, schedulePlannerItemNotification } from '../utils/notifications';
import { todayString, formatDateFull, formatTime, timeFromDate, addDays } from '../utils/dateHelpers';
import BottomSheet from '../components/BottomSheet';

// ── Planner item row (goal actions + custom/todo items) ──────────────────────

function PlannerItemRow({ item, editingTimeId, editingTimeValue, onTimeEdit, onTimeChange, onTimeSave, onComplete, onDelete }) {
  const isEditing = editingTimeId === item.id;
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(null);

  function onTouchStart(e) { startX.current = e.touches[0].clientX; }
  function onTouchMove(e) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -88));
  }
  function onTouchEnd() {
    if (swipeX < -50) { /* keep revealed */ }
    else { setSwipeX(0); startX.current = null; }
  }

  const isAction = item.sourceType === 'action';

  return (
    <div className="relative overflow-hidden">
      <button
        className="absolute right-0 top-0 bottom-0 bg-destructive flex items-center justify-center px-5"
        style={{ width: 88 }}
        onClick={() => onDelete(item)}
      >
        <span className="text-white font-bold text-[14px]">Remove</span>
      </button>

      <div
        className="flex items-center gap-3 px-3.5 py-3 bg-card"
        style={{ transform: `translateX(${swipeX}px)`, transition: startX.current ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Time column — tappable to edit inline */}
        <div className="w-[52px] flex-shrink-0">
          {isEditing ? (
            <input
              type="time"
              value={editingTimeValue}
              onChange={e => onTimeChange(e.target.value)}
              onBlur={() => onTimeSave(item.id, editingTimeValue)}
              onKeyDown={e => { if (e.key === 'Enter') onTimeSave(item.id, editingTimeValue); }}
              autoFocus
              style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 11, fontWeight: 700, width: '100%' }}
            />
          ) : (
            <button onClick={() => onTimeEdit(item.id, item.startTime || '')} className="text-left w-full">
              {item.startTime
                ? <span className="text-[11px] font-bold text-primary">{formatTime(item.startTime)}</span>
                : <span className="text-[11px] text-textMuted">+ time</span>
              }
            </button>
          )}
        </div>

        {/* Label + optional goal subtitle */}
        <div className="flex-1 min-w-0">
          <div className={`text-[15px] leading-snug ${item.completed ? 'line-through text-textMuted' : 'text-textPrimary'}`}>
            {item.label}
          </div>
          {isAction && item.goalTitle && (
            <div className="text-[11px] text-textSecondary mt-0.5">{item.goalTitle}</div>
          )}
        </div>

        {/* Point badge */}
        <span className={`text-[13px] font-bold flex-shrink-0 ${item.completed ? 'text-textMuted' : 'text-success'}`}>
          +{item.pointValue || (item.sourceType === 'todo' ? 10 : 5)}
        </span>

        {/* Completion checkbox */}
        <button
          onClick={() => !item.completed && onComplete(item)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            item.completed ? 'bg-success border-success' : 'border-border'
          }`}
        >
          {item.completed && <span className="text-white text-xs font-bold">✓</span>}
        </button>
      </div>
    </div>
  );
}

// ── Bad Habit row (Avoid Today section) ─────────────────────────────────────

function BadHabitRow({ habit, logged, onLog, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (confirmDelete) {
    return (
      <div className="flex items-center justify-between py-3 gap-3">
        <span className="text-[14px] text-textSecondary flex-1">Delete "{habit.name}"?</span>
        <button onClick={() => onDelete(habit.id)} className="text-destructive font-bold text-[13px] px-3 py-1.5 rounded-lg border border-destructive">Delete</button>
        <button onClick={() => setConfirmDelete(false)} className="text-textSecondary text-[13px] px-3 py-1.5">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-textPrimary font-medium truncate">{habit.name}</div>
        <div className="text-[12px] text-warning font-semibold mt-0.5">−{habit.pointValue} pts</div>
      </div>
      {logged ? (
        <button
          onClick={() => onLog(habit)}
          className="text-[13px] font-semibold px-3 py-1.5 rounded-lg bg-warning/20 text-warning"
        >
          Logged ✓
        </button>
      ) : (
        <button
          onClick={() => onLog(habit)}
          className="text-[13px] font-semibold text-white px-3.5 py-1.5 rounded-lg bg-warning"
        >
          Did it
        </button>
      )}
      <button onClick={() => setConfirmDelete(true)} className="text-textMuted text-base w-7 flex-shrink-0 flex items-center justify-center">✕</button>
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const today = todayString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [items, setItems] = useState([]);
  const [badHabits, setBadHabits] = useState([]);
  const [loggedBadHabitIds, setLoggedBadHabitIds] = useState(new Set());
  const [todayPts, setTodayPts] = useState(0);

  // Inline time editing
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');

  // Add modal
  const [addStep, setAddStep] = useState(null);
  const [todoSources, setTodoSources] = useState([]);
  const [pendingTodo, setPendingTodo] = useState(null);
  const [todoStartTime, setTodoStartTime] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customTime, setCustomTime] = useState('');

  // Bad habit form
  const [showAddBadHabit, setShowAddBadHabit] = useState(false);
  const [newBadHabitName, setNewBadHabitName] = useState('');
  const [newBadHabitPoints, setNewBadHabitPoints] = useState('15');

  // Remove confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (selectedDate === today) autoPopulatePlannerForDate(selectedDate);
    loadData();
  }, [selectedDate]);

  function loadData() {
    const rawItems = getPlannerItemsForDate(selectedDate).map(item => {
      // Enrich action items that don't have goalTitle stored (backward compat)
      if (item.sourceType === 'action' && !item.goalTitle) {
        const action = getActionById(item.sourceId);
        if (action) {
          const goal = getGoal(action.goalId);
          return { ...item, goalTitle: goal?.title || '', pointValue: item.pointValue ?? action.pointValue };
        }
      }
      return item;
    });
    setItems(rawItems);
    setBadHabits(getBadHabits());
    const logs = getBadHabitLogsForDate(selectedDate);
    setLoggedBadHabitIds(new Set(logs.map(l => l.habitId)));
    setTodayPts(getTodayPoints(today));
  }

  // ── Planner item complete ──

  function handleComplete(item) {
    updatePlannerItemCompleted(item.id, true);

    if (item.sourceType === 'action') {
      const action = getActionById(item.sourceId);
      if (action) {
        const existing = getCompletionForActionDate(action.id, selectedDate);
        if (!existing) {
          insertCompletion({ actionId: action.id, goalId: action.goalId, completedDate: selectedDate });
          insertPointLog({ sourceType: 'action', sourceId: action.id, points: action.pointValue, logDate: selectedDate });
        }
      }
    } else if (item.sourceType === 'todo') {
      if (item.sourceId) deleteTodo(item.sourceId);
      insertPointLog({ sourceType: 'planner', sourceId: item.id, points: 10, logDate: selectedDate });
    } else {
      // custom or legacy habit
      insertPointLog({ sourceType: 'planner', sourceId: item.id, points: item.pointValue || 5, logDate: selectedDate });
    }

    cancelPlannerNotification(item.notificationId);
    loadData();
  }

  // ── Inline time edit ──

  function handleTimeEdit(itemId, currentTime) {
    setEditingTimeId(itemId);
    setEditingTimeValue(currentTime);
  }

  function handleTimeSave(itemId, newTime) {
    if (newTime) updatePlannerItemStartTime(itemId, newTime);
    setEditingTimeId(null);
    setEditingTimeValue('');
    loadData();
  }

  // ── Remove planner item ──

  function handleDelete(item) { setDeleteConfirm(item); }

  function confirmRemove() {
    cancelPlannerNotification(deleteConfirm.notificationId);
    deletePlannerItem(deleteConfirm.id);
    setDeleteConfirm(null);
    loadData();
  }

  // ── Bad habits ──

  function handleBadHabitLog(habit) {
    if (loggedBadHabitIds.has(habit.id)) {
      deleteBadHabitLog(habit.id, selectedDate);
      deletePointLogEntry('bad_habit', habit.id, selectedDate);
    } else {
      insertBadHabitLog(habit.id, selectedDate);
      insertPointLog({ sourceType: 'bad_habit', sourceId: habit.id, points: -Math.abs(habit.pointValue), logDate: selectedDate });
    }
    loadData();
  }

  function handleDeleteBadHabit(id) {
    deleteBadHabit(id);
    loadData();
  }

  function handleAddBadHabit() {
    const name = newBadHabitName.trim();
    if (!name) return;
    insertBadHabit({ name, pointValue: newBadHabitPoints });
    setNewBadHabitName('');
    setNewBadHabitPoints('15');
    setShowAddBadHabit(false);
    loadData();
  }

  // ── Add modal ──

  function openAddModal() { setAddStep('options'); }

  function closeAddModal() {
    setAddStep(null);
    setTodoSources([]);
    setPendingTodo(null);
    setTodoStartTime('');
    setCustomLabel('');
    setCustomTime('');
  }

  function handlePickTodos() {
    setAddStep('todo-list');
    const todos = getTodos();
    const available = todos.filter(t => !getPlannerItemsForSource(selectedDate, 'todo', t.id).length);
    setTodoSources(available);
  }

  function handleSelectTodo(todo) {
    setPendingTodo(todo);
    setTodoStartTime('');
    setAddStep('todo-time');
  }

  function handleConfirmTodo() {
    insertPlannerItem({
      planDate: selectedDate, label: pendingTodo.label,
      startTime: todoStartTime || null, sourceType: 'todo', sourceId: pendingTodo.id,
      notificationId: null, notificationTime: null, pointValue: 10,
    });
    closeAddModal();
    loadData();
  }

  function handleAddCustom() {
    const label = customLabel.trim();
    if (!label) return;
    // Creates a todo + a planner item linked to it
    const todoId = insertTodo({ label });
    insertPlannerItem({
      planDate: selectedDate, label,
      startTime: customTime || null, sourceType: 'todo', sourceId: todoId,
      notificationId: null, notificationTime: null, pointValue: 10,
    });
    closeAddModal();
    loadData();
  }

  // ── Derived state ──

  const goalActions = items.filter(i => i.sourceType === 'action');
  const customItems  = items.filter(i => i.sourceType !== 'action');
  const doneCount    = items.filter(i => i.completed).length;

  const sharedRowProps = { editingTimeId, editingTimeValue, onTimeEdit: handleTimeEdit, onTimeChange: setEditingTimeValue, onTimeSave: handleTimeSave, onComplete: handleComplete, onDelete: handleDelete };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border bg-card flex-shrink-0 gap-2">
        <button onClick={() => setSelectedDate(d => addDays(d, -1))} className="text-primary text-[28px] font-light w-9 flex items-center justify-center flex-shrink-0">‹</button>
        <div className="flex-1 flex flex-col items-center">
          <span className="text-[15px] font-bold text-textPrimary leading-tight">{formatDateFull(selectedDate)}</span>
          {selectedDate !== today && (
            <button onClick={() => setSelectedDate(today)} className="text-[11px] text-primary font-bold mt-0.5 bg-primary/[0.15] px-2.5 py-0.5 rounded-lg">Today</button>
          )}
        </div>
        <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="text-primary text-[28px] font-light w-9 flex items-center justify-center flex-shrink-0">›</button>
        <div className="bg-primary rounded-full px-3 py-1 text-center flex-shrink-0">
          <div className="text-[9px] text-white/75 font-semibold leading-none">Today</div>
          <div className="text-[14px] text-white font-black leading-tight">+{todayPts}</div>
        </div>
      </div>

      {/* Capacity summary */}
      <div className="text-[12px] text-textMuted font-semibold text-center py-2 flex-shrink-0">
        {items.length === 0 ? 'Nothing planned yet' : `${items.length} item${items.length !== 1 ? 's' : ''} planned · ${doneCount} done`}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-2 pb-6">

          {/* Goal Actions */}
          {goalActions.length > 0 && (
            <div className="mb-4">
              <div className="section-title">Goal Actions</div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {goalActions.map((item, i) => (
                  <div key={item.id}>
                    {i > 0 && <div className="h-px bg-border" />}
                    <PlannerItemRow item={item} {...sharedRowProps} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom / To-Do items */}
          {customItems.length > 0 && (
            <div className="mb-4">
              <div className="section-title">Tasks</div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {customItems.map((item, i) => (
                  <div key={item.id}>
                    {i > 0 && <div className="h-px bg-border" />}
                    <PlannerItemRow item={item} {...sharedRowProps} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center py-10">
              <div className="text-5xl mb-3">📋</div>
              <div className="text-textMuted text-[14px] font-semibold">Goal actions appear here automatically</div>
              <div className="text-textMuted text-[12px] mt-1">Create a goal in the Goals tab to get started</div>
            </div>
          )}

          <button onClick={openAddModal} className="dashed-btn w-full mb-6">+ Add to Plan</button>

          {/* Avoid Today */}
          <div>
            <div className="section-title">Avoid Today</div>
            {badHabits.length > 0 && (
              <div className="card mb-2">
                {badHabits.map((habit, i) => (
                  <div key={habit.id}>
                    {i > 0 && <div className="h-px bg-border" />}
                    <BadHabitRow
                      habit={habit}
                      logged={loggedBadHabitIds.has(habit.id)}
                      onLog={handleBadHabitLog}
                      onDelete={handleDeleteBadHabit}
                    />
                  </div>
                ))}
              </div>
            )}
            {badHabits.length === 0 && (
              <div className="card text-center py-4 mb-2">
                <div className="text-textMuted text-[13px]">Track things you want to avoid — each slip deducts points.</div>
              </div>
            )}
            <button onClick={() => setShowAddBadHabit(true)} className="dashed-btn w-full">+ Add Bad Habit</button>
          </div>
        </div>
      </div>

      {/* Remove confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card rounded-t-[20px] border-t border-border p-5 w-full max-w-app slide-up">
            <p className="text-textPrimary font-semibold text-[15px] mb-1">Remove from planner?</p>
            <p className="text-textSecondary text-[13px] mb-5">
              "{deleteConfirm.label}" will be removed from today.
              {deleteConfirm.sourceType === 'action' ? ' It will reappear tomorrow automatically.' : ''}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-border rounded-xl py-3 text-textSecondary font-semibold">Cancel</button>
              <button onClick={confirmRemove} className="flex-1 bg-destructive rounded-xl py-3 text-white font-bold">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      <BottomSheet
        visible={addStep !== null}
        onClose={closeAddModal}
        title={addStep === 'options' ? 'Add to Plan' : addStep === 'todo-list' ? 'Pick a To-Do' : addStep === 'todo-time' ? 'Set Time' : 'New Task'}
      >
        {addStep === 'options' && (
          <div className="flex flex-col gap-3 pb-2">
            <button onClick={handlePickTodos} className="w-full text-left bg-input rounded-xl border border-border p-4">
              <div className="text-[16px] font-bold text-textPrimary mb-0.5">From To-Do's</div>
              <div className="text-[13px] text-textSecondary">Add an existing to-do to your plan</div>
            </button>
            <button onClick={() => setAddStep('custom-form')} className="w-full text-left bg-input rounded-xl border border-border p-4">
              <div className="text-[16px] font-bold text-textPrimary mb-0.5">Create New</div>
              <div className="text-[13px] text-textSecondary">One-off task — saved as a to-do</div>
            </button>
          </div>
        )}

        {addStep === 'todo-list' && (
          <div>
            <button onClick={() => setAddStep('options')} className="text-primary font-semibold text-[14px] mb-3">‹ Back</button>
            {todoSources.length === 0
              ? <p className="text-textMuted text-center italic py-6">No to-dos available to plan.</p>
              : todoSources.map((todo, i) => (
                <div key={todo.id}>
                  {i > 0 && <div className="h-px bg-border" />}
                  <button onClick={() => handleSelectTodo(todo)} className="flex items-center gap-3 py-3 w-full">
                    <span className="flex-1 text-left text-[15px] text-textPrimary">{todo.label}</span>
                    <span className="text-[12px] font-bold text-success">+10 pts</span>
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {addStep === 'todo-time' && pendingTodo && (
          <div>
            <button onClick={() => setAddStep('todo-list')} className="text-primary font-semibold text-[14px] mb-3">‹ Back</button>
            <p className="text-[16px] font-bold text-textPrimary mb-4">{pendingTodo.label}</p>
            <label className="field-label">Start Time (optional)</label>
            <input type="time" value={todoStartTime} onChange={e => setTodoStartTime(e.target.value)} className="mb-4" />
            <button onClick={handleConfirmTodo} className="btn-primary w-full">Add to Plan</button>
          </div>
        )}

        {addStep === 'custom-form' && (
          <div>
            <button onClick={() => setAddStep('options')} className="text-primary font-semibold text-[14px] mb-3">‹ Back</button>
            <label className="field-label">Task</label>
            <input
              type="text"
              placeholder="What do you want to do?"
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              className="mb-3"
            />
            <label className="field-label">Start Time (optional)</label>
            <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} className="mb-4" />
            <button onClick={handleAddCustom} className="btn-primary w-full">Add to Plan</button>
          </div>
        )}
      </BottomSheet>

      {/* Add Bad Habit sheet */}
      <BottomSheet visible={showAddBadHabit} onClose={() => { setShowAddBadHabit(false); setNewBadHabitName(''); setNewBadHabitPoints('15'); }} title="New Bad Habit">
        <label className="field-label">What to avoid</label>
        <input
          type="text"
          placeholder="e.g. Social media, Alcohol"
          value={newBadHabitName}
          onChange={e => setNewBadHabitName(e.target.value)}
          className="mb-3"
        />
        <label className="field-label">Point Penalty</label>
        <input
          type="number"
          placeholder="15"
          value={newBadHabitPoints}
          onChange={e => setNewBadHabitPoints(e.target.value)}
          className="mb-4"
        />
        <button onClick={handleAddBadHabit} className="btn-primary w-full">Save</button>
      </BottomSheet>
    </div>
  );
}
