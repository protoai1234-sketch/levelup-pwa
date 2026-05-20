import { useState, useEffect } from 'react';
import { getUser, saveUser } from '../utils/storage';
import { getNotificationPermission, getPushSubscriptionStatus } from '../utils/notifications';

export default function SettingsScreen({ onBack }) {
  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState(false);
  const [notifPerm, setNotifPerm] = useState('default');
  const [pushStatus, setPushStatus] = useState('checking');

  useEffect(() => {
    const u = getUser();
    if (u?.displayName) setDisplayName(u.displayName);
    setNotifPerm(getNotificationPermission());
    getPushSubscriptionStatus().then(setPushStatus);
  }, []);

  function handleSaveName() {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    const u = getUser();
    saveUser({ ...u, displayName: trimmed });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const permColor = {
    granted: 'text-success',
    denied: 'text-destructive',
    default: 'text-textSecondary',
    unsupported: 'text-textMuted',
  };
  const permLabel = {
    granted: 'Enabled',
    denied: 'Denied — open system settings to enable',
    default: 'Not yet requested',
    unsupported: 'Not supported on this device',
  };

  const pushColor = {
    active: 'text-success',
    inactive: 'text-destructive',
    unsupported: 'text-textMuted',
    error: 'text-destructive',
    checking: 'text-textMuted',
  };
  const pushLabel = {
    active: 'Active',
    inactive: 'Not registered',
    unsupported: 'Requires home screen install',
    error: 'Error — check console',
    checking: 'Checking…',
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
          {/* Display name */}
          <div className="card mb-4">
            <div className="section-label">Profile</div>
            <label className="field-label">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setSaved(false); }}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              placeholder="Your name"
              maxLength={30}
              className="mb-3"
            />
            <button onClick={handleSaveName} disabled={!displayName.trim()} className="btn-primary w-full">
              {saved ? 'Saved ✓' : 'Save Name'}
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
            {notifPerm === 'granted' && pushStatus === 'inactive' && (
              <p className="text-destructive text-[13px] mt-2 leading-relaxed">
                Push subscription failed. Check the browser console for [Push] log entries to diagnose the error.
              </p>
            )}
            {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
              <p className="text-textMuted text-[13px] mt-2 leading-relaxed">
                To enable notifications, open your browser or phone Settings and allow notifications for this site.
              </p>
            )}
            {pushStatus === 'unsupported' && (
              <p className="text-textMuted text-[13px] mt-2 leading-relaxed">
                Background push requires the app to be added to your home screen on iOS 16.4 or later.
              </p>
            )}
          </div>

          {/* App info */}
          <div className="card">
            <div className="section-label">About</div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[14px] text-textSecondary">App</span>
              <span className="text-[14px] font-semibold text-textPrimary">LevelUp</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-[14px] text-textSecondary">Version</span>
              <span className="text-[14px] font-semibold text-textPrimary">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-[14px] text-textSecondary">Data storage</span>
              <span className="text-[14px] font-semibold text-textPrimary">On this device</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
