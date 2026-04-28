import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";
import { Save, Plus, Trash2, Paperclip } from "lucide-react";
import {
  type SwapAttachmentSettings,
  type SwapAttachmentTypeConfig,
  DEFAULT_SWAP_ATTACHMENT_SETTINGS,
  DEFAULT_DOC_TYPES,
  mergeSettings,
} from "@/lib/swapAttachmentSettings";

const ALL_EXTS: SwapAttachmentSettings["tipos_permitidos"] = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];

export default function SwapAttachmentSettingsManager() {
  const qc = useQueryClient();
  const { data: settings = DEFAULT_SWAP_ATTACHMENT_SETTINGS } = useQuery({
    queryKey: ["swap-attachment-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "swap_attachments_rules")
        .maybeSingle();
      return mergeSettings(data?.value);
    },
    staleTime: 30_000,
  });

  const [local, setLocal] = useState<SwapAttachmentSettings>(DEFAULT_SWAP_ATTACHMENT_SETTINGS);
  const [newTypeLabel, setNewTypeLabel] = useState("");

  useEffect(() => { setLocal(settings); }, [settings]);

  const save = useMutation({
    mutationFn: async (next: SwapAttachmentSettings) => {
      // Validações simples
      if (next.max_arquivos < 1 || next.max_arquivos > 20) throw new Error("Máximo de arquivos deve estar entre 1 e 20.");
      if (next.max_tamanho_mb < 1 || next.max_tamanho_mb > 50) throw new Error("Tamanho máximo deve estar entre 1 e 50 MB.");
      if (next.tipos_permitidos.length === 0) throw new Error("Selecione ao menos um tipo de arquivo permitido.");
      if (next.tipos_documento.filter((t) => t.ativo).length === 0) throw new Error("Mantenha ao menos um tipo de documento ativo.");

      const { data: existing } = await supabase
        .from("system_settings")
        .select("id, value")
        .eq("key", "swap_attachments_rules")
        .maybeSingle();
      const valor_anterior = existing?.value ?? null;
      if (existing) {
        const { error } = await supabase.from("system_settings").update({ value: next as any }).eq("key", "swap_attachments_rules");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert({ key: "swap_attachments_rules", value: next as any });
        if (error) throw error;
      }
      await logAudit("Configuração de anexos em trocas atualizada", "configuracoes", {
        key: "swap_attachments_rules",
        valor_anterior,
        valor_novo: next,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swap-attachment-settings"] });
      toast.success("Configurações de anexos salvas!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const toggleExt = (ext: SwapAttachmentSettings["tipos_permitidos"][number]) => {
    setLocal((p) => ({
      ...p,
      tipos_permitidos: p.tipos_permitidos.includes(ext)
        ? p.tipos_permitidos.filter((e) => e !== ext)
        : [...p.tipos_permitidos, ext],
    }));
  };

  const updateTipo = (idx: number, patch: Partial<SwapAttachmentTypeConfig>) => {
    setLocal((p) => {
      const arr = [...p.tipos_documento];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...p, tipos_documento: arr };
    });
  };

  const removeTipo = (idx: number) => {
    setLocal((p) => ({ ...p, tipos_documento: p.tipos_documento.filter((_, i) => i !== idx) }));
  };

  const addTipo = () => {
    const label = newTypeLabel.trim();
    if (!label) { toast.error("Informe o nome do tipo de documento."); return; }
    const value = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "_").slice(0, 40);
    if (local.tipos_documento.some((t) => t.value === value)) { toast.error("Já existe um tipo com este nome."); return; }
    setLocal((p) => ({ ...p, tipos_documento: [...p.tipos_documento, { value, label, ativo: true }] }));
    setNewTypeLabel("");
  };

  const restoreDefaults = () => {
    setLocal((p) => ({ ...p, tipos_documento: [...DEFAULT_DOC_TYPES] }));
  };

  const switchClass = "h-4 w-4 rounded";
  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  const SwitchRow = ({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <label className={`flex items-start gap-2 cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" disabled={disabled} className={`${switchClass} mt-0.5`} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">
        <span className="text-foreground font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10"><Paperclip className="h-5 w-5 text-primary" /></div>
        <div>
          <h3 className="font-display font-semibold text-foreground">Anexos em Trocas de Plantão</h3>
          <p className="text-sm text-muted-foreground">Defina quando o anexo é permitido, obrigatório ou restrito nas solicitações de troca.</p>
        </div>
      </div>

      {/* Regras gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <SwitchRow label="Permitir anexos em solicitação de troca" checked={local.permitir_anexos} onChange={(v) => setLocal((p) => ({ ...p, permitir_anexos: v }))} />
        <SwitchRow label="Tornar anexo obrigatório para troca" hint="Bloqueia o envio da solicitação sem anexo." disabled={!local.permitir_anexos} checked={local.obrigatorio} onChange={(v) => setLocal((p) => ({ ...p, obrigatorio: v }))} />
        <SwitchRow label="Obrigatório apenas quando motivo for saúde/atestado" hint="Detecção automática a partir de palavras-chave do motivo." disabled={!local.permitir_anexos || local.obrigatorio} checked={local.obrigatorio_apenas_saude} onChange={(v) => setLocal((p) => ({ ...p, obrigatorio_apenas_saude: v }))} />
        <SwitchRow label="Permitir substituto visualizar anexo" disabled={!local.permitir_anexos} checked={local.permitir_substituto_visualizar} onChange={(v) => setLocal((p) => ({ ...p, permitir_substituto_visualizar: v }))} />
        <SwitchRow label="Permitir profissional remover anexo enquanto pendente" disabled={!local.permitir_anexos} checked={local.permitir_remover_pendente} onChange={(v) => setLocal((p) => ({ ...p, permitir_remover_pendente: v }))} />
        <SwitchRow label="Exigir descrição do anexo" disabled={!local.permitir_anexos} checked={local.exigir_descricao} onChange={(v) => setLocal((p) => ({ ...p, exigir_descricao: v }))} />
        <SwitchRow label="Exigir análise do coordenador antes da aprovação" hint="Aprovação ficará bloqueada até cada anexo ser marcado como analisado." disabled={!local.permitir_anexos} checked={local.exigir_analise_coordenador} onChange={(v) => setLocal((p) => ({ ...p, exigir_analise_coordenador: v }))} />
        <SwitchRow label="Bloquear aprovação se anexo obrigatório não existir" disabled={!local.permitir_anexos} checked={local.bloquear_aprovacao_sem_anexo} onChange={(v) => setLocal((p) => ({ ...p, bloquear_aprovacao_sem_anexo: v }))} />
      </div>

      {/* Limites de upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <div>
          <label className="text-sm font-medium text-foreground">Quantidade máxima de arquivos</label>
          <input type="number" min={1} max={20} className={inputClass}
            value={local.max_arquivos}
            onChange={(e) => setLocal((p) => ({ ...p, max_arquivos: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) }))} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Tamanho máximo por arquivo (MB)</label>
          <input type="number" min={1} max={50} className={inputClass}
            value={local.max_tamanho_mb}
            onChange={(e) => setLocal((p) => ({ ...p, max_tamanho_mb: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) }))} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Tipos de arquivo permitidos</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_EXTS.map((ext) => {
              const active = local.tipos_permitidos.includes(ext);
              return (
                <button type="button" key={ext} onClick={() => toggleExt(ext)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors uppercase font-medium ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  }`}>
                  {ext}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tipos de documento */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Tipos de documento configuráveis</h4>
            <p className="text-[11px] text-muted-foreground">Itens disponíveis no campo "Tipo de documento" ao anexar um arquivo.</p>
          </div>
          <button type="button" onClick={restoreDefaults} className="text-[11px] text-primary hover:underline">Restaurar padrão</button>
        </div>
        <ul className="space-y-1.5">
          {local.tipos_documento.map((t, idx) => (
            <li key={t.value} className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
              <input type="checkbox" className={switchClass} checked={t.ativo} onChange={(e) => updateTipo(idx, { ativo: e.target.checked })} />
              <input
                value={t.label}
                onChange={(e) => updateTipo(idx, { label: e.target.value.slice(0, 60) })}
                className="flex-1 bg-transparent text-sm outline-none focus:ring-2 focus:ring-ring rounded px-1 py-0.5"
              />
              <code className="text-[10px] text-muted-foreground">{t.value}</code>
              <button type="button" onClick={() => removeTipo(idx)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Remover">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 mt-3">
          <input
            value={newTypeLabel}
            onChange={(e) => setNewTypeLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTipo(); } }}
            placeholder="Novo tipo de documento"
            className={inputClass}
          />
          <button type="button" onClick={addTipo} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>

      <button onClick={() => save.mutate(local)} disabled={save.isPending}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
        <Save className="h-4 w-4" /> {save.isPending ? 'Salvando...' : 'Salvar configurações de anexos'}
      </button>
    </div>
  );
}
