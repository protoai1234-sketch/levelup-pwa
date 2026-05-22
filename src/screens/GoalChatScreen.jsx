import { useState, useRef, useEffect } from 'react';
import {
  insertGoal, insertAction, updateGoal, deleteActionsForGoal, getActionsForGoal,
} from '../utils/storage';
import { scheduleActionNotifications, cancelNotifications } from '../utils/notifications';
import { sendGoalChat, buildGoalFromConversation, READY_TRIGGER } from '../utils/claude';
import { todayString } from '../utils/dateHelpers';
import { TRAITS } from '../constants';

const GREETING = "Hey! 👋 I'm your LevelUp goal coach. I'll help you set up a goal that actually gets done.\n\nWhat's the goal you want to crush? Tell me what area of your life you want to level up. 🎯";

function buildEditGreeting(goal, actions) {
  const list = actions.length > 0
    ? actions.map(a => `• ${a.name}`).join('\n')
    : '(no actions yet)';
  return `I'm looking at your current goal: **${goal.title}**\n\n${goal.description ? goal.description + '\n\n' : ''}Daily actions:\n${list}\n\nWhat would you like to change? I can update the timeline, add or remove actions, adjust workout days, change targets, or rebuild it from scratch.`;
}

function buildGoalContext(goal, actions) {
  return `CONTEXT — I am editing an existing goal. Current configuration:\n\nTitle: ${goal.title}\nDescription: ${goal.description || '(none)'}\nType: ${goal.goalType}\nEnd date: ${goal.endDate}\nActive days: ${JSON.stringify(goal.activeDays)}\n\nCurrent daily actions:\n${actions.map(a => `- ${a.name} (${a.pointValue}pts)`).join('\n')}\n\nThe user wants to make changes to this goal.`;
}

// Anthropic requires messages to start with a user turn.
// In edit mode, prepend a hidden context exchange so the AI knows the existing goal.
function toApiMessages(msgs, isEditMode, editGoal, editActions) {
  const first = msgs.findIndex(m => m.role === 'user');
  if (first === -1) return [];
  const slice = msgs.slice(first).map(({ role, content }) => ({ role, content }));

  if (isEditMode && editGoal) {
    return [
      { role: 'user', content: buildGoalContext(editGoal, editActions) },
      { role: 'assistant', content: "Got it — I have your current goal loaded and I'm ready to help you update it." },
      ...slice,
    ];
  }
  return slice;
}

function validateGoalData(raw) {
  const today = todayString();
  const d90 = new Date();
  d90.setDate(d90.getDate() + 90);
  const ninetyDays = `${d90.getFullYear()}-${String(d90.getMonth()+1).padStart(2,'0')}-${String(d90.getDate()).padStart(2,'0')}`;
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
      <div className={`max-w-[82%] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
        isAI
          ? 'bg-card border border-border rounded-2xl rounded-tl-sm text-textPrimary'
          : 'bg-primary rounded-2xl rounded-tr-sm text-white'
      }`}>
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
          <span key={i} className="w-2 h-2 rounded-full bg-textSecondary inline-block"
            style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

export default function GoalChatScreen({ onBack, onGoalCreated, editGoalId, editGoal }) {
  const isEditMode = !!editGoalId;

  // Fetch existing actions once on mount when in edit mode
  const [editActions] = useState(() => isEditMode ? getActionsForGoal(editGoalId) : []);

  const initialMessage = isEditMode && editGoal
    ? buildEditGreeting(editGoal, editActions)
    : GREETING;

  const [messages, setMessages] = useState([{ role: 'assistant', content: initialMessage }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildingStep, setBuildingStep] = useState('');
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, building]);

  function getApiMessages(msgs) {
    return toApiMessages(msgs, isEditMode, editGoal, editActions);
  }

  // Build (or rebuild) the goal using a known messages array to avoid stale state closures.
  async function executeBuild(apiMessages) {
    setBuilding(true);
    setBuildingStep('Building your goal…');
    setError(null);

    try {
      const raw = await buildGoalFromConversation(apiMessages);
      setBuildingStep('Saving your goal…');
      const goal = validateGoalData(raw);

      if (isEditMode) {
        // Cancel old notifications and wipe old actions before writing new ones
        const oldActions = getActionsForGoal(editGoalId);
        for (const a of oldActions) cancelNotifications(a.notificationIds || []);
        deleteActionsForGoal(editGoalId);

        updateGoal(editGoalId, {
          title: goal.title,
          description: goal.description,
          goalType: goal.goalType,
          traits: goal.traits,
          startDate: goal.startDate,
          endDate: goal.endDate,
          activeDays: goal.activeDays,
          weeklyPlan: goal.weeklyPlan,
          vacationDays: [],
        });

        for (const action of goal.dailyActions) {
          const notifIds = action.notificationEnabled && action.notificationTime
            ? scheduleActionNotifications(action.name, goal.activeDays, action.notificationTime)
            : [];
          insertAction({
            goalId: editGoalId,
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
      } else {
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
      }

      onGoalCreated();
    } catch (e) {
      setError(e.message || 'Failed to build goal. Please try again.');
      setBuilding(false);
      setBuildingStep('');
    }
  }

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
      const reply = await sendGoalChat(getApiMessages(next));

      // Detect the auto-trigger phrase
      const triggered = reply.includes(READY_TRIGGER);
      const displayText = reply.replace(READY_TRIGGER, '').trim();

      const withReply = [...next, { role: 'assistant', content: displayText }];
      setMessages(withReply);
      setLoading(false);

      if (triggered) {
        await executeBuild(getApiMessages(withReply));
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Tap Retry to try again.');
      setLoading(false);
    }
  }

  function handleRetry() {
    setError(null);
    if (building) {
      executeBuild(getApiMessages(messages));
    } else {
      const lastUserIdx = messages.map(m => m.role).lastIndexOf('user');
      if (lastUserIdx !== -1) {
        setInput(messages[lastUserIdx].content);
        setMessages(prev => prev.slice(0, lastUserIdx));
      }
    }
  }

  const headerTitle = isEditMode ? 'Edit Goal with AI' : 'AI Goal Coach';

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
          <span className="flex-1 text-textPrimary font-bold text-center text-[16px]">{headerTitle}</span>
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

        {/* Building progress — shown automatically when AI triggers generation */}
        {building && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-border bg-card flex items-center justify-center gap-3">
            <div className="spinner" />
            <span className="text-textSecondary text-[14px] font-semibold">{buildingStep}</span>
          </div>
        )}

        {/* Input — hidden while building */}
        {!building && (
          <div className="flex-shrink-0 bg-card border-t border-border px-4 py-3 safe-bottom">
            <div className="flex gap-2 items-center">
              <input
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
