import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { KeyRound, Stamp, ShieldCheck } from "lucide-react";
import CarimboAssinaturaProfissional from "@/components/CarimboAssinaturaProfissional";
import { logAudit } from "@/lib/auditLog";

export default function MeuPerfilPage() {
  const sb = supabase as any;
  const qc = useQueryClient();
  const { user, isMaster, isCoordinator, role, profileName } = useAuth();
  const isManagerRole = isMaster || isCoordinator;

  const { data: myProfId, refetch: refetchProfId } = useQuery({
    queryKey: ["my-prof-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('professionals').select('id').eq('user_id', user?.id || '').maybeSingle();
      return (data as any)?.id || null;
    },
    enabled: !!user?.id,
  });

  // Cria uma "área institucional" (registro em professionals) para Gestor/Coordenador
  // que ainda não tem cadastro profissional, permitindo configurar carimbo/assinatura.
  const createInstitutional = useMutation({
    mutationFn: async () => {
      if (!user?.id || !user?.email) throw new Error("Sessão inválida.");
      const cargoFunc = isMaster ? "Gestor Master" : "Coordenador(a)";
      const payload: any = {
        user_id: user.id,
        nome: profileName || user.email.split("@")[0],
        email: user.email,
        profissao: "outro",
        status: "ativo",
        vinculo: "gestor_administrativo",
        observacoes: `Área institucional criada automaticamente para assinaturas (${cargoFunc}).`,
      };
      const { data, error } = await sb.from("professionals").insert(payload).select("id").single();
      if (error) throw error;
      // Vincula ao profile do usuário
      await sb.from("profiles").update({ profissional_id: data.id }).eq("user_id", user.id);
      await logAudit("criou_area_assinatura_institucional", "carimbo_digital", { professional_id: data.id, role });
      return data.id as string;
    },
    onSuccess: () => {
      toast.success("Área de assinatura institucional criada.");
      refetchProfId();
      qc.invalidateQueries({ queryKey: ["my-prof-id"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar área institucional."),
  });

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
          <p className="text-sm text-muted-foreground">
            {isManagerRole
              ? "Sua conta é de gestão (não clínica). Use a área de Assinatura Institucional abaixo para configurar carimbo, cargo, registro e dados institucionais."
              : "Seu usuário ainda não está vinculado a um cadastro profissional."}
          </p>
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

      {/* Carimbo e Assinatura Profissional */}
      {myProfId ? (
        <CarimboAssinaturaProfissional profissionalId={myProfId} isMaster={isMaster} isMyProfile={true} />
      ) : isManagerRole ? (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Stamp className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold text-foreground">Área de Assinatura Institucional</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Como <strong>{isMaster ? "Gestor Master" : "Coordenador(a)"}</strong>, você precisa de uma área própria para configurar carimbo, assinatura, cargo, função e dados institucionais — necessária para assinar aprovações de troca, escalas oficiais e demais documentos.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>
                  Será criado um cadastro institucional vinculado ao seu usuário (não é registro clínico). Você poderá editar nome, cargo, conselho, registro, CBO, unidade, setor, assinatura e carimbo nas abas do módulo.
                </span>
              </div>
              <button
                onClick={() => createInstitutional.mutate()}
                disabled={createInstitutional.isPending}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-sm"
              >
                <Stamp className="h-4 w-4" />
                {createInstitutional.isPending ? "Criando..." : "Criar minha área de assinatura institucional"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
