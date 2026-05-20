// Simple month calendar for selecting vacation/pause days.
import { useState } from 'react';
import { localDateStr } from '../utils/dateHelpers';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function MiniCalendar({ markedDates = {}, onDayPress }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-card rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center text-white text-xl font-light">‹</button>
        <span className="text-white font-bold text-[15px]">{monthLabel}</span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center text-white text-xl font-light">›</button>
      </div>
      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-bold text-textSecondary py-1">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const dateStr = localDateStr(new Date(year, month, day));
          const isMarked = !!markedDates[dateStr];
          const isToday = dateStr === localDateStr(new Date());
          return (
            <button
              key={dateStr}
              onClick={() => onDayPress(dateStr)}
              className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-medium transition-colors
                ${isMarked ? 'bg-warning text-white font-bold' : isToday ? 'text-primary font-bold' : 'text-textPrimary'}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
