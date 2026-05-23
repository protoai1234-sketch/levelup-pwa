import { useState, useEffect, useRef } from 'react';
import {
  getPlannerItemsForDate, insertPlannerItem, updatePlannerItemCompleted,
  updatePlannerItemStartTime, deletePlannerItem, getPlannerItemsForSource,
  getTodos, insertTodo,
  insertCompletion, deleteTodo, insertPointLog,
  getActionById, getGoal, getCompletionForActionDate, getTodayPoints,
} from '../utils/storage';
import { autoPopulatePlannerForDate } from '../utils/plannerUtils';
import { cancelPlannerNotification } from '../utils/notifications';
import { todayString, formatDateFull, formatTime, addDays } from '../utils/dateHelpers';
import BottomSheet from '../components/BottomSheet';

function SourcePill({ sourceType }) {
  if (sourceType === 'action') {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success/20 text-success flex-shrink-0">Goal</span>;
  }
  if (sourceType === 'todo') {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary flex-shrink-0">To-Do</span>;
  }
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-textMuted/20 text-textMuted flex-shrink-0">Custom</span>;
}

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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className={`text-[15px] leading-snug truncate ${item.completed ? 'line-through text-textMuted' : 'text-textPrimary'}`}>
              {item.label}
            </div>
            <SourcePill sourceType={item.sourceType} />
          </div>
          {item.sourceType === 'action' && item.goalTitle && (
            <div className="text-[11px] text-textSecondary">{item.goalTitle}</div>
          )}
        </div>

        <span className={`text-[13px] font-bold flex-shrink-0 ${item.completed ? 'text-textMuted' : 'text-success'}`}>
          +{item.pointValue || 10}
        </span>

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

export default function PlannerScreen() {
  const today = todayString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [items, setItems] = useState([]);
  const [todayPts, setTodayPts] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editingTimeId, setEditingTimeId] = useState(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');

  const [addStep, setAddStep] = useState(null);
  const [todoSources, setTodoSources] = useState([]);
  const [pendingTodo, setPendingTodo] = useState(null);
  const [todoStartTime, setTodoStartTime] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customTime, setCustomTime] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    autoPopulatePlannerForDate(selectedDate).catch(() => {}).finally(() => loadData());
  }, [selectedDate]);

  async function loadData() {
    setLoading(true);
    try {
      const rawItems = await getPlannerItemsForDate(selectedDate);
      // Backfill goalTitle for action items that are missing it
      const enriched = await Promise.all(rawItems.map(async item => {
        if (item.sourceType === 'action' && !item.goalTitle && item.sourceId) {
          const action = await getActionById(item.sourceId);
          if (action) {
            const goal = await getGoal(action.goalId);
            return { ...item, goalTitle: goal?.title || '', pointValue: item.pointValue ?? action.pointValue };
          }
        }
        return item;
      }));
      setItems(enriched);
      setTodayPts(await getTodayPoints(today));
    } catch (_) {}
    setLoading(false);
  }

  async function handleComplete(item) {
    try {
      await updatePlannerItemCompleted(item.id, true);

      if (item.sourceType === 'action') {
        const action = await getActionById(item.sourceId);
        if (action) {
          const existing = await getCompletionForActionDate(action.id, selectedDate);
          if (!existing) {
            await insertCompletion({ actionId: action.id, goalId: action.goalId, completedDate: selectedDate });
            await insertPointLog({ sourceType: 'action', sourceId: action.id, points: action.pointValue, logDate: selectedDate });
          }
        }
      } else {
        if (item.sourceId) await deleteTodo(item.sourceId);
        await insertPointLog({ sourceType: 'planner', sourceId: item.id, points: item.pointValue || 10, logDate: selectedDate });
      }

      cancelPlannerNotification(item.notificationId);
      await loadData();
    } catch (_) {}
  }

  function handleTimeEdit(itemId, currentTime) {
    setEditingTimeId(itemId);
    setEditingTimeValue(currentTime);
  }

  async function handleTimeSave(itemId, newTime) {
    try {
      if (newTime) await updatePlannerItemStartTime(itemId, newTime);
    } catch (_) {}
    setEditingTimeId(null);
    setEditingTimeValue('');
    await loadData();
  }

  function handleDelete(item) { setDeleteConfirm(item); }

  async function confirmRemove() {
    try {
      cancelPlannerNotification(deleteConfirm.notificationId);
      await deletePlannerItem(deleteConfirm.id);
    } catch (_) {}
    setDeleteConfirm(null);
    await loadData();
  }

  function openAddModal() { setAddStep('options'); }

  function closeAddModal() {
    setAddStep(null);
    setTodoSources([]);
    setPendingTodo(null);
    setTodoStartTime('');
    setCustomLabel('');
    setCustomTime('');
  }

  async function handlePickTodos() {
    setAddStep('todo-list');
    try {
      const todos = await getTodos();
      const checks = await Promise.all(todos.map(t =>
        getPlannerItemsForSource(selectedDate, 'todo', t.id).then(r => r.length === 0 ? t : null)
      ));
      setTodoSources(checks.filter(Boolean));
    } catch (_) {
      setTodoSources([]);
    }
  }

  function handleSelectTodo(todo) {
    setPendingTodo(todo);
    setTodoStartTime('');
    setAddStep('todo-time');
  }

  async function handleConfirmTodo() {
    try {
      await insertPlannerItem({
        planDate: selectedDate, label: pendingTodo.label,
        startTime: todoStartTime || null, sourceType: 'todo', sourceId: pendingTodo.id,
        notificationId: null, notificationTime: null, pointValue: 10,
      });
    } catch (_) {}
    closeAddModal();
    await loadData();
  }

  async function handleAddCustom() {
    const label = customLabel.trim();
    if (!label) return;
    try {
      const todoId = await insertTodo({ label });
      await insertPlannerItem({
        planDate: selectedDate, label,
        startTime: customTime || null, sourceType: 'custom', sourceId: todoId,
        notificationId: null, notificationTime: null, pointValue: 10,
      });
    } catch (_) {}
    closeAddModal();
    await loadData();
  }

  const doneCount = items.filter(i => i.completed).length;
  const sharedRowProps = {
    editingTimeId, editingTimeValue,
    onTimeEdit: handleTimeEdit, onTimeChange: setEditingTimeValue, onTimeSave: handleTimeSave,
    onComplete: handleComplete, onDelete: handleDelete,
  };

  return (
    <div className="flex flex-col h-full">
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

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>
      ) : (
        <>
          <div className="text-[12px] text-textMuted font-semibold text-center py-2 flex-shrink-0">
            {items.length === 0 ? 'Nothing planned yet' : `${items.length} item${items.length !== 1 ? 's' : ''} planned · ${doneCount} done`}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-2 pb-6">
              {items.length > 0 ? (
                <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
                  {items.map((item, i) => (
                    <div key={item.id}>
                      {i > 0 && <div className="h-px bg-border" />}
                      <PlannerItemRow item={item} {...sharedRowProps} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10">
                  <div className="text-5xl mb-3">📋</div>
                  <div className="text-textMuted text-[14px] font-semibold">Goal actions appear here automatically</div>
                  <div className="text-textMuted text-[12px] mt-1">Create a goal in the Goals tab to get started</div>
                </div>
              )}

              <button onClick={openAddModal} className="dashed-btn w-full">+ Add to Plan</button>
            </div>
          </div>
        </>
      )}

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
    </div>
  );
}
