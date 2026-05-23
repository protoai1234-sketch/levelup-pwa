import { useState, useEffect } from 'react';
import { getGoals, getAllActionsForGoals, getCompletionsForGoals, getProjects, getAllProjectTasks } from '../utils/storage';
import GoalCard from '../components/GoalCard';

export default function GoalsScreen({ onNavigate }) {
  const [goals, setGoals] = useState([]);
  const [actions, setActions] = useState({});
  const [completions, setCompletions] = useState({});
  const [projectMap, setProjectMap] = useState({});
  const [taskCountMap, setTaskCountMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddChoice, setShowAddChoice] = useState(false);

  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    const rawGoals = getGoals();
    const goalIds = rawGoals.map(g => g.id);
    const allActions = getAllActionsForGoals(goalIds);
    const allCompletions = getCompletionsForGoals(goalIds);
    const allProjects = getProjects();
    const allTasks = getAllProjectTasks();

    const actionMap = {};
    allActions.forEach(a => {
      if (!actionMap[a.goalId]) actionMap[a.goalId] = [];
      actionMap[a.goalId].push(a);
    });

    const completionMap = {};
    allCompletions.forEach(c => {
      if (!completionMap[c.goalId]) completionMap[c.goalId] = [];
      completionMap[c.goalId].push(c);
    });

    const pMap = {};
    allProjects.forEach(p => {
      if (!pMap[p.goalId]) pMap[p.goalId] = [];
      pMap[p.goalId].push(p);
    });
    Object.values(pMap).forEach(arr => arr.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)));

    const tCountMap = {};
    allTasks.forEach(t => {
      if (!tCountMap[t.projectId]) tCountMap[t.projectId] = { total: 0, done: 0 };
      tCountMap[t.projectId].total++;
      if (t.completed) tCountMap[t.projectId].done++;
    });

    setGoals(rawGoals);
    setActions(actionMap);
    setCompletions(completionMap);
    setProjectMap(pMap);
    setTaskCountMap(tCountMap);
    setLoading(false);
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-6">
          {goals.length === 0 ? (
            <div className="flex flex-col items-center py-16 px-5 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <div className="text-[22px] font-black text-textPrimary mb-2">No goals yet</div>
              <div className="text-textSecondary text-[15px] leading-relaxed">
                Create a goal to generate daily actions and start earning XP.
              </div>
            </div>
          ) : goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              actions={actions[goal.id] || []}
              completions={completions[goal.id] || []}
              projects={projectMap[goal.id] || []}
              taskCountMap={taskCountMap}
              onViewGoal={(id) => onNavigate('goal-detail', { goalId: id })}
              onViewProject={(id) => onNavigate('project-detail', { projectId: id })}
            />
          ))}
          <button onClick={() => setShowAddChoice(true)} className="btn-primary w-full">+ Add Goal</button>
        </div>
      </div>

      {showAddChoice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddChoice(false)} />
          <div className="relative bg-card rounded-t-[20px] border-t border-border p-5 w-full max-w-app slide-up">
            <p className="text-textPrimary font-bold text-[17px] mb-1 text-center">Add a Goal</p>
            <p className="text-textSecondary text-[13px] text-center mb-5">Let AI build it for you, or set it up manually.</p>
            <button
              onClick={() => { setShowAddChoice(false); onNavigate('goal-chat'); }}
              className="btn-primary w-full mb-3 flex items-center justify-center gap-2"
            >
              <span>✨</span><span>AI Goal Assistant</span>
            </button>
            <button
              onClick={() => { setShowAddChoice(false); onNavigate('add-goal'); }}
              className="w-full border border-border rounded-xl py-3 text-textSecondary font-semibold text-[15px]"
            >
              Add Manually
            </button>
            <button
              onClick={() => setShowAddChoice(false)}
              className="w-full mt-2 py-2 text-textMuted text-[14px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
