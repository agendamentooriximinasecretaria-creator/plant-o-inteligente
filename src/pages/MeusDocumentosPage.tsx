import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Plus, Trash2, Upload, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const TIPOS = [
  "COREN", "CRM", "CRF", "CREFITO", "Outros Conselhos",
  "ASO", "Contrato", "Certificado", "RG", "CPF", "Comprovante", "Outro",
] as const;

const BUCKET = "professional-documents";

function statusFromValidade(validade: string | null): { label: string; color: string; icon: any } {
  if (!validade) return { label: "Sem validade", color: "bg-muted text-muted-foreground", icon: FileText };
  const v = new Date(validade);
  const hoje = new Date();
  const dias = Math.floor((v.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { label: "Vencido", color: "bg-destructive/10 text-destructive", icon: AlertTriangle };
  if (dias <= 30) return { label: `Vence em ${dias}d`, color: "bg-warning/10 text-warning", icon: AlertTriangle };
  return { label: "Válido", color: "bg-success/10 text-success", icon: CheckCircle2 };
}

export default function MeusDocumentosPage() {
  const { professionalId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<{ tipo: string; nome: string; numero: string; data_emissao: string; validade: string; file: File | null }>({
    tipo: "COREN", nome: "", numero: "", data_emissao: "", validade: "", file: null,
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["my-documents", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_documents")
        .select("*")
        .eq("profissional_id", professionalId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    let vencidos = 0, vencendo = 0, validos = 0;
    docs.forEach((d: any) => {
      const s = statusFromValidade(d.validade);
      if (s.label === "Vencido") vencidos++;
      else if (s.label.startsWith("Vence")) vencendo++;
      else if (s.label === "Válido") validos++;
    });
    return { vencidos, vencendo, validos, total: docs.length };
  }, [docs]);

  const create = useMutation({
    mutationFn: async () => {
      if (!professionalId) throw new Error("Perfil profissional não encontrado");
      if (!form.tipo || !form.nome.trim()) throw new Error("Tipo e nome são obrigatórios");

      let arquivo_path: string | null = null;
      if (form.file) {
        setUploading(true);
        const ext = form.file.name.split(".").pop();
        const path = `${professionalId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, form.file);
        if (upErr) throw upErr;
        arquivo_path = path;
      }

      const { error } = await supabase.from("professional_documents").insert({
        profissional_id: professionalId,
        tipo: form.tipo,
        nome: form.nome.trim(),
        numero: form.numero.trim() || null,
        data_emissao: form.data_emissao || null,
        validade: form.validade || null,
        arquivo_path,
        status: "ativo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento adicionado");
      setOpen(false);
      setForm({ tipo: "COREN", nome: "", numero: "", data_emissao: "", validade: "", file: null });
      qc.invalidateQueries({ queryKey: ["my-documents"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
    onSettled: () => setUploading(false),
  });

  const remove = useMutation({
    mutationFn: async (doc: any) => {
      if (doc.arquivo_path) {
        await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
      }
      const { error } = await supabase.from("professional_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["my-documents"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baixar = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="module-title">Meus Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Conselho profissional, ASO, contrato e outros documentos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Adicionar documento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar documento</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Nome / Identificação</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: COREN-PA 12345" />
                </div>
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data emissão</Label>
                  <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Arquivo (opcional)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                />
                <p className="text-[11px] text-muted-foreground mt-1">PDF, JPG ou PNG (até 10MB)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || uploading}>
                {uploading ? "Enviando arquivo..." : create.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card"><p className="kpi-label">Total</p><p className="kpi-value">{stats.total}</p></div>
        <div className="kpi-card"><p className="kpi-label">Válidos</p><p className="kpi-value text-success">{stats.validos}</p></div>
        <div className="kpi-card"><p className="kpi-label">Vencendo (30d)</p><p className="kpi-value text-warning">{stats.vencendo}</p></div>
        <div className="kpi-card"><p className="kpi-label">Vencidos</p><p className="kpi-value text-destructive">{stats.vencidos}</p></div>
      </div>

      <div className="kpi-card">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : docs.length === 0 ? (
          <div className="py-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((d: any) => {
              const s = statusFromValidade(d.validade);
              const Icon = s.icon;
              return (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-foreground">{d.tipo}</span>
                      <span className="text-sm font-medium text-foreground">{d.nome}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${s.color}`}>
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.numero && <>Nº {d.numero} • </>}
                      {d.validade && <>Validade: {new Date(`${d.validade}T12:00:00`).toLocaleDateString("pt-BR")}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.arquivo_path && (
                      <button onClick={() => baixar(d.arquivo_path)} className="text-xs p-1.5 rounded-md hover:bg-muted text-foreground" title="Baixar">
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => remove.mutate(d)} className="text-xs p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
