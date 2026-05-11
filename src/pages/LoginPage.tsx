import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canRecover = useMemo(() => email.trim().length > 0, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Credenciais inválidas ou usuário inativo.");
      setLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso.");
    setLoading(false);
    navigate("/");
  };

  const handleRecover = async () => {
    if (!canRecover) {
      toast.warning("Informe o e-mail para recuperação.");
      return;
    }

    setRecovering(true);
    const { error } = await resetPassword(email);
    if (error) toast.error(error.message);
    else toast.success("E-mail de recuperação enviado.");
    setRecovering(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">MedShift</h1>
          <p className="text-muted-foreground mt-1">Acesso restrito por perfil</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 shadow-[var(--shadow-elevated)] space-y-4">
          <h2 className="font-display text-xl font-semibold text-foreground text-center">Entrar no Sistema</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">E-mail</label>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border focus-within:ring-2 focus-within:ring-ring">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border focus-within:ring-2 focus-within:ring-ring">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={handleRecover}
            disabled={recovering}
            className="w-full flex items-center justify-center gap-2 border border-border py-2.5 rounded-lg font-medium text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {recovering ? "Enviando..." : "Recuperar senha"}
          </button>

          <p className="text-center text-xs text-muted-foreground">Usuários são criados exclusivamente por Gestor Master.</p>
        </form>
      </div>
    </div>
  );
}
