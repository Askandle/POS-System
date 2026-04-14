import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Auth] Error fetching profile:', error);
    return null;
  }
  return data;
}

async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await getProfile(user.id);
  if (existing) {
    console.log('[Auth] Profile found:', existing.username, '/', existing.role);
    return existing;
  }

  console.log('[Auth] No profile found, creating one for user:', user.id);

  const username = user.email?.replace('@miaoda.com', '') ?? user.id.slice(0, 8);

  const { count, error: countError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (countError) console.error('[Auth] Count error:', countError);

  const role = (count === 0 || count === null) ? 'admin' : 'staff';
  console.log('[Auth] Creating profile — username:', username, 'role:', role);

  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: user.id, username, role })
    .select()
    .maybeSingle();

  if (error) {
    console.error('[Auth] Insert profile error:', error);
    // Trigger may have created it already — try reading again
    return await getProfile(user.id);
  }

  console.log('[Auth] Profile created successfully:', data);
  return data;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) { setProfile(null); return; }
    const profileData = await getProfile(user.id);
    setProfile(profileData);
  };

  useEffect(() => {
    let isMounted = true;

    // ── Step 1: check if there is already a valid session ──────────────────
    const initAuth = async () => {
      try {
        console.log('[Auth] Checking existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) console.error('[Auth] getSession error:', error);
        console.log('[Auth] Session:', session ? `found (user: ${session.user.email})` : 'none');

        if (!isMounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const profileData = await ensureProfile(currentUser);
          if (isMounted) setProfile(profileData);
        }
      } catch (err) {
        console.error('[Auth] initAuth error:', err);
      } finally {
        if (isMounted) {
          console.log('[Auth] Initial auth check complete, loading = false');
          setLoading(false);
        }
      }
    };

    initAuth();

    // ── Step 2: keep watching for auth changes ─────────────────────────────
    // IMPORTANT: never use await inside this callback — use .then() only.
    // Supabase holds an internal lock during this callback and awaiting
    // another Supabase call here causes a deadlock that stalls the session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange event:', event, '| session:', session ? session.user.email : 'null');

      if (!isMounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        ensureProfile(currentUser)
          .then(profileData => { if (isMounted) setProfile(profileData); })
          .catch(err => console.error('[Auth] ensureProfile error:', err));
      } else {
        setProfile(null);
        // Make sure loading is cleared even on sign-out
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      console.log('[Auth] Signing in:', email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      console.log('[Auth] Signing up:', email);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      // Manually ensure profile exists because the DB trigger may not fire
      // when email confirmations are disabled (user is confirmed immediately
      // at INSERT time, so the AFTER UPDATE trigger never sees a change).
      if (data.user) {
        await ensureProfile(data.user);
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign up error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    console.log('[Auth] Signing out');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithUsername, signUpWithUsername, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}