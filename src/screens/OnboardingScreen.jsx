import { useState } from 'react';
import { saveUser, ensureUser } from '../utils/storage';
import { requestNotificationPermission } from '../utils/notifications';

export default function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [notifStatus, setNotifStatus] = useState('');

  async function handleName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const user = ensureUser();
    saveUser({ ...user, displayName: trimmed });
    setStep(2);
  }

  async function handleNotifRequest() {
    const granted = await requestNotificationPermission();
    setNotifStatus(granted ? 'granted' : 'denied');
    setTimeout(() => setStep(3), 800);
  }

  function handleSkipNotif() { setStep(3); }

  const steps = [
    // 0 — Welcome
    <div key="welcome" className="flex flex-col items-center justify-center h-full px-8 text-center fade-in">
      <div className="text-8xl mb-6">🎮</div>
      <h1 className="text-4xl font-black text-white mb-3">LevelUp</h1>
      <p className="text-textSecondary text-lg leading-relaxed mb-12">Turn your life into a game</p>
      <button onClick={() => setStep(1)} className="btn-primary w-full text-lg py-4">Get Started</button>
    </div>,

    // 1 — Display name
    <div key="name" className="flex flex-col h-full px-6 pt-16 fade-in">
      <div className="text-5xl mb-5 text-center">👤</div>
      <h2 className="text-2xl font-black text-white text-center mb-2">What's your name?</h2>
      <p className="text-textSecondary text-center mb-8">This shows on the leaderboard so friends can see your rank.</p>
      <input
        type="text"
        placeholder="Display name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleName()}
        autoFocus
        maxLength={30}
        className="mb-4"
      />
      <button onClick={handleName} disabled={!name.trim()} className="btn-primary w-full">Continue</button>
    </div>,

    // 2 — Notifications
    <div key="notifs" className="flex flex-col h-full px-6 pt-16 fade-in">
      <div className="text-5xl mb-5 text-center">🔔</div>
      <h2 className="text-2xl font-black text-white text-center mb-2">Stay on track</h2>
      <p className="text-textSecondary text-center mb-8 leading-relaxed">
        LevelUp can remind you to complete your daily actions at the times you choose.
        Your data never leaves your device.
      </p>
      {notifStatus === 'granted' && (
        <div className="bg-success/20 border border-success rounded-xl p-4 mb-4 text-center text-success font-semibold">
          Notifications enabled ✓
        </div>
      )}
      {notifStatus === 'denied' && (
        <div className="bg-warning/20 border border-warning rounded-xl p-4 mb-4 text-center text-warning font-semibold">
          Denied — you can enable later in Settings
        </div>
      )}
      {!notifStatus && (
        <>
          <button onClick={handleNotifRequest} className="btn-primary w-full mb-3">Enable Notifications</button>
          <button onClick={handleSkipNotif} className="text-textSecondary text-[15px] py-3 w-full">Skip for now</button>
        </>
      )}
    </div>,

    // 3 — How it works
    <div key="how" className="flex flex-col h-full px-6 pt-12 fade-in">
      <h2 className="text-2xl font-black text-white text-center mb-8">How it works</h2>
      {[
        { icon: '🎯', title: 'Set goals', desc: 'Create goals with daily actions you commit to doing.' },
        { icon: '✅', title: 'Check in daily', desc: 'Complete actions and habits every day to earn XP.' },
        { icon: '🏆', title: 'Climb the leaderboard', desc: 'Your consistency score ranks you against friends.' },
      ].map(item => (
        <div key={item.title} className="flex gap-4 mb-6">
          <span className="text-3xl flex-shrink-0">{item.icon}</span>
          <div>
            <div className="font-bold text-white text-[16px] mb-0.5">{item.title}</div>
            <div className="text-textSecondary text-[14px] leading-relaxed">{item.desc}</div>
          </div>
        </div>
      ))}
      <div className="flex-1" />
      <button onClick={onDone} className="btn-primary w-full mb-6">Let's Go!</button>
    </div>,
  ];

  return (
    <div className="flex flex-col h-full bg-bg max-w-app mx-auto">
      <div className="flex-1 flex flex-col overflow-hidden">
        {steps[step]}
      </div>
      {/* Step dots */}
      <div className="flex justify-center gap-2 pb-8 flex-shrink-0">
        {steps.map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>
    </div>
  );
}
