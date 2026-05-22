import { useState, useEffect } from 'react';
import {
  getGoals, getActionsForGoal, getCompletionsForDate, getHabits,
  getHabitLogsForDate, getTodayPoints, insertCompletion, deleteCompletion,
  insertPointLog, deletePointLogEntry, insertHabit, deleteHabit, insertHabitLog,
  updateCompletionNote,
} from '../utils/storage';
import { todayString, isActiveDay, isVacationDay, formatDateFull } from '../utils/dateHelpers';
import { TRAITS } from '../constants';
import CheckRow from '../components/CheckRow';
import HabitRow from '../components/HabitRow';
import BottomSheet from '../components/BottomSheet';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getParsedWeeklyPlan(goal) {
  if (!goal.weeklyPlan) return null;
  if (typeof goal.weeklyPlan === 'string') {
    try { return JSON.parse(goal.weeklyPlan); } catch { return null; }
  }
  return goal.weeklyPlan;
}

function getTodayWorkout(goal) {
  const plan = getParsedWeeklyPlan(goal);
  if (!plan) return null;
  return plan[DAY_KEYS[new Date().getDay()]] || null;
}

// ── Number metric row ────────────────────────────────────────────────────────

function NumberActionRow({ action, completion, inputValue, onInputChange, onLog, onUnlog }) {
  const isLogged = !!completion;
  const metricValue = completion?.metricValue;
  const target = action.metricTarget;
  const unit = action.metricUnit || '';
  const hitTarget = target != null && metricValue != null && metricValue >= target;
  const earnedPts = completion?.points ?? action.pointValue;

  if (isLogged) {
    return (
      <div className="flex items-center gap-3 py-3">
        <span className={`w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center flex-shrink-0 ${hitTarget ? 'bg-success border-success' : 'bg-warning/20 border-warning'}`}>
          <span className={`text-xs font-bold ${hitTarget ? 'text-white' : 'text-warning'}`}>✓</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] line-through text-textMuted truncate">{action.name}</div>
          <div className={`text-[12px] font-semibold mt-0.5 ${hitTarget ? 'text-success' : 'text-warning'}`}>
            {metricValue}{unit ? ` ${unit}` : ''}{target ? ` / ${target}${unit ? ` ${unit}` : ''}` : ''}
            {hitTarget ? ' · Goal hit! 🎯' : ' · Partial'}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className={`text-[13px] font-semibold ${hitTarget ? 'text-success' : 'text-warning'}`}>+{earnedPts}</span>
          <button onClick={() => onUnlog(action)} className="text-[11px] text-textMuted">Change</button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="flex items-start gap-3 mb-2">
        <span className="w-[22px] h-[22px] rounded-md border-2 border-border flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-textPrimary">{action.name}</div>
          {target != null && (
            <div className="text-[12px] text-textSecondary mt-0.5">
              Goal: {target}{unit ? ` ${unit}` : ''}
            </div>
          )}
        </div>
        <span className="text-[13px] font-semibold text-success flex-shrink-0">+{action.pointValue}</span>
      </div>
      <div className="flex gap-2 pl-8">
        <input
          type="number"
          placeholder={unit ? `Enter ${unit}` : 'Enter amount'}
          value={inputValue || ''}
          onChange={e => onInputChange(action.id, e.target.value)}
          style={{ width: 'auto', flex: 1 }}
        />
        <button
          onClick={() => onLog(action, parseFloat(inputValue) || 0)}
          disabled={!inputValue || isNaN(parseFloat(inputValue))}
          className="bg-primary text-white font-bold text-[14px] rounded-xl px-4 py-2 flex-shrink-0 disabled:opacity-40"
        >
          Log
        </button>
      </div>
    </div>
  );
}

// ── Workout (fitness) row ────────────────────────────────────────────────────

