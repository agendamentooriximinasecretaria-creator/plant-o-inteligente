import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ban, Plus, Trash2, CalendarRange, Eye, Check, X, FileText, Download, Loader2, UserPlus, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dispatchNotification } from "@/lib/notifyHelper";

type Tipo = "indisponibilidade" | "ferias" | "atestado" | "folga_solicitada";

const TIPO_LABELS: Record<string, string> = {
  indisponibilidade: "Indisponibilidade",
  ferias: "Férias",
  atestado: "Atestado",
  folga_solicitada: "Folga Solicitada",
};

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/20",
  aprovada: "bg-success/10 text-success border-success/20",
  rejeitada: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function MinhaIndisponibilidadePage() {
  const { professionalId, isMaster, isCoordinator } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  // Professional Form State
  const [form, setForm] = useState({ 
    data_inicio: "", 
    data_fim: "", 
    observacao: "",
  });

  // Manager Decision Form State
  const [decision, setDecision] = useState({
    tipo: "indisponibilidade",
    motivo: "",
    substituto_id: "",
    data_inicio: "",
    data_fim: "",
  });

  const isManager = isMaster || isCoordinator;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["unavailabilities", professionalId, isManager],
    queryFn: async () => {
      let query = supabase
        .from("professional_unavailability")
        .select("*, professional:profissional_id(nome, profissao, especialidade), substituto:substituto_id(nome)");
      
      if (!isManager) {
        query = query.eq("profissional_id", professionalId!);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!professionalId,
  });

  const { data: potentialSubstitutes = [] } = useQuery({
    queryKey: ["potential-substitutes", selectedItem?.id],
    queryFn: async () => {
      if (!selectedItem) return [];
      
      // Get same profession/specialty professionals
      const { data: pros, error } = await supabase
        .from("professionals_safe")
        .select("id, nome, profissao, especialidade")
        .eq("status", "ativo")
        .eq("profissao", selectedItem.professional.profissao)
        .neq("id", selectedItem.profissional_id);
      
      if (error) throw error;

      // Filter by availability in period
      // (Simple check for now: no approved unavailability in that period)
      const { data: unavs } = await supabase
        .from("professional_unavailability")
        .select("profissional_id")
        .eq("status", "aprovada")
        .overlaps("data_inicio", "data_fim", selectedItem.data_inicio, selectedItem.data_fim);
      
      const unavailableIds = new Set(unavs?.map(u => u.profissional_id) || []);
      
      // Get shift counts to show load
      const start = new Date(selectedItem.data_inicio);
      const end = new Date(selectedItem.data_fim);
      const { data: shifts } = await supabase
        .from("shifts")
        .select("profissional_id")
        .gte("data", selectedItem.data_inicio)
        .lte("data", selectedItem.data_fim)
        .neq("status", "cancelado");
      
      const shiftCounts: Record<string, number> = {};
      shifts?.forEach(s => {
        if (s.profissional_id) {
          shiftCounts[s.profissional_id] = (shiftCounts[s.profissional_id] || 0) + 1;
        }
      });

      return pros
        .filter(p => !unavailableIds.has(p.id))
        .map(p => ({
          ...p,
          shiftCount: shiftCounts[p.id] || 0
        }))
        .sort((a, b) => a.shiftCount - b.shiftCount);
    },
    enabled: !!selectedItem && isManager,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!professionalId) throw new Error("Perfil profissional não encontrado");
      if (!form.data_inicio || !form.data_fim) throw new Error("Preencha as datas");

      let docUrl = null;
      if (file) {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${professionalId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('unavailability_docs')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        docUrl = filePath;
      }

      const { data, error } = await supabase.from("professional_unavailability").insert({
        profissional_id: professionalId,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        observacao_profissional: form.observacao.trim(),
        documento_url: docUrl,
        tipo: "indisponibilidade",
        status: "pendente",
      }).select().single();

      if (error) throw error;

      // Notify Master Managers
      const { data: masters } = await supabase
        .from("profiles")
        .select("profissional_id, user_id")
        .eq("role", "gestor_master")
        .eq("ativo", true);

      if (masters) {
        for (const m of masters) {
          await dispatchNotification({
            professionalId: m.profissional_id,
            userId: m.user_id,
            tipo: "indisponibilidade",
            titulo: "Nova solicitação de indisponibilidade",
            mensagem: `Profissional solicitou indisponibilidade para o período ${new Date(form.data_inicio).toLocaleDateString()} a ${new Date(form.data_fim).toLocaleDateString()}.`
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Solicitação enviada. Aguardando análise do gestor.");
      setOpen(false);
      setForm({ data_inicio: "", data_fim: "", observacao: "" });
      setFile(null);
      setUploading(false);
      qc.invalidateQueries({ queryKey: ["unavailabilities"] });
    },
    onError: (e: any) => {
      toast.error(e.message);
      setUploading(false);
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'aprovada' | 'rejeitada' }) => {
      const { error } = await supabase
        .from("professional_unavailability")
        .update({
          status,
          tipo_gestor: decision.tipo,
          motivo_gestor: decision.motivo,
          substituto_id: decision.substituto_id || null,
          data_inicio: decision.data_inicio,
          data_fim: decision.data_fim,
        })
        .eq("id", id);
      
      if (error) throw error;

      // Logic for Scale update if approved
      if (status === 'aprovada') {
        // 1. Mark existing shifts as "indisponibilidade" or "waiting replacement"
        const { data: shifts } = await supabase
          .from("shifts")
          .select("id, profissional_id, data")
          .eq("profissional_id", selectedItem.profissional_id)
          .gte("data", decision.data_inicio)
          .lte("data", decision.data_fim)
          .neq("status", "cancelado");

        if (shifts && shifts.length > 0) {
          for (const s of shifts) {
            if (decision.substituto_id) {
              // Update to substitute
              await supabase.from("shifts").update({
                profissional_id: decision.substituto_id,
                observacoes: (s.observacoes ? s.observacoes + "\n" : "") + `Substituição de ${selectedItem.professional.nome}`
              }).eq("id", s.id);

              // Notify substitute
              await dispatchNotification({
                professionalId: decision.substituto_id,
                tipo: "escala",
                titulo: "Novo plantão (Substituição)",
                mensagem: `Você foi escalado para substituir ${selectedItem.professional.nome} no dia ${new Date(s.data).toLocaleDateString()}.`
              });
            } else {
              // Mark as unavailable
              await supabase.from("shifts").update({
                tipo_plantao: "indisponibilidade",
                status: "pendente",
                observacoes: (s.observacoes ? s.observacoes + "\n" : "") + "Indisponível - aguardando substituto"
              }).eq("id", s.id);
            }
          }
        }
      }

      // Notify Professional
      const statusText = status === 'aprovada' ? 'APROVADA' : 'RECUSADA';
      const msg = status === 'aprovada' 
        ? `Sua indisponibilidade foi aprovada. ${decision.substituto_id ? 'Um substituto foi definido.' : ''}`
        : `Sua indisponibilidade foi recusada. Motivo: ${decision.motivo}`;

      await dispatchNotification({
        professionalId: selectedItem.profissional_id,
        tipo: "indisponibilidade",
        titulo: `Solicitação de Indisponibilidade ${statusText}`,
        mensagem: msg
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Solicitação ${variables.status === 'aprovada' ? 'aprovada' : 'recusada'} com sucesso.`);
      setAnalysisOpen(false);
      qc.invalidateQueries({ queryKey: ["unavailabilities"] });
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
      qc.invalidateQueries({ queryKey: ["unavailabilities"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleOpenAnalysis = (item: any) => {
    setSelectedItem(item);
    setDecision({
      tipo: item.tipo || "indisponibilidade",
      motivo: item.motivo_gestor || "",
      substituto_id: item.substituto_id || "",
      data_inicio: item.data_inicio,
      data_fim: item.data_fim,
    });
    setAnalysisOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="module-title">Indisponibilidades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isManager 
              ? "Gerencie as solicitações de ausência e substituições da equipe." 
              : "Informe os períodos em que não poderá assumir plantões."}
          </p>
        </div>
        
        {!isManager && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm"><Plus className="h-4 w-4 mr-2" /> Nova solicitação</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Informar indisponibilidade</DialogTitle>
                <DialogDescription>Preencha os dados da sua ausência para análise da gestão.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Data início</Label>
                    <Input id="start" type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">Data fim</Label>
                    <Input id="end" type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="obs">Observação</Label>
                  <Textarea 
                    id="obs"
                    placeholder="Ex: Atestado médico, viagem, etc."
                    value={form.observacao}
                    onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Anexar documento (PDF, JPG, PNG - Max 10MB)</Label>
                  <Input 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="cursor-pointer"
                  />
                  {file && <p className="text-xs text-muted-foreground">Arquivo selecionado: {file.name}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending || uploading}>
                  {(create.isPending || uploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enviar solicitação
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>
        ) : items.length === 0 ? (
          <div className="kpi-card py-20 text-center border-dashed">
            <Ban className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma indisponibilidade registrada.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((it: any) => (
              <div key={it.id} className="kpi-card flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div className="flex gap-4 items-start">
                  <div className={`p-2 rounded-lg ${it.status === 'aprovada' ? 'bg-success/10 text-success' : it.status === 'rejeitada' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                    <CalendarRange className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {new Date(`${it.data_inicio}T12:00:00`).toLocaleDateString("pt-BR")} → {new Date(`${it.data_fim}T12:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                      <Badge variant="outline" className={STATUS_BADGE[it.status] || ""}>
                        {it.status === 'pendente' ? 'Aguardando análise' : it.status.toUpperCase()}
                      </Badge>
                      {it.tipo && <Badge variant="secondary" className="font-normal">{TIPO_LABELS[it.tipo] || it.tipo}</Badge>}
                    </div>
                    {isManager && (
                      <p className="text-sm font-medium text-primary mt-1">
                        {it.professional?.nome} <span className="text-muted-foreground font-normal">({it.professional?.profissao})</span>
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{it.observacao_profissional || it.motivo || "Sem observação"}</p>
                    {it.substituto && (
                      <p className="text-xs text-success mt-1 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Substituído por: {it.substituto.nome}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {it.documento_url && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      const { data } = supabase.storage.from('unavailability_docs').getPublicUrl(it.documento_url);
                      window.open(data.publicUrl, '_blank');
                    }}>
                      <FileText className="h-4 w-4 mr-1" /> Doc
                    </Button>
                  )}
                  
                  {isManager && it.status === "pendente" && (
                    <Button size="sm" onClick={() => handleOpenAnalysis(it)}>
                      Analisar
                    </Button>
                  )}

                  {isManager && it.status !== "pendente" && (
                    <Button variant="ghost" size="sm" onClick={() => handleOpenAnalysis(it)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}

                  {!isManager && it.status === "pendente" && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => remove.mutate(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analysis Modal for Manager */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Análise de Indisponibilidade</DialogTitle>
            <DialogDescription>Avalie a solicitação e defina a substituição se necessário.</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {/* Request Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground">{selectedItem?.professional?.nome}</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem?.professional?.profissao} {selectedItem?.professional?.especialidade && `• ${selectedItem?.professional?.especialidade}`}</p>
                  </div>
                  {selectedItem?.documento_url && (
                    <Button variant="outline" size="sm" onClick={() => {
                      const { data } = supabase.storage.from('unavailability_docs').getPublicUrl(selectedItem.documento_url);
                      window.open(data.publicUrl, '_blank');
                    }}>
                      <Download className="h-4 w-4 mr-2" /> Baixar Anexo
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Início:</span>
                    <span className="font-medium">{selectedItem && new Date(`${selectedItem.data_inicio}T12:00:00`).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Fim:</span>
                    <span className="font-medium">{selectedItem && new Date(`${selectedItem.data_fim}T12:00:00`).toLocaleDateString()}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm block">Observação do profissional:</span>
                  <p className="text-sm italic">"{selectedItem?.observacao_profissional || selectedItem?.motivo || "Sem observação"}"</p>
                </div>
              </div>

              {/* Decision Form */}
              <div className="space-y-4 pt-2">
                <h4 className="font-semibold flex items-center gap-2"><Info className="h-4 w-4" /> Decisão da Gestão</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={decision.tipo} onValueChange={(v) => setDecision({...decision, tipo: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Substituto</Label>
                    <Select value={decision.substituto_id} onValueChange={(v) => setDecision({...decision, substituto_id: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (Manter descoberto)</SelectItem>
                        {potentialSubstitutes.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} ({p.shiftCount} plantões no período)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {potentialSubstitutes.length === 0 && (
                      <p className="text-[10px] text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Nenhum profissional disponível no período.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início (Ajustado)</Label>
                    <Input type="date" value={decision.data_inicio} onChange={(e) => setDecision({...decision, data_inicio: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim (Ajustado)</Label>
                    <Input type="date" value={decision.data_fim} onChange={(e) => setDecision({...decision, data_fim: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Motivo/Justificativa (obrigatório se recusado)</Label>
                  <Textarea 
                    placeholder="Informe o motivo da decisão..." 
                    value={decision.motivo}
                    onChange={(e) => setDecision({...decision, motivo: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-2 border-t flex gap-2">
            <Button variant="outline" onClick={() => setAnalysisOpen(false)} className="flex-1">Fechar</Button>
            {selectedItem?.status === 'pendente' && (
              <>
                <Button 
                  variant="destructive" 
                  disabled={decide.isPending || !decision.motivo} 
                  onClick={() => decide.mutate({ id: selectedItem.id, status: 'rejeitada' })}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" /> Recusar
                </Button>
                <Button 
                  disabled={decide.isPending} 
                  onClick={() => decide.mutate({ id: selectedItem.id, status: 'aprovada' })}
                  className="flex-1 bg-success hover:bg-success/90"
                >
                  <Check className="h-4 w-4 mr-2" /> Aprovar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
