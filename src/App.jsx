import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { registerInAppScheduler, ensurePushSubscription, requestNotificationPermission } from './utils/notifications';
import { autoPopulatePlannerForDate } from './utils/plannerUtils';
import { todayString } from './utils/dateHelpers';
import AuthScreen from './screens/AuthScreen';
import PlannerScreen from './screens/PlannerScreen';
import TodosScreen from './screens/TodosScreen';
import GoalsScreen from './screens/GoalsScreen';
import AddGoalScreen from './screens/AddGoalScreen';
import GoalDetailScreen from './screens/GoalDetailScreen';
import GoalChatScreen from './screens/GoalChatScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';

const NOTIF_PROMPTED_KEY = 'levelup_notification_prompted';

const TABS = [
  { id: 'planner', label: 'Planner', icon: '📋' },
  { id: 'todos',   label: "To-Do's", icon: '✅' },
  { id: 'goals',   label: 'Goals',   icon: '🎯' },
  { id: 'stats',   label: 'Stats',   icon: '📊' },
];

export default function App() {
  const { session } = useAuth();
  const [tab, setTab] = useState('planner');
  const [subscreen, setSubscreen] = useState(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    if (!session) return;
    registerInAppScheduler();
    ensurePushSubscription();
    autoPopulatePlannerForDate(todayString()).catch(() => {});

    // Show notification prompt once if permission not yet granted
    const alreadyPrompted = localStorage.getItem(NOTIF_PROMPTED_KEY);
    const permGranted = 'Notification' in window && Notification.permission === 'granted';
    if (!alreadyPrompted && !permGranted && 'Notification' in window) {
      setShowNotifPrompt(true);
    }
  }, [session]);

  async function handleEnableNotifications() {
    localStorage.setItem(NOTIF_PROMPTED_KEY, '1');
    setShowNotifPrompt(false);
    await requestNotificationPermission();
  }

  function handleDismissNotifPrompt() {
    localStorage.setItem(NOTIF_PROMPTED_KEY, '1');
    setShowNotifPrompt(false);
  }

  // Still determining session — show dark splash
  if (session === undefined) {
    return (
      <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-black border border-border flex items-center justify-center">
          <span className="text-[28px] font-black" style={{ color: '#FF6B00' }}>L</span>
        </div>
        <div className="spinner" />
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  function navigate(screen, params = {}) { setSubscreen({ screen, params }); }
  function goBack() { setSubscreen(null); }
  function handleTabChange(id) { setTab(id); setSubscreen(null); }

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
  if (subscreen?.screen === 'goal-chat') {
    return (
      <AppShell>
        <GoalChatScreen
          onBack={goBack}
          editGoalId={subscreen.params?.editGoalId}
          editGoal={subscreen.params?.editGoal}
          onGoalCreated={() => {
            autoPopulatePlannerForDate(todayString()).catch(() => {});
            setTab('planner');
            setSubscreen(null);
          }}
        />
      </AppShell>
    );
  }
  if (subscreen?.screen === 'project-detail') {
    return (
      <AppShell>
        <ProjectDetailScreen projectId={subscreen.params.projectId} onBack={goBack} />
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
          {tab === 'planner' && <PlannerScreen />}
          {tab === 'todos'   && <TodosScreen />}
          {tab === 'goals'   && <GoalsScreen onNavigate={navigate} />}
          {tab === 'stats'   && <StatsScreen onSettings={() => navigate('settings')} />}
        </div>
        <div className="flex-shrink-0" style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }} />
        <TabBar active={tab} onChange={handleTabChange} />
      </div>

      {/* Notification permission prompt */}
      {showNotifPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={handleDismissNotifPrompt} />
          <div className="relative bg-card rounded-t-[20px] border-t border-border p-5 w-full max-w-app slide-up">
            <div className="text-center mb-1">
              <span className="text-4xl">🔔</span>
            </div>
            <h2 className="text-textPrimary font-black text-[18px] text-center mb-2">Enable Notifications</h2>
            <p className="text-textSecondary text-[14px] text-center leading-relaxed mb-6">
              Get daily reminders for your goals so you never miss a session. Tap Allow when prompted.
            </p>
            <button
              onClick={handleEnableNotifications}
              className="btn-primary w-full mb-3"
            >
              Enable Notifications
            </button>
            <button
              onClick={handleDismissNotifPrompt}
              className="w-full text-center text-[14px] text-textSecondary py-2"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
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
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-10 safe-bottom">
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
