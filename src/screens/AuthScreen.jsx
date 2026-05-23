import { useState } from 'react';
import { supabase } from '../utils/supabase';

export default function AuthScreen() {
  const [view, setView] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Sign up fields
  const [displayName, setDisplayName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Log in fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  function clearError() { setError(''); setResetSent(false); }

  async function handleSignUp(e) {
    e.preventDefault();
    clearError();
    if (!displayName.trim()) return setError('Please enter a display name.');
    if (!signupEmail.trim()) return setError('Please enter an email address.');
    if (signupPassword.length < 6) return setError('Password must be at least 6 characters.');
    if (signupPassword !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
      });
      if (authErr) throw authErr;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName.trim(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('An account with this email already exists. Try logging in.');
      } else if (msg.includes('weak') || msg.includes('password')) {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    clearError();
    if (!loginEmail.trim() || !loginPassword) return setError('Enter your email and password.');

    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (authErr) throw authErr;
      // onAuthStateChange in AuthContext handles session update
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid') || msg.includes('credentials') || msg.includes('password')) {
        setError('Wrong email or password. Please try again.');
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    clearError();
    if (!loginEmail.trim()) return setError('Enter your email above, then tap Forgot password.');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(loginEmail.trim());
      if (err) throw err;
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-bg overflow-y-auto flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mb-3 border border-border">
          <span className="text-[28px] font-black" style={{ color: '#FF6B00' }}>L</span>
        </div>
        <div className="text-[28px] font-black text-textPrimary">LevelUp</div>
        <div className="text-[14px] text-textSecondary mt-1">Turn your life into a game</div>
      </div>

      {/* Tab toggle */}
      <div className="flex bg-card border border-border rounded-xl p-1 mb-6 w-full max-w-[340px]">
        <button
          onClick={() => { setView('login'); clearError(); }}
          className={`flex-1 py-2 rounded-lg text-[14px] font-bold transition-colors ${
            view === 'login' ? 'bg-primary text-white' : 'text-textSecondary'
          }`}
        >Log In</button>
        <button
          onClick={() => { setView('signup'); clearError(); }}
          className={`flex-1 py-2 rounded-lg text-[14px] font-bold transition-colors ${
            view === 'signup' ? 'bg-primary text-white' : 'text-textSecondary'
          }`}
        >Sign Up</button>
      </div>

      {/* Card */}
      <div className="card w-full max-w-[340px]">
        {error && (
          <div className="bg-destructive/15 border border-destructive/40 rounded-xl px-3 py-2.5 mb-4 text-[13px] text-destructive font-semibold">
            {error}
          </div>
        )}
        {resetSent && (
          <div className="bg-success/15 border border-success/40 rounded-xl px-3 py-2.5 mb-4 text-[13px] text-success font-semibold">
            Reset email sent! Check your inbox.
          </div>
        )}

        {view === 'signup' ? (
          <form onSubmit={handleSignUp}>
            <label className="field-label">Display Name</label>
            <input
              type="text" placeholder="Your name (shown on leaderboard)"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
              maxLength={30} autoComplete="name" className="mb-1"
            />
            <label className="field-label">Email</label>
            <input
              type="email" placeholder="you@email.com"
              value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
              autoComplete="email" className="mb-1"
            />
            <label className="field-label">Password</label>
            <input
              type="password" placeholder="Min 6 characters"
              value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
              autoComplete="new-password" className="mb-1"
            />
            <label className="field-label">Confirm Password</label>
            <input
              type="password" placeholder="Repeat password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password" className="mb-5"
            />
            <button
              type="submit" disabled={loading}
              className="btn-primary w-full mb-3 flex items-center justify-center gap-2"
            >
              {loading && <span className="spinner !w-4 !h-4" />}
              {loading ? 'Creating account…' : 'Sign Up'}
            </button>
            <button
              type="button" onClick={() => { setView('login'); clearError(); }}
              className="w-full text-center text-[13px] text-textSecondary py-1"
            >
              Already have an account? <span className="text-primary font-bold">Log in</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <label className="field-label">Email</label>
            <input
              type="email" placeholder="you@email.com"
              value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
              autoComplete="email" className="mb-1"
            />
            <label className="field-label">Password</label>
            <input
              type="password" placeholder="Your password"
              value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              autoComplete="current-password" className="mb-5"
            />
            <button
              type="submit" disabled={loading}
              className="btn-primary w-full mb-3 flex items-center justify-center gap-2"
            >
              {loading && <span className="spinner !w-4 !h-4" />}
              {loading ? 'Logging in…' : 'Log In'}
            </button>
            <button
              type="button" onClick={handleForgotPassword} disabled={loading}
              className="w-full text-center text-[13px] text-primary font-semibold py-1 mb-1"
            >
              Forgot password?
            </button>
            <button
              type="button" onClick={() => { setView('signup'); clearError(); }}
              className="w-full text-center text-[13px] text-textSecondary py-1"
            >
              Don't have an account? <span className="text-primary font-bold">Sign up</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
