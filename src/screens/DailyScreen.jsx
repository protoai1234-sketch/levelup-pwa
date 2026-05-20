import { useState, useEffect } from 'react';
import {
  getGoals, getActionsForGoal, getCompletionsForDate, getHabits,
  getHabitLogsForDate, getTodayPoints, insertCompletion, deleteCompletion,
  insertPointLog, deletePointLogEntry, insertHabit, deleteHabit, insertHabitLog,
} from '../utils/storage';
import { todayString, isActiveDay, isVacationDay, formatDateFull } from '../utils/dateHelpers';
import { TRAITS } from '../constants';
import CheckRow from '../components/CheckRow';
import HabitRow from '../components/HabitRow';
import BottomSheet from '../components/BottomSheet';

export default function DailyScreen() {
  const [goalGroups, setGoalGroups] = useState([]);
  const [habits, setHabits] = useState([]);
  const [loggedHabitIds, setLoggedHabitIds] = useState(new Set());
  const [completedActionIds, setCompletedActionIds] = useState(new Set());
  const [todayPoints, setTodayPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showAddHabit, setShowAddHabit] = useState(false);
  const [habitType, setHabitType] = useState('good');
  const [habitName, setHabitName] = useState('');
  const [habitPoints, setHabitPoints] = useState('20');
  const [habitTraits, setHabitTraits] = useState([]);

  const today = todayString();

  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    const goals = getGoals();
    const completions = getCompletionsForDate(today);
    const rawHabits = getHabits();
    const logs = getHabitLogsForDate(today);

    const completedIds = new Set(completions.map(c => c.actionId));
    const loggedIds = new Set(logs.map(l => l.habitId));

    const activeGroups = [];
    for (const goal of goals) {
      const activeDays = Array.isArray(goal.activeDays) ? goal.activeDays : JSON.parse(goal.activeDays || '[]');
      const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');
      if (today >= goal.startDate && isActiveDay(today, activeDays) && !isVacationDay(today, vacationDays)) {
        const actions = getActionsForGoal(goal.id);
        if (actions.length > 0) activeGroups.push({ ...goal, actions });
      }
    }

    setGoalGroups(activeGroups);
    setHabits(rawHabits);
    setLoggedHabitIds(loggedIds);
    setCompletedActionIds(completedIds);
    setTodayPoints(getTodayPoints(today));
    setLoading(false);
  }

  function handleActionToggle(action, goal) {
    const isChecked = completedActionIds.has(action.id);
    if (isChecked) {
      deleteCompletion(action.id, today);
      deletePointLogEntry('action', action.id, today);
    } else {
      insertCompletion({ actionId: action.id, goalId: goal.id, completedDate: today });
      insertPointLog({ sourceType: 'action', sourceId: action.id, points: action.pointValue, logDate: today });
    }
    loadData();
  }

  function handleHabitLog(habit) {
    if (loggedHabitIds.has(habit.id)) return;
    const pts = habit.type === 'good' ? habit.pointValue : -Math.abs(habit.pointValue);
    insertHabitLog(habit.id, today);
    insertPointLog({ sourceType: 'habit', sourceId: habit.id, points: pts, logDate: today });
    loadData();
  }

  function handleDeleteHabit(id) {
    deleteHabit(id);
    loadData();
  }

  function handleAddHabit() {
    const name = habitName.trim();
    if (!name) return;
    insertHabit({ name, type: habitType, pointValue: Math.abs(parseInt(habitPoints, 10) || 20), traits: habitTraits });
    setShowAddHabit(false);
    resetHabitForm();
    loadData();
  }

  function resetHabitForm() {
    setHabitType('good'); setHabitName(''); setHabitPoints('20'); setHabitTraits([]);
  }

  function toggleHabitTrait(t) {
    setHabitTraits(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  const goodHabits = habits.filter(h => h.type === 'good');
  const badHabits  = habits.filter(h => h.type === 'bad');

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <span className="text-[15px] font-bold text-textPrimary">{formatDateFull(today)}</span>
        <div className="bg-primary rounded-full px-3 py-1 text-center">
          <div className="text-[10px] text-white/75 font-semibold leading-none">Today</div>
          <div className="text-[15px] text-white font-black leading-tight">+{todayPoints} pts</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-6">
          {/* Goal Actions */}
          <div className="mb-5">
            <div className="section-title">Goal Actions</div>
            {goalGroups.length === 0 ? (
              <div className="card text-center py-6">
                <div className="text-3xl mb-2">🌟</div>
                <div className="text-textSecondary font-semibold">No goal actions scheduled today.</div>
                <div className="text-textMuted text-[13px] mt-1">Add a goal in the Goals tab to get started.</div>
              </div>
            ) : goalGroups.map(goal => (
              <div key={goal.id} className="card mb-2">
                <div className="text-[13px] font-bold text-primary uppercase tracking-wide mb-1">{goal.title}</div>
                {goal.actions.map((action, i) => (
                  <div key={action.id}>
                    {i > 0 && <div className="h-px bg-border" />}
                    <CheckRow
                      label={action.name}
                      points={action.pointValue}
                      checked={completedActionIds.has(action.id)}
                      onToggle={() => handleActionToggle(action, goal)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Habits */}
          <div>
            <div className="section-title">Habits</div>
            {habits.length === 0 && (
              <div className="card text-center py-5">
                <div className="text-textSecondary font-semibold">No habits yet.</div>
                <div className="text-textMuted text-[13px] mt-1">Tap "Add Habit" to track good or bad habits.</div>
              </div>
            )}
            {goodHabits.length > 0 && (
              <div className="card mb-2">
                <div className="text-[12px] font-bold text-textSecondary mb-1">Good Habits</div>
                {goodHabits.map((habit, i) => (
                  <div key={habit.id}>
                    {i > 0 && <div className="h-px bg-border" />}
                    <HabitRow habit={habit} logged={loggedHabitIds.has(habit.id)} onLog={handleHabitLog} onDelete={handleDeleteHabit} />
                  </div>
                ))}
              </div>
            )}
            {badHabits.length > 0 && (
              <div className="card mb-2">
                <div className="text-[12px] font-bold text-textSecondary mb-1">Bad Habits</div>
                {badHabits.map((habit, i) => (
                  <div key={habit.id}>
                    {i > 0 && <div className="h-px bg-border" />}
                    <HabitRow habit={habit} logged={loggedHabitIds.has(habit.id)} onLog={handleHabitLog} onDelete={handleDeleteHabit} />
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowAddHabit(true)} className="dashed-btn w-full mt-2">+ Add Habit</button>
          </div>
        </div>
      </div>

      {/* Add Habit Sheet */}
      <BottomSheet visible={showAddHabit} onClose={() => { setShowAddHabit(false); resetHabitForm(); }} title="New Habit">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setHabitType('good'); setHabitPoints('20'); }}
            className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-[14px] transition-colors
              ${habitType === 'good' ? 'bg-success border-success text-white' : 'border-border text-textSecondary bg-input'}`}
          >Good Habit</button>
          <button
            onClick={() => { setHabitType('bad'); setHabitPoints('15'); }}
            className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-[14px] transition-colors
              ${habitType === 'bad' ? 'bg-warning border-warning text-white' : 'border-border text-textSecondary bg-input'}`}
          >Bad Habit</button>
        </div>
        <label className="field-label">Name</label>
        <input type="text" placeholder="e.g. Morning walk" value={habitName} onChange={e => setHabitName(e.target.value)} className="mb-3" />
        <label className="field-label">Point Value</label>
        <input type="number" placeholder="20" value={habitPoints} onChange={e => setHabitPoints(e.target.value)} className="mb-3" />
        <label className="field-label">Traits (optional)</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {TRAITS.map(t => (
            <button
              key={t}
              onClick={() => toggleHabitTrait(t)}
              className={`chip ${habitTraits.includes(t) ? 'chip-active' : ''}`}
            >{t}</button>
          ))}
        </div>
        <button onClick={handleAddHabit} className="btn-primary w-full">Save Habit</button>
      </BottomSheet>
    </div>
  );
}
