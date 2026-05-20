import { useState, useEffect, useRef } from 'react';
import { getTodos, insertTodo, deleteTodo, insertPointLog } from '../utils/storage';
import { todayString } from '../utils/dateHelpers';
import BottomSheet from '../components/BottomSheet';

function TodoRow({ todo, onComplete, onDelete }) {
  const [fading, setFading] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(null);

  function handleComplete() {
    setFading(true);
    setTimeout(() => onComplete(todo), 350);
  }

  function onTouchStart(e) { startX.current = e.touches[0].clientX; }
  function onTouchMove(e) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) { setSwiping(true); setSwipeX(Math.max(dx, -80)); }
  }
  function onTouchEnd() {
    if (swipeX < -50) { setSwiping(true); }
    else { setSwiping(false); setSwipeX(0); }
    startX.current = null;
  }

  return (
    <div className="relative overflow-hidden">
      {/* Delete bg */}
      <div className="absolute right-0 top-0 bottom-0 bg-destructive flex items-center px-5">
        <span className="text-white font-bold text-sm">Delete</span>
      </div>
      {/* Row */}
      <div
        className={`flex items-center gap-3 py-3 bg-card transition-opacity ${fading ? 'opacity-0' : 'opacity-100'}`}
        style={{ transform: `translateX(${swipeX}px)`, transition: startX.current ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button
          onClick={handleComplete}
          className="w-6 h-6 rounded-full border-2 border-border flex items-center justify-center flex-shrink-0"
        >
          <span className="w-2.5 h-2.5 rounded-full" />
        </button>
        <span className="flex-1 text-[15px] text-textPrimary">{todo.label}</span>
        <button
          onClick={() => onDelete(todo)}
          className="text-textMuted text-base w-7 flex items-center justify-center"
        >✕</button>
      </div>
      {/* Confirm swipe delete */}
      {swiping && (
        <button
          onClick={() => onDelete(todo)}
          className="absolute right-0 top-0 bottom-0 bg-destructive w-20 flex items-center justify-center text-white font-bold text-sm"
          onTouchStart={e => e.stopPropagation()}
        >Delete</button>
      )}
    </div>
  );
}

export default function TodosScreen() {
  const [todos, setTodos] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('');

  useEffect(() => { setTodos(getTodos()); }, []);

  function handleComplete(todo) {
    deleteTodo(todo.id);
    insertPointLog({ sourceType: 'todo', sourceId: todo.id, points: 10, logDate: todayString() });
    setTodos(prev => prev.filter(t => t.id !== todo.id));
  }

  function handleDelete(todo) {
    deleteTodo(todo.id);
    setTodos(prev => prev.filter(t => t.id !== todo.id));
  }

  function handleAdd() {
    const trimmed = label.trim();
    if (!trimmed) return;
    insertTodo({ label: trimmed });
    setShowAdd(false);
    setLabel('');
    setTodos(getTodos());
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-6">
          {todos.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <div className="text-5xl mb-3">✅</div>
              <div className="text-[18px] font-bold text-textSecondary">All clear!</div>
              <div className="text-[14px] text-textMuted text-center mt-1.5 px-5">
                Tap "+ Add To-Do" below. Completing tasks earns +10 pts.
              </div>
            </div>
          ) : (
            <div className="card mb-3">
              {todos.map((todo, i) => (
                <div key={todo.id}>
                  {i > 0 && <div className="h-px bg-border" />}
                  <TodoRow todo={todo} onComplete={handleComplete} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setShowAdd(true)} className="dashed-btn w-full">+ Add To-Do</button>
        </div>
      </div>

      <BottomSheet visible={showAdd} onClose={() => { setShowAdd(false); setLabel(''); }} title="New To-Do">
        <label className="field-label">Task</label>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          autoFocus
          className="mb-3"
        />
        <button onClick={handleAdd} className="btn-primary w-full mt-2">Add To-Do</button>
      </BottomSheet>
    </div>
  );
}
