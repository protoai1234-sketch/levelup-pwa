import { useState, useEffect } from 'react';
import { getGoal, getActionsForGoal, getCompletionsForGoal, deleteGoal } from '../utils/storage';
import { cancelNotifications } from '../utils/notifications';
import { calculateGoalStats, formatActiveDays } from '../utils/goalProgress';
import { formatDateMedium, formatTime } from '../utils/dateHelpers';
import { TRAIT_COLORS } from '../constants';

export default function GoalDetailScreen({ goalId, onNavigate, onBack }) {
  const [goal, setGoal] = useState(null);
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { loadData(); }, [goalId]);

  function loadData() {
    setLoading(true);
    const g = getGoal(goalId);
    if (!g) { onBack(); return; }
    const acts = getActionsForGoal(goalId);
    const completions = getCompletionsForGoal(goalId);
    setGoal(g);
    setActions(acts);
    setStats(calculateGoalStats(g, acts, completions));
    setLoading(false);
  }

  function handleDelete() {
    const acts = getActionsForGoal(goalId);
    for (const a of acts) cancelNotifications(a.notificationIds || []);
    deleteGoal(goalId);
    onBack();
  }

  if (loading || !goal) return <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>;

  const activeDays   = Array.isArray(goal.activeDays)   ? goal.activeDays   : JSON.parse(goal.activeDays   || '[]');
  const vacationDays = Array.isArray(goal.vacationDays) ? goal.vacationDays : JSON.parse(goal.vacationDays || '[]');
  const traits       = Array.isArray(goal.traits)        ? goal.traits        : JSON.parse(goal.traits        || '[]');
  const pct = stats ? Math.round(stats.actualProgress * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Nav */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={onBack} className="text-primary font-semibold text-[15px]">‹ Goals</button>
        <span className="flex-1 text-textPrimary font-bold text-center truncate">{goal.title}</span>
        <button onClick={() => onNavigate('add-goal', { goal })} className="text-primary font-semibold text-[15px]">Edit</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-8">
          {/* Header card */}
          <div className="card mb-3">
            <h1 className="text-[22px] font-black text-textPrimary mb-1.5">{goal.title}</h1>
            {goal.description ? <p className="text-textSecondary text-[15px] leading-relaxed mb-2.5">{goal.description}</p> : null}
            {traits.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {traits.map(trait => (
                  <span key={trait} className="text-[12px] font-bold px-2.5 py-1 rounded-full border"
                    style={{ color: TRAIT_COLORS[trait], borderColor: TRAIT_COLORS[trait] + '55', backgroundColor: TRAIT_COLORS[trait] + '22' }}>
                    {trait}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Progress */}
          {stats && (
            <div className="card mb-3">
              <div className="section-label">Progress</div>
              <div className="h-2 bg-border rounded-full overflow-hidden mb-3">
                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex">
                <StatItem label="Complete" value={`${pct}%`} />
                <StatItem label="Days done" value={`${stats.daysCompleted}/${stats.totalActiveDays}`} />
                <StatItem
                  label="Status"
                  value={stats.isOnTrack ? 'On track' : `${stats.behindPercent}% behind`}
                  color={stats.isOnTrack ? '#1D9E75' : '#D85A30'}
                />
              </div>
            </div>
          )}

          {/* Details */}
          <div className="card mb-3">
            <div className="section-label">Details</div>
            <DetailRow label="Active days" value={formatActiveDays(activeDays) || '—'} />
            <DetailRow label="Start" value={formatDateMedium(goal.startDate)} />
            <DetailRow label="End" value={formatDateMedium(goal.endDate)} />
            <DetailRow label="Reminders" value={goal.notificationsEnabled && goal.notificationTime ? `Daily at ${formatTime(goal.notificationTime)}` : 'Off'} />
            {vacationDays.length > 0 && <DetailRow label="Paused days" value={`${vacationDays.length} day(s)`} />}
          </div>

          {/* Actions */}
          <div className="card mb-4">
            <div className="section-label">Daily Actions</div>
            {actions.map((action, i) => (
              <div key={action.id}>
                {i > 0 && <div className="h-px bg-border" />}
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[15px] text-textPrimary flex-1">{action.name}</span>
                  <span className="text-[13px] font-bold text-success">+{action.pointValue} pts</span>
                </div>
              </div>
            ))}
            {actions.length === 0 && <p className="text-textMuted italic text-[14px]">No actions defined.</p>}
          </div>

          <button onClick={() => onNavigate('add-goal', { goal })} className="btn-primary w-full mb-3">Edit Goal</button>

          {confirmDelete ? (
            <div className="card text-center">
              <p className="text-textSecondary text-[14px] mb-4">Delete "{goal.title}" and all its data?</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-border rounded-xl py-3 text-textSecondary font-semibold">Cancel</button>
                <button onClick={handleDelete} className="flex-1 bg-destructive rounded-xl py-3 text-white font-bold">Delete</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full border-2 border-destructive rounded-xl py-3.5 text-destructive font-bold">
              Delete Goal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div className="flex-1 flex flex-col items-center">
      <span className="text-[16px] font-black" style={{ color: color || '#fff' }}>{value}</span>
      <span className="text-[11px] text-textSecondary mt-0.5">{label}</span>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-[14px] text-textSecondary font-medium">{label}</span>
      <span className="text-[14px] text-textPrimary font-semibold">{value}</span>
    </div>
  );
}
