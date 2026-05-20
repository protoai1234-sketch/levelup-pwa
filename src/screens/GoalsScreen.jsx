import { useState, useEffect } from 'react';
import { getGoals, getAllActionsForGoals, getCompletionsForGoals } from '../utils/storage';
import GoalCard from '../components/GoalCard';

export default function GoalsScreen({ onNavigate }) {
  const [goals, setGoals] = useState([]);
  const [actions, setActions] = useState({});
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    const rawGoals = getGoals();
    const goalIds = rawGoals.map(g => g.id);
    const allActions = getAllActionsForGoals(goalIds);
    const allCompletions = getCompletionsForGoals(goalIds);

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

    setGoals(rawGoals);
    setActions(actionMap);
    setCompletions(completionMap);
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
              onPress={() => onNavigate('goal-detail', { goalId: goal.id })}
            />
          ))}
          <button onClick={() => onNavigate('add-goal')} className="btn-primary w-full">+ Add Goal</button>
        </div>
      </div>
    </div>
  );
}
