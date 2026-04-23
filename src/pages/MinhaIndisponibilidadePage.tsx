import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ban, Plus, Trash2, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Tipo = "indisponibilidade" | "ferias" | "atestado" | "folga_solicitada";

const TIPO_LABELS: Record<Tipo, string> = {
  indisponibilidade: "Indisponibilidade",
  ferias: "Férias",
  atestado: "Atestado",
  folga_solicitada: "Folga Solicitada",
};

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-warning/10 text-warning",
  aprovada: "bg-success/10 text-success",
  rejeitada: "bg-destructive/10 text-destructive",
};

export default function MinhaIndisponibilidadePage() {
  const { professionalId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ data_inicio: "", data_fim: "", motivo: "", tipo: "indisponibilidade" as Tipo });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-unavailability", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_unavailability")
        .select("*")
        .eq("profissional_id", professionalId!)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!professionalId) throw new Error("Perfil profissional não encontrado");
      if (!form.data_inicio || !form.data_fim || !form.motivo.trim()) throw new Error("Preencha todos os campos");
      if (form.motivo.trim().length < 5) throw new Error("Motivo precisa ter pelo menos 5 caracteres");
      const { error } = await supabase.from("professional_unavailability").insert({
        profissional_id: professionalId,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        motivo: form.motivo.trim(),
        tipo: form.tipo,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indisponibilidade registrada. Aguardando aprovação do gestor.");
      setOpen(false);
      setForm({ data_inicio: "", data_fim: "", motivo: "", tipo: "indisponibilidade" });
      qc.invalidateQueries({ queryKey: ["my-unavailability"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("professional_unavailability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação removida");
      qc.invalidateQueries({ queryKey: ["my-unavailability"] });
    },
    onError: (e: any) => toast.error(e.message || "Sem permissão. Solicite ao gestor."),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="module-title">Minha Indisponibilidade</h1>
          <p className="text-sm text-muted-foreground mt-1">Avise antecipadamente os dias em que não poderá assumir plantões.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova solicitação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Informar indisponibilidade</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Tipo</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}
                >
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data início</Label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
                </div>
                <div>
                  <Label>Data fim</Label>
                  <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Motivo</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Descreva o motivo (mínimo 5 caracteres)"
                  maxLength={500}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="kpi-card">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <Ban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma indisponibilidade registrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it: any) => (
              <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {new Date(`${it.data_inicio}T12:00:00`).toLocaleDateString("pt-BR")} → {new Date(`${it.data_fim}T12:00:00`).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{TIPO_LABELS[it.tipo as Tipo] || it.tipo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_BADGE[it.status] || "bg-muted text-muted-foreground"}`}>{it.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{it.motivo}</p>
                  {it.observacao_gestor && (
                    <p className="text-xs text-foreground bg-muted/50 rounded px-2 py-1 mt-1">
                      <span className="font-medium">Gestor:</span> {it.observacao_gestor}
                    </p>
                  )}
                </div>
                {it.status === "pendente" && (
                  <button
                    onClick={() => remove.mutate(it.id)}
                    className="text-xs text-destructive hover:bg-destructive/10 p-1.5 rounded-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
