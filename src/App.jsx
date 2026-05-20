import { useState, useEffect } from 'react';
import { getUser } from './utils/storage';
import { registerInAppScheduler, ensurePushSubscription } from './utils/notifications';
import OnboardingScreen from './screens/OnboardingScreen';
import DailyScreen from './screens/DailyScreen';
import PlannerScreen from './screens/PlannerScreen';
import TodosScreen from './screens/TodosScreen';
import GoalsScreen from './screens/GoalsScreen';
import AddGoalScreen from './screens/AddGoalScreen';
import GoalDetailScreen from './screens/GoalDetailScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';

const TABS = [
  { id: 'daily',   label: 'Daily',    icon: '☀️' },
  { id: 'planner', label: 'Planner',  icon: '📋' },
  { id: 'todos',   label: "To-Do's",  icon: '✅' },
  { id: 'goals',   label: 'Goals',    icon: '🎯' },
  { id: 'stats',   label: 'Stats',    icon: '📊' },
];

export default function App() {
  const [onboarded, setOnboarded] = useState(null);
  const [tab, setTab] = useState('daily');
  const [subscreen, setSubscreen] = useState(null);

  useEffect(() => {
    const user = getUser();
    setOnboarded(!!(user?.displayName));
    registerInAppScheduler();
    // Re-subscribe on every load so Supabase always has a current subscription row.
    // Idempotent — reuses the existing push subscription if one is already active.
    ensurePushSubscription();
  }, []);

  function navigate(screen, params = {}) { setSubscreen({ screen, params }); }
  function goBack() { setSubscreen(null); }
  function handleTabChange(id) { setTab(id); setSubscreen(null); }

  if (onboarded === null) return null;

  if (!onboarded) {
    return (
      <div className="fixed inset-0 bg-bg overflow-hidden">
        <div className="h-full max-w-app mx-auto">
          <OnboardingScreen onDone={() => setOnboarded(true)} />
        </div>
      </div>
    );
  }

  if (subscreen?.screen === 'add-goal') {
    return (
      <AppShell>
        <AddGoalScreen existingGoal={subscreen.params?.goal} onBack={goBack} />
      </AppShell>
    );
  }
  if (subscreen?.screen === 'goal-detail') {
    return (
      <AppShell>
        <GoalDetailScreen goalId={subscreen.params.goalId} onNavigate={navigate} onBack={goBack} />
      </AppShell>
    );
  }
  if (subscreen?.screen === 'settings') {
    return (
      <AppShell>
        <SettingsScreen onBack={goBack} />
      </AppShell>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg overflow-hidden flex flex-col">
      <div className="flex-1 max-w-app mx-auto w-full overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden flex flex-col safe-top">
          {tab === 'daily'   && <DailyScreen />}
          {tab === 'planner' && <PlannerScreen />}
          {tab === 'todos'   && <TodosScreen />}
          {tab === 'goals'   && <GoalsScreen onNavigate={navigate} />}
          {tab === 'stats'   && <StatsScreen onSettings={() => navigate('settings')} />}
        </div>
        <TabBar active={tab} onChange={handleTabChange} />
      </div>
    </div>
  );
}

function AppShell({ children }) {
  return (
    <div className="fixed inset-0 bg-bg overflow-hidden flex flex-col">
      <div className="flex-1 max-w-app mx-auto w-full overflow-hidden flex flex-col safe-top">
        {children}
      </div>
    </div>
  );
}

function TabBar({ active, onChange }) {
  return (
    <nav className="flex-shrink-0 bg-card border-t border-border safe-bottom">
      <div className="flex max-w-app mx-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${active === t.id ? 'text-primary' : 'text-textSecondary'}`}
          >
            <span className="text-[22px] leading-none">{t.icon}</span>
            <span className={`text-[10px] font-semibold ${active === t.id ? 'text-primary' : 'text-textSecondary'}`}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
