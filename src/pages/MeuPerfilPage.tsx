import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function MeuPerfilPage() {
  const sb = supabase as any;
  const qc = useQueryClient();
  const { user } = useAuth();

  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const { data: professional, isLoading } = useQuery({
    queryKey: ["professional-my-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("nome, email, telefone, endereco, profissao, especialidade, registro")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!professional) return;
    setTelefone(professional.telefone || "");
    setEndereco(professional.endereco || "");
  }, [professional]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.functions.invoke("user-admin", {
        body: { action: "update_my_profile", telefone, endereco },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["professional-my-profile"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao atualizar perfil."),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (novaSenha.length < 8) throw new Error("Nova senha deve ter no mínimo 8 caracteres.");
      if (novaSenha !== confirmarSenha) throw new Error("As senhas não coincidem.");
      // Verify current password by re-signing in
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: senhaAtual });
      if (signInErr) throw new Error("Senha atual incorreta.");
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setSenhaAtual(""); setNovaSenha(""); setConfirmarSenha("");
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao alterar senha."),
  });

  const inputReadonly = "w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground";
  const inputEditable = "w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados da sua conta e informações profissionais.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
        ) : !professional ? (
          <p className="text-sm text-muted-foreground">Seu usuário ainda não está vinculado a um cadastro profissional.</p>
        ) : (
          <>
            <h2 className="text-base font-semibold text-foreground">Dados Profissionais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-foreground">Nome</label><input value={professional.nome} readOnly className={inputReadonly} /></div>
              <div><label className="text-sm font-medium text-foreground">E-mail</label><input value={professional.email || user?.email || ""} readOnly className={inputReadonly} /></div>
              <div><label className="text-sm font-medium text-foreground">Profissão</label><input value={professional.profissao} readOnly className={inputReadonly} /></div>
              <div><label className="text-sm font-medium text-foreground">Registro</label><input value={professional.registro || ""} readOnly className={inputReadonly} /></div>
              <div><label className="text-sm font-medium text-foreground">Especialidade</label><input value={professional.especialidade || ""} readOnly className={inputReadonly} /></div>
              <div>
                <label className="text-sm font-medium text-foreground">Telefone</label>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputEditable} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Endereço</label>
                <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className={inputEditable} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {updateProfile.isPending ? "Salvando..." : "Salvar dados"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Password change */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Alterar Senha
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">Senha atual</label>
            <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} className={inputEditable} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Nova senha</label>
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} minLength={8} className={inputEditable} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Confirmar nova senha</label>
            <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} className={inputEditable} />
          </div>
        </div>
        {novaSenha && novaSenha.length < 8 && <p className="text-xs text-destructive">Mínimo 8 caracteres.</p>}
        {confirmarSenha && novaSenha !== confirmarSenha && <p className="text-xs text-destructive">As senhas não coincidem.</p>}
        <div className="flex justify-end">
          <button onClick={() => changePassword.mutate()} disabled={changePassword.isPending || !senhaAtual || !novaSenha || novaSenha !== confirmarSenha || novaSenha.length < 8}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {changePassword.isPending ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </div>
    </div>
  );
}
