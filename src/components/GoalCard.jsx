import { calculateGoalStats, formatActiveDays } from '../utils/goalProgress';
import { formatDateShort } from '../utils/dateHelpers';

export default function GoalCard({ goal, actions, completions, onPress }) {
  const stats = calculateGoalStats(goal, actions || [], completions || []);
  const pct = Math.round(stats.actualProgress * 100);

  return (
    <button onClick={onPress} className="w-full text-left bg-card rounded-xl p-4 mb-3 border border-border">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="flex-1 text-[16px] font-bold text-textPrimary truncate">{goal.title}</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
          stats.isOnTrack ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
        }`}>
          {stats.isOnTrack ? 'On track' : `${stats.behindPercent}% behind`}
        </span>
      </div>
      <div className="text-[12px] text-textSecondary mb-2.5">
        {formatActiveDays(goal.activeDays)}
        {goal.endDate ? `  ·  Ends ${formatDateShort(goal.endDate)}` : ''}
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-1">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[12px] text-textSecondary">{pct}% complete</div>
    </button>
  );
}
