import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { getNotificationPermission, getPushSubscriptionStatus, debugPushSubscription } from '../utils/notifications';

export default function SettingsScreen({ onBack }) {
  const { session, profile, signOut, fetchProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState('');
  const [notifPerm, setNotifPerm] = useState('default');
  const [pushStatus, setPushStatus] = useState('checking');
  const [debugSteps, setDebugSteps] = useState(null);
  const [debugRunning, setDebugRunning] = useState(false);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
    setNotifPerm(getNotificationPermission());
    getPushSubscriptionStatus().then(setPushStatus);
  }, [profile]);

  async function handleSaveName() {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSaving(true);
    setNameError('');
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        display_name: trimmed,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await fetchProfile(session.user.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setNameError(e.message || 'Failed to save name.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDebugPush() {
    setDebugSteps([]);
    setDebugRunning(true);
    await debugPushSubscription(step => {
      setDebugSteps(prev => [...prev, step]);
    });
    setDebugRunning(false);
    getPushSubscriptionStatus().then(setPushStatus);
  }

  const permColor = {
    granted: 'text-success', denied: 'text-destructive',
    default: 'text-textSecondary', unsupported: 'text-textMuted',
  };
  const permLabel = {
    granted: 'Enabled', denied: 'Denied — open system settings to enable',
    default: 'Not yet requested', unsupported: 'Not supported on this device',
  };
  const pushColor = {
    active: 'text-success', inactive: 'text-destructive',
    unsupported: 'text-textMuted', error: 'text-destructive', checking: 'text-textMuted',
  };
  const pushLabel = {
    active: 'Active', inactive: 'Not registered',
    unsupported: 'Requires home screen install', error: 'Error', checking: 'Checking…',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={onBack} className="text-primary font-semibold text-[15px]">‹ Stats</button>
        <span className="flex-1 text-textPrimary font-bold text-center">Settings</span>
        <span className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-10">

          {/* Profile */}
          <div className="card mb-4">
            <div className="section-label">Profile</div>
            {session?.user?.email && (
              <div className="flex items-center justify-between py-2 border-b border-border mb-3">
                <span className="text-[14px] text-textSecondary">Email</span>
                <span className="text-[14px] font-semibold text-textPrimary truncate ml-4 text-right">{session.user.email}</span>
              </div>
            )}
            <label className="field-label">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setSaved(false); setNameError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              placeholder="Your name (shown on leaderboard)"
              maxLength={30}
              className="mb-3"
            />
            {nameError && (
              <p className="text-destructive text-[13px] font-semibold mb-2">{nameError}</p>
            )}
            <button
              onClick={handleSaveName}
              disabled={!displayName.trim() || saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving && <span className="spinner !w-4 !h-4" />}
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Name'}
            </button>
          </div>

          {/* Notifications */}
          <div className="card mb-4">
            <div className="section-label">Notifications</div>

            <div className="flex items-center justify-between py-2">
              <span className="text-[14px] text-textSecondary">Permission</span>
              <span className={`text-[14px] font-semibold ${permColor[notifPerm] || 'text-textSecondary'}`}>
                {permLabel[notifPerm] || notifPerm}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-[14px] text-textSecondary">Push delivery</span>
              <span className={`text-[14px] font-semibold ${pushColor[pushStatus] || 'text-textSecondary'}`}>
                {pushLabel[pushStatus] || pushStatus}
              </span>
            </div>

            <button
              onClick={handleDebugPush}
              disabled={debugRunning}
              className="mt-3 w-full rounded-xl border border-border py-2.5 text-[14px] font-semibold text-textPrimary flex items-center justify-center gap-2 active:opacity-70"
            >
              {debugRunning && <span className="spinner !w-4 !h-4 flex-shrink-0" />}
              {debugRunning ? 'Running…' : 'Debug Push'}
            </button>

            {debugSteps !== null && (
              <div className="mt-3 rounded-xl bg-bg border border-border overflow-hidden">
                {debugSteps.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 px-3 py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <span className={`text-[15px] flex-shrink-0 leading-snug font-bold ${s.ok ? 'text-success' : 'text-destructive'}`}>
                      {s.ok ? '✓' : '✗'}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-[13px] font-semibold leading-snug ${s.ok ? 'text-textPrimary' : 'text-destructive'}`}>
                        {s.label}
                      </div>
                      {s.detail ? (
                        <div className="text-[11px] text-textMuted font-mono mt-0.5 break-all leading-relaxed">
                          {s.detail}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {debugRunning && (
                  <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border">
                    <span className="spinner !w-3 !h-3 flex-shrink-0" />
                    <span className="text-[12px] text-textMuted">Running next step…</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* About */}
          <div className="card mb-4">
            <div className="section-label">About</div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[14px] text-textSecondary">App</span>
              <span className="text-[14px] font-semibold text-textPrimary">LevelUp</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-[14px] text-textSecondary">Version</span>
              <span className="text-[14px] font-semibold text-textPrimary">2.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-[14px] text-textSecondary">Data storage</span>
              <span className="text-[14px] font-semibold text-textPrimary">Supabase cloud</span>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={signOut}
            className="w-full border-2 border-destructive rounded-xl py-3.5 text-destructive font-bold text-[15px]"
          >
            Sign Out
          </button>

        </div>
      </div>
    </div>
  );
}
