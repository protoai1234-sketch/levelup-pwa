import { useState } from 'react';

export default function HabitRow({ habit, logged, onLog, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isGood = habit.type === 'good';

  if (confirmDelete) {
    return (
      <div className="flex items-center justify-between py-3 gap-3">
        <span className="text-[14px] text-textSecondary flex-1">Delete "{habit.name}"?</span>
        <button onClick={() => onDelete(habit.id)} className="text-destructive font-bold text-sm px-3 py-1.5 rounded-lg border border-destructive">Delete</button>
        <button onClick={() => setConfirmDelete(false)} className="text-textSecondary text-sm px-3 py-1.5">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-textPrimary font-medium truncate">{habit.name}</div>
        <div className={`text-[12px] font-semibold mt-0.5 ${isGood ? 'text-success' : 'text-warning'}`}>
          {isGood ? '+' : '−'}{Math.abs(habit.pointValue)} pts
        </div>
      </div>
      {logged ? (
        <span className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg ${
          isGood ? 'bg-success/[0.18] text-success' : 'bg-warning/[0.18] text-warning'
        }`}>
          {isGood ? 'Done ✓' : 'Logged'}
        </span>
      ) : (
        <button
          onClick={() => onLog(habit)}
          className={`text-[13px] font-semibold text-white px-3.5 py-1.5 rounded-lg ${isGood ? 'bg-success' : 'bg-warning'}`}
        >
          {isGood ? 'Done' : 'Did it'}
        </button>
      )}
      <button onClick={() => setConfirmDelete(true)} className="text-textMuted text-base w-7 flex-shrink-0 flex items-center justify-center">✕</button>
    </div>
  );
}
