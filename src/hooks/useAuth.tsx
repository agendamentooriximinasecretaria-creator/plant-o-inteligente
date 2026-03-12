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

  const loadProfile = async (userId: string): Promise<boolean> => {
    try {
      const sb = supabase as any;
      const { data: profile, error } = await sb
        .from('profiles')
        .select('role, profissional_id, ativo')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !profile || profile.ativo === false) {
        setRole(null);
        setProfessionalId(null);
        return false;
      }

      setRole(profile.role as UserRole);
      setProfessionalId((profile.profissional_id as string | null) ?? null);
      return true;
    } catch {
      setRole(null);
      setProfessionalId(null);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user?.id) {
        await loadProfile(currentSession.user.id);
      } else {
        setRole(null);
        setProfessionalId(null);
      }

      setIsReady(true);
    });

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user?.id) {
        await loadProfile(currentSession.user.id);
      }

      setIsReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfessionalId(null);
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
