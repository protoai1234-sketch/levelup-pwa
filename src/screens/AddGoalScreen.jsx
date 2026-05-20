import { useState, useEffect } from 'react';
import { insertGoal, updateGoal, getActionsForGoal, deleteActionsForGoal, insertAction } from '../utils/storage';
import { scheduleActionNotifications, cancelNotifications } from '../utils/notifications';
import { todayString, formatTime } from '../utils/dateHelpers';
import { TRAITS, CHIP_TO_JS_DAY, CHIP_LABELS } from '../constants';
import MiniCalendar from '../components/MiniCalendar';

function ActionField({ index, action, onChange, onRemove, canRemove }) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border mb-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold text-textSecondary">Action {index + 1}</span>
        {canRemove && <button onClick={onRemove} className="text-[13px] font-semibold text-warning">Remove</button>}
      </div>
      <input type="text" placeholder="Action name (e.g. Read 10 pages)" value={action.name}
        onChange={e => onChange({ ...action, name: e.target.value })} className="mb-2" />
      <input type="number" placeholder="Points (default 30)" value={action.pointValue}
        onChange={e => onChange({ ...action, pointValue: e.target.value })} className="mb-2" />
      <button
        onClick={() => onChange({ ...action, notifEnabled: !action.notifEnabled, showNotifPicker: false })}
        className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-[13px] font-semibold transition-colors ${
          action.notifEnabled ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-input text-textSecondary'
        }`}
      >
        🔔 {action.notifEnabled ? `Reminder at ${formatTime(action.notifTime)}` : 'Add daily reminder'}
      </button>
      {action.notifEnabled && (
        <div className="mt-2">
          <label className="field-label">Reminder time</label>
          <input type="time" value={action.notifTime}
            onChange={e => onChange({ ...action, notifTime: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function blankAction() {
  return { name: '', pointValue: '30', notifEnabled: false, notifTime: '09:00' };
}

export default function AddGoalScreen({ existingGoal, onBack }) {
  const isEditing = Boolean(existingGoal);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [traits, setTraits] = useState([]);
  const [activeDays, setActiveDays] = useState([]);
  const [startDate, setStartDate] = useState(todayString());
  const [endDate, setEndDate] = useState('');
  const [actions, setActions] = useState([blankAction()]);
  const [vacationDays, setVacationDays] = useState([]);
  const [showVacation, setShowVacation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existingGoal) return;
    setTitle(existingGoal.title);
    setDescription(existingGoal.description || '');
    setTraits(Array.isArray(existingGoal.traits) ? existingGoal.traits : JSON.parse(existingGoal.traits || '[]'));
    setActiveDays(Array.isArray(existingGoal.activeDays) ? existingGoal.activeDays : JSON.parse(existingGoal.activeDays || '[]'));
    setStartDate(existingGoal.startDate);
    setEndDate(existingGoal.endDate);
    setVacationDays(Array.isArray(existingGoal.vacationDays) ? existingGoal.vacationDays : JSON.parse(existingGoal.vacationDays || '[]'));
    const dbActions = getActionsForGoal(existingGoal.id);
    if (dbActions.length > 0) {
      setActions(dbActions.map(a => ({
        name: a.name,
        pointValue: String(a.pointValue),
        notifEnabled: Boolean(a.notificationEnabled),
        notifTime: a.notificationTime || '09:00',
      })));
    }
  }, []);

  function toggleTrait(t) { setTraits(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]); }
  function toggleDay(i) {
    const jsDay = CHIP_TO_JS_DAY[i];
    setActiveDays(prev => prev.includes(jsDay) ? prev.filter(d => d !== jsDay) : [...prev, jsDay]);
  }
  function toggleVacation(d) { setVacationDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); }
  function updateAction(i, val) { setActions(prev => prev.map((a, idx) => idx === i ? val : a)); }
  function removeAction(i) { setActions(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleSave() {
    setError('');
    if (!title.trim())            return setError('Please enter a goal title.');
    if (!endDate)                  return setError('Please set an end date.');
    if (!activeDays.length)        return setError('Select at least one active day.');
    const validActions = actions.filter(a => a.name.trim());
    if (!validActions.length)      return setError('Add at least one daily action.');

    setSaving(true);
    try {
      if (isEditing) {
        const existingActions = getActionsForGoal(existingGoal.id);
        for (const ea of existingActions) cancelNotifications(ea.notificationIds || []);
        updateGoal(existingGoal.id, { title: title.trim(), description: description.trim(), startDate, endDate, activeDays, vacationDays, traits });
        deleteActionsForGoal(existingGoal.id);
        for (const a of validActions) {
          const notifIds = a.notifEnabled && a.notifTime
            ? scheduleActionNotifications(a.name.trim(), activeDays, a.notifTime) : [];
          insertAction({ goalId: existingGoal.id, name: a.name.trim(), pointValue: parseInt(a.pointValue, 10) || 30,
            notificationEnabled: a.notifEnabled, notificationTime: a.notifEnabled ? a.notifTime : null, notificationIds: notifIds });
        }
      } else {
        const goalId = insertGoal({ title: title.trim(), description: description.trim(), startDate, endDate, activeDays, vacationDays, traits });
        for (const a of validActions) {
          const notifIds = a.notifEnabled && a.notifTime
            ? scheduleActionNotifications(a.name.trim(), activeDays, a.notifTime) : [];
          insertAction({ goalId, name: a.name.trim(), pointValue: parseInt(a.pointValue, 10) || 30,
            notificationEnabled: a.notifEnabled, notificationTime: a.notifEnabled ? a.notifTime : null, notificationIds: notifIds });
        }
      }
      onBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const markedVacation = {};
  vacationDays.forEach(d => { markedVacation[d] = true; });

  return (
    <div className="flex flex-col h-full">
      {/* Nav */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={onBack} className="text-primary font-semibold text-[15px]">‹ Goals</button>
        <span className="flex-1 text-textPrimary font-bold text-center">{isEditing ? 'Edit Goal' : 'New Goal'}</span>
        <span className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-10">
          {error && <div className="bg-destructive/20 border border-destructive rounded-xl p-3 mb-4 text-[14px] text-destructive font-semibold">{error}</div>}

          <label className="field-label">Goal Title *</label>
          <input type="text" placeholder="e.g. Read 20 books this year" value={title} onChange={e => setTitle(e.target.value)} className="mb-1" />

          <label className="field-label">Description</label>
          <textarea placeholder="What does success look like?" value={description} onChange={e => setDescription(e.target.value)}
            rows={3} className="mb-1 resize-none" />

          <label className="field-label">Trait Tags</label>
          <div className="flex flex-wrap gap-2 mb-1">
            {TRAITS.map(t => (
              <button key={t} onClick={() => toggleTrait(t)} className={`chip ${traits.includes(t) ? 'chip-active' : ''}`}>{t}</button>
            ))}
          </div>

          <label className="field-label">Active Days *</label>
          <div className="flex gap-2 mb-1">
            {CHIP_LABELS.map((lbl, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-[14px] transition-colors
                  ${activeDays.includes(CHIP_TO_JS_DAY[i]) ? 'bg-primary border-primary text-white' : 'border-border text-textSecondary bg-input'}`}
              >{lbl}</button>
            ))}
          </div>

          <label className="field-label">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mb-1" />

          <label className="field-label">End Date *</label>
          <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="mb-1" />

          <label className="field-label">Daily Actions *</label>
          {actions.map((action, i) => (
            <ActionField key={i} index={i} action={action}
              onChange={val => updateAction(i, val)}
              onRemove={() => removeAction(i)}
              canRemove={actions.length > 1} />
          ))}
          <button onClick={() => setActions(prev => [...prev, blankAction()])} className="dashed-btn w-full mb-2">
            + Add Another Action
          </button>

          {/* Vacation days */}
          <div className="flex items-center justify-between py-3 border-t border-border mt-2">
            <div>
              <div className="field-label !mt-0 !mb-0">Vacation / Pause Days</div>
              <div className="text-[12px] text-textMuted mt-0.5">
                {vacationDays.length > 0 ? `${vacationDays.length} day(s) paused` : 'No days paused'}
              </div>
            </div>
            <button onClick={() => setShowVacation(v => !v)} className="border-2 border-primary rounded-lg px-3.5 py-1.5 text-primary font-bold text-[13px]">
              {showVacation ? 'Hide' : 'Pick Days'}
            </button>
          </div>
          {showVacation && (
            <div className="mb-3">
              <MiniCalendar markedDates={markedVacation} onDayPress={toggleVacation} />
              {vacationDays.length > 0 && (
                <button onClick={() => setVacationDays([])} className="text-warning text-[14px] font-semibold w-full text-center py-2">
                  Clear all paused days
                </button>
              )}
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className={`btn-primary w-full mt-4 ${saving ? 'opacity-50' : ''}`}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}
