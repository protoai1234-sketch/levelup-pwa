import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { setUserId } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) {
        setUserId(session.user.id);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (session) {
        setUserId(session.user.id);
        fetchProfile(session.user.id);
      } else {
        setUserId(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    if (data) setProfile(data);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
