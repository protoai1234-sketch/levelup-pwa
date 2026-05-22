import { useState, useRef, useEffect } from 'react';
import { insertGoal, insertAction } from '../utils/storage';
import { scheduleActionNotifications } from '../utils/notifications';
import { sendGoalChat, buildGoalFromConversation } from '../utils/claude';
import { TRAITS } from '../constants';

const GREETING = "Hey! 👋 I'm your LevelUp goal coach. I'll help you set up a goal that actually gets done.\n\nWhat's the goal you want to crush? Tell me what area of your life you want to level up. 🎯";

// Anthropic requires messages to start with user role — drop any leading assistant messages
function toApiMessages(msgs) {
  const first = msgs.findIndex(m => m.role === 'user');
  if (first === -1) return [];
  return msgs.slice(first).map(({ role, content }) => ({ role, content }));
}

function validateGoalData(raw) {
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDays = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const validTypes = ['fitness', 'sales', 'nutrition', 'financial', 'habit', 'general'];

  return {
    title: String(raw.title || 'My Goal').slice(0, 100),
    description: String(raw.description || ''),
    goalType: validTypes.includes(raw.goalType) ? raw.goalType : 'general',
    traits: Array.isArray(raw.traits) ? raw.traits.filter(t => TRAITS.includes(t)) : [],
    startDate: raw.startDate || today,
    endDate: raw.endDate || ninetyDays,
    activeDays: Array.isArray(raw.activeDays) && raw.activeDays.length > 0 ? raw.activeDays : [1, 2, 3, 4, 5],
    dailyActions: Array.isArray(raw.dailyActions) && raw.dailyActions.length > 0
      ? raw.dailyActions.map(a => ({
          name: String(a.name || 'Daily action'),
          pointValue: Math.max(1, Math.min(500, parseInt(a.pointValue, 10) || 30)),
          notificationEnabled: !!a.notificationEnabled,
          notificationTime: a.notificationTime || '09:00',
          metricType: a.metricType === 'number' ? 'number' : 'checkbox',
          metricTarget: a.metricTarget != null ? parseFloat(a.metricTarget) : null,
          metricUnit: a.metricUnit || null,
          dayOfWeek: a.dayOfWeek != null ? parseInt(a.dayOfWeek, 10) : null,
        }))
      : [{ name: 'Daily check-in', pointValue: 20, notificationEnabled: false, notificationTime: '09:00', metricType: 'checkbox', metricTarget: null, metricUnit: null, dayOfWeek: null }],
    weeklyPlan: raw.weeklyPlan || { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null },
  };
}

function MessageBubble({ msg }) {
  const isAI = msg.role === 'assistant';
  return (
    <div className={`flex mb-3 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[82%] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
          isAI
            ? 'bg-card border border-border rounded-2xl rounded-tl-sm text-textPrimary'
            : 'bg-primary rounded-2xl rounded-tr-sm text-white'
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex mb-3 justify-start">
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-textSecondary inline-block"
            style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function GoalChatScreen({ onBack, onGoalCreated }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildingStep, setBuildingStep] = useState('');
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || building) return;

    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const raw = await sendGoalChat(toApiMessages(next));
      const ready = raw.includes('[READY_TO_BUILD]');
      const displayText = raw.replace('[READY_TO_BUILD]', '').trim();
      if (ready) setIsReady(true);
      setMessages(prev => [...prev, { role: 'assistant', content: displayText }]);
    } catch (e) {
      setError(e.message || 'Something went wrong. Tap Retry to try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBuild() {
    setBuilding(true);
    setError(null);
    setBuildingStep('Analyzing your conversation…');

    try {
      setBuildingStep('Generating goal structure…');
      const raw = await buildGoalFromConversation(toApiMessages(messages));

      setBuildingStep('Saving your goal…');
      const goal = validateGoalData(raw);

      const goalId = insertGoal({
        title: goal.title,
        description: goal.description,
        goalType: goal.goalType,
        traits: goal.traits,
        startDate: goal.startDate,
        endDate: goal.endDate,
        activeDays: goal.activeDays,
        vacationDays: [],
        weeklyPlan: goal.weeklyPlan,
      });

      for (const action of goal.dailyActions) {
        const notifIds = action.notificationEnabled && action.notificationTime
          ? scheduleActionNotifications(action.name, goal.activeDays, action.notificationTime)
          : [];
        insertAction({
          goalId,
          name: action.name,
          pointValue: action.pointValue,
          notificationEnabled: action.notificationEnabled,
          notificationTime: action.notificationEnabled ? action.notificationTime : null,
          notificationIds: notifIds,
          metricType: action.metricType,
          metricTarget: action.metricTarget,
          metricUnit: action.metricUnit,
          dayOfWeek: action.dayOfWeek,
        });
      }

      onGoalCreated();
    } catch (e) {
      setError('Failed to build goal: ' + (e.message || 'Unknown error. Please try again.'));
      setBuilding(false);
      setBuildingStep('');
    }
  }

  function handleRetry() {
    setError(null);
    if (isReady) {
      handleBuild();
    } else {
      const last = [...messages].reverse().find(m => m.role === 'user');
      if (last) {
        const trimmed = messages.slice(0, messages.lastIndexOf(last) + 1);
        setMessages(trimmed);
        setInput(last.content);
      }
    }
  }

  // Show build button when AI says ready, or after enough back-and-forth
  const userTurns = messages.filter(m => m.role === 'user').length;
  const showBuildButton = (isReady || userTurns >= 7) && !building && !loading;

  return (
    <>
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <button onClick={onBack} className="text-primary font-semibold text-[15px] w-16">‹ Back</button>
          <span className="flex-1 text-textPrimary font-bold text-center text-[16px]">AI Goal Coach</span>
          <span className="w-16" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {loading && <TypingBubble />}
          {error && (
            <div className="mb-3 bg-destructive/15 border border-destructive/40 rounded-xl p-3">
              <p className="text-destructive text-[13px] font-semibold mb-2">{error}</p>
              <button onClick={handleRetry} className="text-destructive text-[13px] font-bold border border-destructive/50 rounded-lg px-3 py-1">
                Retry
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Build button */}
        {showBuildButton && (
          <div className="flex-shrink-0 px-4 pt-2 pb-1 border-t border-border bg-card">
            <button
              onClick={handleBuild}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <span>✨</span>
              <span>Build my goal</span>
            </button>
          </div>
        )}

        {/* Building overlay */}
        {building && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-border bg-card flex items-center justify-center gap-3">
            <div className="spinner" />
            <span className="text-textSecondary text-[14px] font-semibold">{buildingStep}</span>
          </div>
        )}

        {/* Input */}
        {!building && (
          <div className="flex-shrink-0 bg-card border-t border-border px-4 py-3 safe-bottom">
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                placeholder={loading ? 'Thinking…' : 'Message'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={loading}
                style={{ width: 'auto', flex: 1 }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="bg-primary text-white font-bold text-[15px] rounded-xl px-4 py-2.5 flex-shrink-0 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
