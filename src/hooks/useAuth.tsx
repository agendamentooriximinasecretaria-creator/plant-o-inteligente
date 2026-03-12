import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { UserRole } from '@/types/hospital';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isReady: boolean;
  role: UserRole | null;
  professionalId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isMaster: boolean;
  isCoordinator: boolean;
  isProfessional: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  const clearProfileState = () => {
    setRole(null);
    setProfessionalId(null);
  };

  const loadProfile = async (userId: string): Promise<boolean> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, profissional_id, ativo')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !profile || profile.ativo === false) {
        clearProfileState();
        return false;
      }

      setRole(profile.role as UserRole);
      setProfessionalId(profile.profissional_id ?? null);
      return true;
    } catch {
      clearProfileState();
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const applySession = async (currentSession: Session | null, finalizeReady = false) => {
      try {
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (!currentSession?.user?.id) {
          clearProfileState();
          return;
        }

        const hasProfile = await loadProfile(currentSession.user.id);
        if (!mounted) return;

        if (!hasProfile) {
          await supabase.auth.signOut();
          if (!mounted) return;

          setSession(null);
          setUser(null);
          clearProfileState();
        }
      } finally {
        if (finalizeReady && mounted) setIsReady(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === 'INITIAL_SESSION') return;
      void applySession(currentSession, true);
    });

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => applySession(currentSession, true))
      .catch(() => {
        if (!mounted) return;
        clearProfileState();
        setUser(null);
        setSession(null);
        setIsReady(true);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearProfileState();
  };

  const value = useMemo(() => ({
    user,
    session,
    isReady,
    role,
    professionalId,
    signIn,
    resetPassword,
    signOut,
    isMaster: role === 'gestor_master',
    isCoordinator: role === 'coordenador',
    isProfessional: role === 'profissional',
  }), [user, session, isReady, role, professionalId]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

