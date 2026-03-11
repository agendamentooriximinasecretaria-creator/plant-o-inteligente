import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function MeuPerfilPage() {
  const sb = supabase as any;
  const qc = useQueryClient();
  const { user } = useAuth();

  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");

  const { data: professional, isLoading } = useQuery({
    queryKey: ["professional-my-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("nome, email, telefone, endereco, profissao, especialidade, registro, valor_hora")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!professional) return;
    setTelefone(professional.telefone || "");
    setEndereco((professional as any).endereco || "");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados da sua conta e informações profissionais permitidas.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando perfil...</p>
        ) : !professional ? (
          <p className="text-sm text-muted-foreground">Seu usuário ainda não está vinculado a um cadastro profissional.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Nome</label>
                <input value={professional.nome} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">E-mail</label>
                <input value={professional.email || user?.email || ""} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Profissão</label>
                <input value={professional.profissao} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Registro</label>
                <input value={professional.registro || ""} readOnly className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Telefone</label>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Endereço</label>
                <input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => updateProfile.mutate()}
                disabled={updateProfile.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
