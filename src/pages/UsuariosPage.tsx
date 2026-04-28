import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";
import { UserPlus, KeyRound, Shield, Power, Download, Printer, Users, Trash2 } from "lucide-react";
import { ContactActionButton } from "@/components/ContactActionButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { TableRowSkeleton } from "@/components/PageSkeleton";
import { useConfirm } from "@/hooks/useConfirm";
import { useAuth } from "@/hooks/useAuth";

const roleLabels: Record<string, string> = {
  gestor_master: "Gestor Master",
  coordenador: "Coordenador",
  profissional: "Profissional de Saúde",
};

export default function UsuariosPage() {
  const sb = supabase as any;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    password: "",
    role: "profissional",
    professional_id: "",
  });

  const { data: users = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["users-admin"],
    queryFn: async () => {
      const { data, error } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["users-admin-professionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, nome, user_id, telefone")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const professionalMap = useMemo(
    () => Object.fromEntries(professionals.map((p: any) => [p.id, p.nome])),
    [professionals],
  );

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.functions.invoke("user-admin", {
        body: {
          action: "create_user",
          ...form,
          professional_id: form.role === "profissional" ? form.professional_id : null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // NEVER log password
      await logAudit('Usuário criado', 'usuarios', {
        email: form.email,
        nome: form.nome,
        role: form.role,
        professional_id: form.role === "profissional" ? form.professional_id : null,
      });
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso.");
      setForm({ nome: "", email: "", password: "", role: "profissional", professional_id: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["users-admin"] });
      qc.invalidateQueries({ queryKey: ["users-admin-professionals"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao criar usuário."),
  });

  const resetPassword = useMutation({
    mutationFn: async (userId: string) => {
      const newPassword = window.prompt("Defina a nova senha (mín. 8 caracteres):");
      if (!newPassword) return;

      const { data, error } = await sb.functions.invoke("user-admin", {
        body: { action: "reset_password", user_id: userId, new_password: newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const target = users.find((u: any) => u.user_id === userId || u.id === userId);
      // NEVER log the new password — just track who reset whose
      await logAudit('Senha redefinida', 'usuarios', { user_id: userId, alvo_email: target?.email, alvo_nome: target?.nome });
    },
    onSuccess: () => toast.success("Senha redefinida com sucesso."),
    onError: (error: any) => toast.error(error.message ?? "Erro ao redefinir senha."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { data, error } = await sb.functions.invoke("user-admin", {
        body: { action: "set_active", user_id: userId, active },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const target = users.find((u: any) => u.user_id === userId || u.id === userId);
      await logAudit(active ? 'Usuário ativado' : 'Usuário inativado', 'usuarios', {
        user_id: userId, alvo_email: target?.email, alvo_nome: target?.nome, novo_status: active ? 'ativo' : 'inativo',
      });
    },
    onSuccess: () => {
      toast.success("Status do usuário atualizado.");
      qc.invalidateQueries({ queryKey: ["users-admin"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao atualizar status."),
  });

  const changeRole = useMutation({
    mutationFn: async ({ profileId, currentRole, newRole }: { profileId: string; currentRole: string; newRole: string }) => {
      if (currentRole === 'gestor_master' && newRole !== 'gestor_master') {
        throw new Error('Não é possível rebaixar outro Gestor Master.');
      }
      // Update profile role
      const { error: profErr } = await supabase.from('profiles').update({ role: newRole as any }).eq('id', profileId);
      if (profErr) throw profErr;
      // Also update user_roles table
      const user = users.find((u: any) => u.id === profileId);
      if (user?.user_id) {
        const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', user.user_id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from('user_roles').insert({ user_id: user.user_id, role: newRole as any });
        if (insErr) throw insErr;
      }
      await logAudit('Permissão alterada', 'usuarios', { profileId, alvo_email: user?.email, alvo_nome: user?.nome, role_anterior: currentRole, role_novo: newRole });
    },
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["users-admin"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao alterar perfil."),
  });

  const availableProfessionals = professionals.filter((p: any) => !p.user_id || p.id === form.professional_id);

  const exportarUsuariosCSV = () => {
    if (!users.length) { toast.info('Nenhum usuário para exportar.'); return; }
    const headers = ['Nome', 'E-mail', 'Perfil', 'Status'];
    const rows = (users as any[]).map((u) => [
      u.nome || '', u.email || '', roleLabels[u.role] || u.role || '',
      u.ativo === false ? 'Inativo' : 'Ativo',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = '\ufeff' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success(`${users.length} usuários exportados.`);
    logAudit('Usuários exportados (CSV)', 'usuarios', { total: users.length });
  };

  const imprimirListaUsuarios = () => {
    if (!users.length) { toast.info('Nenhum usuário para imprimir.'); return; }
    const w = window.open('', '_blank');
    if (!w) { toast.error('Bloqueio de pop-up. Permita janelas para imprimir.'); return; }
    const linhas = (users as any[]).map((u) => `
      <tr><td>${u.nome || ''}</td><td>${u.email || ''}</td>
      <td>${roleLabels[u.role] || u.role || ''}</td>
      <td>${u.ativo === false ? 'Inativo' : 'Ativo'}</td></tr>`).join('');
    w.document.write(`<html><head><title>Usuários</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a}
      h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#64748b;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f1f5f9}</style></head><body>
      <h1>Usuários do sistema</h1>
      <p>Total: ${users.length} · Emitido em ${new Date().toLocaleString('pt-BR')}</p>
      <table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script>
      </body></html>`);
    w.document.close();
    logAudit('Lista de usuários impressa', 'usuarios', { total: users.length });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="module-title">Controle de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">Somente Gestor Master pode criar contas e redefinir senhas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" /> Novo Usuário
          </button>
          <MoreActionsMenu
            triggerClassName="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            items={[
              { id: 'exp', label: 'Exportar CSV', icon: <Download />, onClick: exportarUsuariosCSV, group: 'Documentos' },
              { id: 'print', label: 'Imprimir lista', icon: <Printer />, onClick: imprimirListaUsuarios, group: 'Documentos' },
            ]}
          />
        </div>
      </div>

      {isError ? (
        <ErrorState
          title="Não foi possível carregar os usuários"
          description="Erro ao consultar a lista de usuários. Tente novamente."
          onRetry={() => refetch()}
          retryLoading={isRefetching}
        />
      ) : (
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="p-3 text-left">Nome</th>
              <th className="p-3 text-left">E-mail</th>
              <th className="p-3 text-left">Perfil</th>
              <th className="p-3 text-left">Profissional</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-0"><TableRowSkeleton cols={6} /></td></tr>
                ))}
              </>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState
                    icon={Users}
                    title="Nenhum usuário cadastrado"
                    description="Cadastre o primeiro usuário de acesso ao sistema."
                    action={{ label: "Novo usuário", onClick: () => setOpen(true) }}
                    className="border-0 rounded-none"
                  />
                </td>
              </tr>
            ) : (
              users.map((u: any) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-medium text-foreground">{u.nome}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole.mutate({ profileId: u.id, currentRole: u.role, newRole: e.target.value })}
                      disabled={changeRole.isPending}
                      className="rounded-lg border border-border bg-muted px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      <option value="gestor_master">Gestor Master</option>
                      <option value="coordenador">Coordenador</option>
                      <option value="profissional">Profissional de Saúde</option>
                    </select>
                  </td>
                  <td className="p-3 text-muted-foreground">{u.profissional_id ? professionalMap[u.profissional_id] ?? "—" : "—"}</td>
                  <td className="p-3">
                    <span className={`status-badge ${u.ativo ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const resetting = resetPassword.isPending && (resetPassword.variables as any) === u.user_id;
                        const toggling = toggleActive.isPending && (toggleActive.variables as any)?.userId === u.user_id;
                        return (
                          <>
                            <button
                              onClick={() => { if (!resetPassword.isPending) resetPassword.mutate(u.user_id); }}
                              disabled={resetPassword.isPending}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <KeyRound className="h-3.5 w-3.5" /> {resetting ? 'Enviando...' : 'Senha'}
                            </button>
                            <button
                              onClick={() => { if (!toggleActive.isPending) toggleActive.mutate({ userId: u.user_id, active: !u.ativo }); }}
                              disabled={toggleActive.isPending}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Power className="h-3.5 w-3.5" /> {toggling ? '...' : (u.ativo ? "Inativar" : "Ativar")}
                            </button>
                          </>
                        );
                      })()}
                      {u.role === 'profissional' && u.profissional_id && (
                        <ContactActionButton
                          profissional={{ nome: u.nome, telefone: professionals.find((p: any) => p.id === u.profissional_id)?.telefone }}
                          contexto={{ tipo: 'geral' }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Criar Usuário de Acesso
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createUser.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium text-foreground">Nome *</label>
              <input
                required
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">E-mail *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Senha inicial *</label>
              <input
                type="password"
                minLength={8}
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Perfil *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, professional_id: "" }))}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="gestor_master">Gestor Master</option>
                <option value="coordenador">Coordenador</option>
                <option value="profissional">Profissional de Saúde</option>
              </select>
            </div>

            {form.role === "profissional" && (
              <div>
                <label className="text-sm font-medium text-foreground">Vincular profissional *</label>
                <select
                  required
                  value={form.professional_id}
                  onChange={(e) => setForm((f) => ({ ...f, professional_id: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {availableProfessionals.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Cancelar
              </button>
              <button type="submit" disabled={createUser.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {createUser.isPending ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