function WorkoutActionRow({ action, goal, checked, completion, onToggle, noteOpen, noteText, onNoteToggle, onNoteChange, onNoteSave }) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left min-w-0">
          <span className={`w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-success border-success' : 'border-border'}`}>
            {checked && <span className="text-white text-xs font-bold">✓</span>}
          </span>
          <span className={`flex-1 text-[15px] truncate ${checked ? 'line-through text-textMuted' : 'text-textPrimary'}`}>
            {action.name}
          </span>
        </button>
        <span className={`text-[13px] font-semibold flex-shrink-0 ${checked ? 'text-textMuted' : 'text-success'}`}>
          +{action.pointValue}
        </span>
        <button
          onClick={onNoteToggle}
          className={`flex-shrink-0 text-[12px] font-semibold px-2 py-1 rounded-lg transition-colors ${noteOpen ? 'bg-primary/20 text-primary' : 'bg-input text-textSecondary'}`}
        >
          📝
        </button>
      </div>

      {noteOpen && (
        <div className="mt-2 pl-8">
          <textarea
            value={noteText}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="How did it go? Log sets, reps, weight…"
            rows={3}
            className="resize-none text-[13px] w-full"
          />
          <button onClick={onNoteSave} className="text-primary text-[13px] font-bold mt-1">
            Save note
          </button>
        </div>
      )}

      {!noteOpen && completion?.workoutNote && (
        <div className="mt-1 pl-8 text-[12px] text-textSecondary italic leading-relaxed">
          {completion.workoutNote}
        </div>
      )}
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function DailyScreen() {
  const [goalGroups, setGoalGroups] = useState([]);
  const [habits, setHabits] = useState([]);
  const [loggedHabitIds, setLoggedHabitIds] = useState(new Set());
  const [completedActionIds, setCompletedActionIds] = useState(new Set());
  const [completionMap, setCompletionMap] = useState({});
  const [todayPoints, setTodayPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const [numberInputs, setNumberInputs] = useState({});
  const [workoutNotesOpen, setWorkoutNotesOpen] = useState({});
  const [workoutNoteText, setWorkoutNoteText] = useState({});

  const [showAddHabit, setShowAddHabit] = useState(false);
  const [habitType, setHabitType] = useState('good');
  const [habitName, setHabitName] = useState('');
  const [habitPoints, setHabitPoints] = useState('20');
  const [habitTraits, setHabitTraits] = useState([]);

  const today = todayString();
  const todayDayOfWeek = new Date().getDay();

  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    const goals = getGoals();
    const completions = getCompletionsForDate(today);
    const rawHabits = getHabits();
    const logs = getHabitLogsForDate(today);

    const completedIds = new Set(completions.map(c => c.actionId));
    const compMap = {};
    completions.forEach(c => { compMap[c.actionId] = c; });
    const loggedIds = new Set(logs.map(l => l.habitId));

    const activeGroups = [];
    for (const goal of goals) {
      const activeDays = Array.isArray(goal.activeDays) ? goal.activeDays : JSON.parse(goal.activeDays || '[]');
      const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');
      const inRange = today >= goal.startDate;
      const activeDay = isActiveDay(today, activeDays);
      const onVacation = isVacationDay(today, vacationDays);
      if (inRange && activeDay && !onVacation) {
        const allActions = getActionsForGoal(goal.id);
        // Filter day-specific actions — show only today's if dayOfWeek is set
        const actions = allActions.filter(a => {
          const dow = a.dayOfWeek;
          return dow === null || dow === undefined || String(dow) === 'null' || Number(dow) === todayDayOfWeek;
        });
        if (actions.length > 0) activeGroups.push({ ...goal, actions });
      } else {
        console.log(`[Daily] Goal "${goal.title}" skipped — inRange:${inRange} activeDay:${activeDay} onVacation:${onVacation} startDate:${goal.startDate} activeDays:${JSON.stringify(activeDays)}`);
      }
    }
    console.log(`[Daily] Today=${today} (dow=${todayDayOfWeek}), ${goals.length} goals, ${activeGroups.length} active, ${activeGroups.reduce((s, g) => s + g.actions.length, 0)} actions`);

    setGoalGroups(activeGroups);
    setHabits(rawHabits);
    setLoggedHabitIds(loggedIds);
    setCompletedActionIds(completedIds);
    setCompletionMap(compMap);
    setTodayPoints(getTodayPoints(today));
    setLoading(false);
  }

  // ── Action handlers ──

  function handleCheckboxToggle(action, goal) {
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

  function handleNumberLog(action, goal, value) {
    // Clear any existing log for this action today
    if (completedActionIds.has(action.id)) {
      deleteCompletion(action.id, today);
      deletePointLogEntry('action', action.id, today);
    }
    if (!value || value <= 0) { loadData(); return; }

    let points = action.pointValue || 30;
    if (action.metricTarget != null && action.metricTarget > 0) {
      const ratio = Math.min(value / action.metricTarget, 1);
      points = Math.max(1, Math.round(ratio * points));
    }

    insertCompletion({ actionId: action.id, goalId: goal.id, completedDate: today, metricValue: value, points });
    insertPointLog({ sourceType: 'action', sourceId: action.id, points, logDate: today });
    setNumberInputs(prev => ({ ...prev, [action.id]: '' }));
    loadData();
  }

  function handleNumberUnlog(action) {
    deleteCompletion(action.id, today);
    deletePointLogEntry('action', action.id, today);
    loadData();
  }

  function handleWorkoutNoteToggle(actionId) {
    setWorkoutNotesOpen(prev => ({ ...prev, [actionId]: !prev[actionId] }));
    if (!workoutNoteText[actionId]) {
      const completion = completionMap[actionId];
      if (completion?.workoutNote) {
        setWorkoutNoteText(prev => ({ ...prev, [actionId]: completion.workoutNote }));
      }
    }
  }

  function handleWorkoutNoteSave(actionId) {
    const note = workoutNoteText[actionId] || '';
    updateCompletionNote(actionId, today, note);
    setWorkoutNotesOpen(prev => ({ ...prev, [actionId]: false }));
    loadData();
  }

  // ── Habit handlers ──

  function handleHabitLog(habit) {
    if (loggedHabitIds.has(habit.id)) return;
    const pts = habit.type === 'good' ? habit.pointValue : -Math.abs(habit.pointValue);
    insertHabitLog(habit.id, today);
    insertPointLog({ sourceType: 'habit', sourceId: habit.id, points: pts, logDate: today });
    loadData();
  }

  function handleDeleteHabit(id) { deleteHabit(id); loadData(); }

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
            ) : goalGroups.map(goal => {
              const isFitness = goal.goalType === 'fitness';
              const todayWorkout = isFitness ? getTodayWorkout(goal) : null;
              return (
                <div key={goal.id} className="card mb-2">
                  <div className="text-[13px] font-bold text-primary uppercase tracking-wide mb-1">{goal.title}</div>

                  {/* Today's workout banner for fitness goals */}
                  {todayWorkout && (
                    <div className="mb-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="text-[10px] font-bold text-primary uppercase tracking-wide mb-0.5">Today</div>
                      <div className="text-[13px] text-textPrimary font-semibold">{todayWorkout}</div>
                    </div>
                  )}

                  {goal.actions.map((action, i) => (
                    <div key={action.id}>
                      {i > 0 && <div className="h-px bg-border" />}
                      {action.metricType === 'number' ? (
                        <NumberActionRow
                          action={action}
                          completion={completionMap[action.id]}
                          inputValue={numberInputs[action.id]}
                          onInputChange={(id, val) => setNumberInputs(prev => ({ ...prev, [id]: val }))}
                          onLog={(a, val) => handleNumberLog(a, goal, val)}
                          onUnlog={handleNumberUnlog}
                        />
                      ) : isFitness ? (
                        <WorkoutActionRow
                          action={action}
                          goal={goal}
                          checked={completedActionIds.has(action.id)}
                          completion={completionMap[action.id]}
                          onToggle={() => handleCheckboxToggle(action, goal)}
                          noteOpen={!!workoutNotesOpen[action.id]}
                          noteText={workoutNoteText[action.id] || ''}
                          onNoteToggle={() => handleWorkoutNoteToggle(action.id)}
                          onNoteChange={text => setWorkoutNoteText(prev => ({ ...prev, [action.id]: text }))}
                          onNoteSave={() => handleWorkoutNoteSave(action.id)}
                        />
                      ) : (
                        <CheckRow
                          label={action.name}
                          points={action.pointValue}
                          checked={completedActionIds.has(action.id)}
                          onToggle={() => handleCheckboxToggle(action, goal)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
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
