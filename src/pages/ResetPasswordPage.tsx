import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword,
    [password, confirmPassword],
  );

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("As senhas devem ser iguais e ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Senha atualizada com sucesso.");
    setLoading(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={handleUpdate} className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Redefinir Senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina uma nova senha para sua conta.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Nova senha</label>
          <input
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Confirmar nova senha</label>
          <input
            type="password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Atualizar senha"}
        </button>
      </form>
    </div>
  );
}
