import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Copy, Calendar, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function EscalaPage() {
  const qc = useQueryClient();
  const { isMaster, isCoordinator } = useAuth();
  const [filterSetor, setFilterSetor] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    data: "",
    hora_inicio: "",
    hora_fim: "",
    tipo_plantao: "plantao",
    setor_id: "",
    profissional_id: "",
  });

  // Queries
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["escala-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          id, data, hora_inicio, hora_fim, tipo_plantao, carga_horaria, status,
          professionals:profissional_id(id, nome),
          sectors:setor_id(id, nome),
          units:unidade_id(id, nome)
        `)
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["escala-sectors"],
    queryFn: async () => {
      const { data } = await supabase.from("sectors").select("id, nome");
      return data || [];
    },
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["escala-professionals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("professionals_safe")
        .select("id, nome")
        .eq("status", "ativo");
      return data || [];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("shifts").insert({
        data: data.data,
        hora_inicio: data.hora_inicio,
        hora_fim: data.hora_fim,
        tipo_plantao: data.tipo_plantao,
        setor_id: data.setor_id,
        profissional_id: data.profissional_id || null,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantão criado!");
      qc.invalidateQueries({ queryKey: ["escala-shifts"] });
      setFormData({
        data: "",
        hora_inicio: "",
        hora_fim: "",
        tipo_plantao: "plantao",
        setor_id: "",
        profissional_id: "",
      });
      setIsAdding(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantão removido!");
      qc.invalidateQueries({ queryKey: ["escala-shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter
  const filtered = useMemo(() => {
    return shifts.filter((s: any) => {
      const matchSetor = !filterSetor || s.setor_id === filterSetor;
      const matchStatus = !filterStatus || s.status === filterStatus;
      return matchSetor && matchStatus;
    });
  }, [shifts, filterSetor, filterStatus]);

  if (isLoading) return <PageSkeleton />;

  if (!isMaster && !isCoordinator) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Acesso restrito. Apenas gestores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="module-title">Escala de Plantões</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciar plantões do sistema.</p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo Plantão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Plantão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início *</Label>
                  <Input
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Fim *</Label>
                  <Input
                    type="time"
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Setor *</Label>
                <select
                  value={formData.setor_id}
                  onChange={(e) => setFormData({ ...formData, setor_id: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">Selecione...</option>
                  {sectors.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Profissional (opcional)</Label>
                <select
                  value={formData.profissional_id}
                  onChange={(e) => setFormData({ ...formData, profissional_id: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">Não atribuir agora</option>
                  {professionals.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAdding(false)}>Cancelar</Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.data || !formData.hora_inicio || !formData.setor_id || createMutation.isPending}
                >
                  {createMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterSetor}
            onChange={(e) => setFilterSetor(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Todos os setores</option>
            {sectors.map((s: any) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="p-3 text-left font-semibold">Data</th>
              <th className="p-3 text-left font-semibold">Horário</th>
              <th className="p-3 text-left font-semibold">Setor</th>
              <th className="p-3 text-left font-semibold">Profissional</th>
              <th className="p-3 text-left font-semibold">Status</th>
              <th className="p-3 text-left font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhum plantão encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-muted/30">
                  <td className="p-3">{new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">{s.hora_inicio} - {s.hora_fim}</td>
                  <td className="p-3">{s.sectors?.nome || "—"}</td>
                  <td className="p-3 text-muted-foreground">{s.professionals?.nome || "Não atribuído"}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      s.status === "confirmado" ? "bg-success/10 text-success" :
                      s.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteMutation.mutate(s.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
