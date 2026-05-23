import { useState } from 'react';
import { calculateGoalStats, formatActiveDays } from '../utils/goalProgress';
import { formatDateShort } from '../utils/dateHelpers';

export default function GoalCard({ goal, actions, completions, projects, taskCountMap, onViewGoal, onViewProject }) {
  const [expanded, setExpanded] = useState(false);
  const stats = calculateGoalStats(goal, actions || [], completions || []);
  const pct = Math.round(stats.actualProgress * 100);

  return (
    <div className="bg-card rounded-xl border border-border mb-3 overflow-hidden">
      {/* Header — tap to expand/collapse */}
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="flex-1 text-[16px] font-bold text-textPrimary truncate">{goal.title}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              stats.isOnTrack ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}>
              {stats.isOnTrack ? 'On track' : `${stats.behindPercent}% behind`}
            </span>
            <span className="text-textMuted text-[12px]">{expanded ? '▲' : '▼'}</span>
          </div>
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

      {/* Expanded: projects list + view details */}
      {expanded && (
        <div className="border-t border-border">
          {(projects && projects.length > 0) ? (
            <>
              <div className="px-4 pt-3 pb-1">
                <span className="text-[11px] font-bold text-textMuted uppercase tracking-wider">Projects</span>
              </div>
              {projects.map((p, i) => {
                const counts = taskCountMap?.[p.id] || { total: 0, done: 0 };
                return (
                  <div key={p.id}>
                    {i > 0 && <div className="h-px bg-border mx-4" />}
                    <button
                      onClick={() => onViewProject(p.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-textPrimary truncate">{p.name}</div>
                        {p.description ? (
                          <div className="text-[12px] text-textSecondary truncate">{p.description}</div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {counts.total > 0 && (
                          <span className="text-[12px] text-textMuted">{counts.done}/{counts.total} tasks</span>
                        )}
                        <span className="text-textMuted text-[12px]">›</span>
                      </div>
                    </button>
                  </div>
                );
              })}
              <div className="h-px bg-border" />
            </>
          ) : (
            <div className="px-4 py-3 text-[13px] text-textMuted">No projects</div>
          )}
          <button
            onClick={() => onViewGoal(goal.id)}
            className="w-full px-4 py-3 text-[14px] font-semibold text-primary text-left"
          >
            View Goal Details →
          </button>
        </div>
      )}
    </div>
  );
}
