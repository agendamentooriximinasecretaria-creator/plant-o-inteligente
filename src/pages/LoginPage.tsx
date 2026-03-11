import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Mail, Lock, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      // Try signup if login fails (first time setup)
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        toast.error('Erro: ' + signUpError.message);
        setLoading(false);
        return;
      }
      // Try login again after signup
      const { error: retryError } = await signIn(email, password);
      if (retryError) {
        toast.error('Erro ao fazer login: ' + retryError.message);
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    // Assign gestor_master role
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_roles').upsert({ user_id: user.id, role: 'gestor_master' as any }, { onConflict: 'user_id,role' });
    }
    toast.success('Login realizado com sucesso!');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary mb-4">
            <Activity className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">MedShift</h1>
          <p className="text-muted-foreground mt-1">Gestão de Plantões Hospitalares</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 shadow-[var(--shadow-elevated)] space-y-4">
          <h2 className="font-display text-xl font-semibold text-foreground text-center">Entrar no Sistema</h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">E-mail</label>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border focus-within:ring-2 focus-within:ring-ring">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="gestor@hospital.com" required className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border focus-within:ring-2 focus-within:ring-ring">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            <LogIn className="h-4 w-4" />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="text-center text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="font-medium">Primeiro acesso? Use qualquer e-mail e senha (mín. 6 caracteres).</p>
            <p>O sistema criará sua conta automaticamente.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
