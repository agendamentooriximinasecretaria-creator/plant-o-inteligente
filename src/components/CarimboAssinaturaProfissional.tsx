import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import {
  Stamp, Upload, X, Lock, AlertTriangle, ImageIcon, Save, RotateCcw, Eye, FileSignature,
  PenLine, FileImage, ShieldCheck, Settings2, Layout, Type, QrCode, Hash, Info,
} from "lucide-react";

// =============================================================
// Carimbo e Assinatura Profissional
// Substitui o antigo CarimboDigitalCard. Preserva os dados antigos
// pois usa a MESMA tabela `professional_stamps` (apenas com colunas
// novas adicionadas via migração não-destrutiva).
// =============================================================

interface Props {
  /** ID do profissional cujo carimbo será editado */
  profissionalId: string;
  /** Se o usuário logado é Gestor Master (libera bloqueio/desbloqueio) */
  isMaster?: boolean;
  /** Modo compacto (uso em modais) */
  compact?: boolean;
}

type TipoCarimbo = "digital_gerado" | "imagem_carimbo" | "assinatura_manuscrita" | "eletronica_interna";
type Estilo = "compacto" | "completo" | "oficial";
type Posicao = "esquerda" | "centro" | "direita" | "rodape_esquerdo" | "rodape_centro" | "rodape_direito" | "final_documento" | "personalizado";
type Alinhamento = "esquerda" | "centro" | "direita" | "justificado";

interface StampRow {
  id?: string;
  profissional_id: string;
  tipo: TipoCarimbo;
  cargo: string | null;
  especialidade: string | null;
  uf_conselho: string | null;
  cbo: string | null;
  cns: string | null;
  cidade_uf: string | null;
  texto_personalizado: string | null;
  assinatura_path: string | null;
  carimbo_path: string | null;
  assinatura_posicao: Posicao;
  assinatura_tamanho: number;
  carimbo_tamanho: number;
  cor_texto: string;
  estilo: Estilo;
  largura: number;
  altura_max: number;
  espacamento_top: number;
  espacamento_bottom: number;
  alinhamento_texto: Alinhamento;
  tamanho_fonte: number;
  // Switches
  mostrar_linha_assinatura: boolean;
  mostrar_profissao: boolean;
  mostrar_especialidade: boolean;
  mostrar_conselho: boolean;
  mostrar_uf_conselho: boolean;
  mostrar_cbo: boolean;
  mostrar_cns: boolean;
  mostrar_unidade: boolean;
  mostrar_setor: boolean;
  mostrar_cidade_uf: boolean;
  mostrar_data_local: boolean;
  mostrar_codigo_validacao: boolean;
  mostrar_hash: boolean;
  mostrar_qr_code: boolean;
  // Outros
  contextos_uso: string[];
  bloqueado: boolean;
  bloqueado_motivo: string | null;
  metadata: Record<string, any>;
}

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg"];
const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

const CONTEXTOS_USO = [
  { value: "escala_mensal", label: "Escala mensal oficial" },
  { value: "escala_semanal", label: "Escala semanal" },
  { value: "comprovante_plantao", label: "Comprovante de plantão" },
  { value: "comprovante_troca", label: "Comprovante de troca de plantão" },
  { value: "solicitacao_troca", label: "Solicitação de troca" },
  { value: "aprovacao_troca", label: "Aprovação de troca" },
  { value: "recusa_troca", label: "Recusa de troca" },
  { value: "relatorios", label: "Relatórios" },
  { value: "ficha_resumida", label: "Ficha resumida do profissional" },
  { value: "documentos_personalizados", label: "Documentos personalizados" },
];

const POSICOES: { value: Posicao; label: string }[] = [
  { value: "esquerda", label: "Esquerda" },
  { value: "centro", label: "Centro" },
  { value: "direita", label: "Direita" },
  { value: "rodape_esquerdo", label: "Rodapé esquerdo" },
  { value: "rodape_centro", label: "Rodapé central" },
  { value: "rodape_direito", label: "Rodapé direito" },
  { value: "final_documento", label: "Ao final do documento" },
  { value: "personalizado", label: "Campo personalizado do modelo" },
];

const emptyStamp = (profId: string): StampRow => ({
  profissional_id: profId,
  tipo: "digital_gerado",
  cargo: "", especialidade: "", uf_conselho: "", cbo: "", cns: "", cidade_uf: "",
  texto_personalizado: "",
  assinatura_path: null, carimbo_path: null,
  assinatura_posicao: "centro",
  assinatura_tamanho: 180, carimbo_tamanho: 140,
  cor_texto: "#000000",
  estilo: "completo",
  largura: 320, altura_max: 200,
  espacamento_top: 8, espacamento_bottom: 8,
  alinhamento_texto: "centro", tamanho_fonte: 12,
  mostrar_linha_assinatura: true,
  mostrar_profissao: true,
  mostrar_especialidade: false,
  mostrar_conselho: true,
  mostrar_uf_conselho: true,
  mostrar_cbo: false,
  mostrar_cns: false,
  mostrar_unidade: true,
  mostrar_setor: false,
  mostrar_cidade_uf: false,
  mostrar_data_local: false,
  mostrar_codigo_validacao: false,
  mostrar_hash: false,
  mostrar_qr_code: false,
  contextos_uso: [],
  bloqueado: false, bloqueado_motivo: "",
  metadata: {},
});

async function getSignedUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("professional-documents").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export default function CarimboAssinaturaProfissional({ profissionalId, isMaster, compact }: Props) {
  const sb = supabase as any;
  const qc = useQueryClient();
  const [stamp, setStamp] = useState<StampRow>(emptyStamp(profissionalId));
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [carimboUrl, setCarimboUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"visual" | "carimbo_fisico" | "eletronica" | "sem_assinatura">("visual");
  const assRef = useRef<HTMLInputElement>(null);
  const carRef = useRef<HTMLInputElement>(null);

  const { data: professional } = useQuery({
    queryKey: ["prof-for-stamp", profissionalId],
    queryFn: async () => {
      const { data } = await supabase.from("professionals")
        .select("nome,profissao,especialidade,conselho,registro,documento_conselho,documento_numero,unidade_principal_id,setor_principal_id")
        .eq("id", profissionalId).maybeSingle();
      return data as any;
    },
    enabled: !!profissionalId,
  });

  const { data: unidade } = useQuery({
    queryKey: ["unit-for-stamp", professional?.unidade_principal_id],
    queryFn: async () => {
      if (!professional?.unidade_principal_id) return null;
      const { data } = await supabase.from("units").select("nome").eq("id", professional.unidade_principal_id).maybeSingle();
      return data;
    },
    enabled: !!professional?.unidade_principal_id,
  });

  const { data: setor } = useQuery({
    queryKey: ["sector-for-stamp", professional?.setor_principal_id],
    queryFn: async () => {
      if (!professional?.setor_principal_id) return null;
      const { data } = await supabase.from("sectors").select("nome").eq("id", professional.setor_principal_id).maybeSingle();
      return data;
    },
    enabled: !!professional?.setor_principal_id,
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ["stamp", profissionalId],
    queryFn: async () => {
      const { data } = await sb.from("professional_stamps").select("*").eq("profissional_id", profissionalId).maybeSingle();
      return data as StampRow | null;
    },
    enabled: !!profissionalId,
  });

  useEffect(() => {
    if (existing) setStamp({ ...emptyStamp(profissionalId), ...existing });
    else setStamp(emptyStamp(profissionalId));
  }, [existing, profissionalId]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const a = await getSignedUrl(stamp.assinatura_path);
      const c = await getSignedUrl(stamp.carimbo_path);
      if (!cancel) { setAssinaturaUrl(a); setCarimboUrl(c); }
    })();
    return () => { cancel = true; };
  }, [stamp.assinatura_path, stamp.carimbo_path]);

  const conselho = stamp.mostrar_conselho
    ? (professional?.documento_conselho || professional?.conselho || "")
    : "";
  const registro = stamp.mostrar_conselho
    ? (professional?.documento_numero || professional?.registro || "")
    : "";

  // Upload de imagem (assinatura ou carimbo)
  const uploadImage = useMutation({
    mutationFn: async ({ kind, file }: { kind: "assinatura" | "carimbo"; file: File }) => {
      if (!ACCEPTED.includes(file.type)) throw new Error("Apenas PNG ou JPG.");
      if (file.size > MAX_BYTES) throw new Error("Arquivo acima de 1,5 MB.");
      const safe = sanitizeFileName(file.name);
      const path = `stamps/${profissionalId}/${kind}_${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("professional-documents").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const oldPath = kind === "assinatura" ? stamp.assinatura_path : stamp.carimbo_path;
      if (oldPath) await supabase.storage.from("professional-documents").remove([oldPath]).catch(() => {});
      setStamp(s => ({ ...s, [kind === "assinatura" ? "assinatura_path" : "carimbo_path"]: path }));
      await logAudit(`upload_${kind}_carimbo`, "carimbo_assinatura", { profissional_id: profissionalId, path });
      return path;
    },
    onSuccess: () => toast.success("Imagem enviada."),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeImage = useMutation({
    mutationFn: async (kind: "assinatura" | "carimbo") => {
      const path = kind === "assinatura" ? stamp.assinatura_path : stamp.carimbo_path;
      if (path) await supabase.storage.from("professional-documents").remove([path]).catch(() => {});
      setStamp(s => ({ ...s, [kind === "assinatura" ? "assinatura_path" : "carimbo_path"]: null }));
      await logAudit(`remocao_${kind}_carimbo`, "carimbo_assinatura", { profissional_id: profissionalId });
    },
    onSuccess: () => toast.success("Imagem removida."),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...stamp, profissional_id: profissionalId };
      if (existing?.id) {
        const { error } = await sb.from("professional_stamps").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("professional_stamps").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Carimbo e assinatura salvos.");
      qc.invalidateQueries({ queryKey: ["stamp", profissionalId] });
    },
    onError: (e: Error) => toast.error("Falha ao salvar: " + e.message),
  });

  const restorePadrao = () => {
    setStamp(s => ({ ...emptyStamp(profissionalId), assinatura_path: s.assinatura_path, carimbo_path: s.carimbo_path }));
    toast.info("Padrões restaurados (não foram salvos ainda).");
  };

  // Linhas geradas para o carimbo digital
  const linhas = useMemo(() => {
    const arr: string[] = [];
    if (professional?.nome) arr.push((professional.nome as string).toUpperCase());
    if (stamp.cargo) arr.push(stamp.cargo);
    if (stamp.mostrar_profissao && professional?.profissao) arr.push(String(professional.profissao));
    if (stamp.mostrar_especialidade && (stamp.especialidade || professional?.especialidade)) arr.push(stamp.especialidade || professional?.especialidade);
    if ((stamp.mostrar_conselho || stamp.mostrar_uf_conselho) && (conselho || registro)) {
      const parts = [conselho, registro].filter(Boolean).join(" ");
      const final = stamp.mostrar_uf_conselho && stamp.uf_conselho ? `${parts} / ${stamp.uf_conselho}` : parts;
      if (final) arr.push(final);
    }
    if (stamp.mostrar_cbo && stamp.cbo) arr.push(`CBO: ${stamp.cbo}`);
    if (stamp.mostrar_cns && stamp.cns) arr.push(`CNS: ${stamp.cns}`);
    if (stamp.mostrar_unidade && unidade?.nome) arr.push(unidade.nome);
    if (stamp.mostrar_setor && setor?.nome) arr.push(setor.nome);
    if (stamp.mostrar_cidade_uf && stamp.cidade_uf) arr.push(stamp.cidade_uf);
    if (stamp.texto_personalizado) arr.push(stamp.texto_personalizado);
    return arr;
  }, [stamp, professional, unidade, setor, conselho, registro]);

  const disabledByLock = stamp.bloqueado && !isMaster;
  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60";
  const labelCls = "text-xs font-medium text-muted-foreground mb-1 block";
  const sectionCls = "rounded-xl border border-border bg-card p-4 shadow-sm";

  const Switch = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
    <label className={`flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm cursor-pointer ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50"}`}>
      <span className="text-foreground">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="rounded" />
    </label>
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
        <div className="h-5 w-64 bg-muted rounded mb-4" />
        <div className="h-40 bg-muted/60 rounded" />
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-border bg-card shadow-sm ${compact ? "p-4" : "p-6"}`}>
      {/* Header */}
      <header className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Stamp className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Carimbo e Assinatura Profissional</h3>
            <p className="text-sm text-muted-foreground">Configure o carimbo, a assinatura visual e a assinatura eletrônica interna deste profissional.</p>
          </div>
        </div>
        {stamp.bloqueado && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
            <Lock className="h-3 w-3" /> Bloqueado
          </span>
        )}
      </header>

      {stamp.bloqueado && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <strong>Edição bloqueada pelo Gestor Master.</strong>
            {stamp.bloqueado_motivo && <div className="mt-1 text-foreground/80">{stamp.bloqueado_motivo}</div>}
          </div>
        </div>
      )}

      {/* SEÇÃO 1 — Tipo */}
      <div className={`${sectionCls} mb-4`}>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" /> 1. Tipo de assinatura/carimbo</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { v: "digital_gerado" as TipoCarimbo, t: "Carimbo digital gerado pelo sistema", d: "Monta automaticamente com nome, cargo, conselho e registro.", i: <Stamp className="h-4 w-4" /> },
            { v: "imagem_carimbo" as TipoCarimbo, t: "Imagem do carimbo físico", d: "Usa a imagem do seu carimbo enviada abaixo.", i: <FileImage className="h-4 w-4" /> },
            { v: "assinatura_manuscrita" as TipoCarimbo, t: "Assinatura manuscrita digitalizada", d: "Usa a imagem da sua assinatura enviada.", i: <PenLine className="h-4 w-4" /> },
            { v: "eletronica_interna" as TipoCarimbo, t: "Assinatura eletrônica interna", d: "Sistema registra usuário, data/hora, hash e código de validação.", i: <ShieldCheck className="h-4 w-4" /> },
          ].map(opt => (
            <label key={opt.v} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${stamp.tipo === opt.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"} ${disabledByLock ? "opacity-60 cursor-not-allowed" : ""}`}>
              <input type="radio" name="tipo" disabled={disabledByLock} checked={stamp.tipo === opt.v} onChange={() => setStamp(s => ({ ...s, tipo: opt.v }))} className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">{opt.i}{opt.t}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.d}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground flex items-start gap-1.5"><Info className="h-3 w-3 mt-0.5" /> Esta assinatura eletrônica é interna do sistema, não é ICP-Brasil.</p>
      </div>

      {/* SEÇÃO 2 — Dados profissionais */}
      <div className={`${sectionCls} mb-4`}>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Type className="h-4 w-4 text-primary" /> 2. Dados profissionais</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome completo</label>
            <input value={professional?.nome || ""} disabled className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Profissão</label>
            <input value={professional?.profissao || ""} disabled className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cargo / Função</label>
            <input value={stamp.cargo || ""} onChange={e => setStamp(s => ({ ...s, cargo: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Ex.: Médico Plantonista" />
          </div>
          <div>
            <label className={labelCls}>Especialidade</label>
            <input value={stamp.especialidade || ""} onChange={e => setStamp(s => ({ ...s, especialidade: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder={professional?.especialidade || "Ex.: Cardiologia"} />
          </div>
          <div>
            <label className={labelCls}>Conselho</label>
            <input value={professional?.documento_conselho || professional?.conselho || ""} disabled className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Número do registro</label>
            <input value={professional?.documento_numero || professional?.registro || ""} disabled className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>UF do conselho</label>
            <input value={stamp.uf_conselho || ""} onChange={e => setStamp(s => ({ ...s, uf_conselho: e.target.value.toUpperCase().slice(0, 2) }))} disabled={disabledByLock} className={inputCls} placeholder="PA" maxLength={2} />
          </div>
          <div>
            <label className={labelCls}>CBO</label>
            <input value={stamp.cbo || ""} onChange={e => setStamp(s => ({ ...s, cbo: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Ex.: 2251-25" />
          </div>
          <div>
            <label className={labelCls}>CNS profissional <span className="text-muted-foreground/70">(opcional)</span></label>
            <input value={stamp.cns || ""} onChange={e => setStamp(s => ({ ...s, cns: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Cartão Nacional de Saúde" />
          </div>
          <div>
            <label className={labelCls}>Cidade / UF</label>
            <input value={stamp.cidade_uf || ""} onChange={e => setStamp(s => ({ ...s, cidade_uf: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Oriximiná/PA" />
          </div>
          <div>
            <label className={labelCls}>Unidade principal</label>
            <input value={unidade?.nome || "—"} disabled className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Setor principal</label>
            <input value={setor?.nome || "—"} disabled className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Texto complementar</label>
            <textarea value={stamp.texto_personalizado || ""} onChange={e => setStamp(s => ({ ...s, texto_personalizado: e.target.value.slice(0, 200) }))} disabled={disabledByLock} rows={2} className={inputCls} placeholder='Ex.: "Coordenação CER II — SMS Oriximiná"' />
          </div>
        </div>
      </div>

      {/* SEÇÃO 3 — Campos exibidos no documento */}
      <div className={`${sectionCls} mb-4`}>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> 3. Campos exibidos no documento</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <Switch checked={stamp.mostrar_linha_assinatura} onChange={v => setStamp(s => ({ ...s, mostrar_linha_assinatura: v }))} label="Linha de assinatura" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_profissao} onChange={v => setStamp(s => ({ ...s, mostrar_profissao: v }))} label="Profissão" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_especialidade} onChange={v => setStamp(s => ({ ...s, mostrar_especialidade: v }))} label="Especialidade" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_conselho} onChange={v => setStamp(s => ({ ...s, mostrar_conselho: v }))} label="Conselho + Nº registro" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_uf_conselho} onChange={v => setStamp(s => ({ ...s, mostrar_uf_conselho: v }))} label="UF do conselho" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_cbo} onChange={v => setStamp(s => ({ ...s, mostrar_cbo: v }))} label="CBO" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_cns} onChange={v => setStamp(s => ({ ...s, mostrar_cns: v }))} label="CNS profissional" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_unidade} onChange={v => setStamp(s => ({ ...s, mostrar_unidade: v }))} label="Unidade" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_setor} onChange={v => setStamp(s => ({ ...s, mostrar_setor: v }))} label="Setor" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_cidade_uf} onChange={v => setStamp(s => ({ ...s, mostrar_cidade_uf: v }))} label="Cidade / UF" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_data_local} onChange={v => setStamp(s => ({ ...s, mostrar_data_local: v }))} label="Data e local" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_qr_code} onChange={v => setStamp(s => ({ ...s, mostrar_qr_code: v }))} label="QR Code de validação" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_codigo_validacao} onChange={v => setStamp(s => ({ ...s, mostrar_codigo_validacao: v }))} label="Código de validação" disabled={disabledByLock} />
          <Switch checked={stamp.mostrar_hash} onChange={v => setStamp(s => ({ ...s, mostrar_hash: v }))} label="Hash parcial do documento" disabled={disabledByLock} />
        </div>
      </div>

      {/* SEÇÃO 4 — Posição no documento */}
      <div className={`${sectionCls} mb-4`}>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Layout className="h-4 w-4 text-primary" /> 4. Posição e estilo no documento</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Posição no documento</label>
            <select value={stamp.assinatura_posicao} onChange={e => setStamp(s => ({ ...s, assinatura_posicao: e.target.value as Posicao }))} disabled={disabledByLock} className={inputCls}>
              {POSICOES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Estilo</label>
            <select value={stamp.estilo} onChange={e => setStamp(s => ({ ...s, estilo: e.target.value as Estilo }))} disabled={disabledByLock} className={inputCls}>
              <option value="compacto">Compacto</option>
              <option value="completo">Completo</option>
              <option value="oficial">Oficial</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Alinhamento do texto</label>
            <select value={stamp.alinhamento_texto} onChange={e => setStamp(s => ({ ...s, alinhamento_texto: e.target.value as Alinhamento }))} disabled={disabledByLock} className={inputCls}>
              <option value="esquerda">Esquerda</option>
              <option value="centro">Centro</option>
              <option value="direita">Direita</option>
              <option value="justificado">Justificado</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Largura (px): {stamp.largura}</label>
            <input type="range" min={200} max={600} step={10} value={stamp.largura} onChange={e => setStamp(s => ({ ...s, largura: Number(e.target.value) }))} disabled={disabledByLock} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Altura máxima (px): {stamp.altura_max}</label>
            <input type="range" min={100} max={400} step={10} value={stamp.altura_max} onChange={e => setStamp(s => ({ ...s, altura_max: Number(e.target.value) }))} disabled={disabledByLock} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Tamanho da fonte: {stamp.tamanho_fonte}px</label>
            <input type="range" min={9} max={18} step={1} value={stamp.tamanho_fonte} onChange={e => setStamp(s => ({ ...s, tamanho_fonte: Number(e.target.value) }))} disabled={disabledByLock} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Espaçamento superior: {stamp.espacamento_top}px</label>
            <input type="range" min={0} max={40} step={2} value={stamp.espacamento_top} onChange={e => setStamp(s => ({ ...s, espacamento_top: Number(e.target.value) }))} disabled={disabledByLock} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Espaçamento inferior: {stamp.espacamento_bottom}px</label>
            <input type="range" min={0} max={40} step={2} value={stamp.espacamento_bottom} onChange={e => setStamp(s => ({ ...s, espacamento_bottom: Number(e.target.value) }))} disabled={disabledByLock} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Cor do texto</label>
            <input type="color" value={stamp.cor_texto} onChange={e => setStamp(s => ({ ...s, cor_texto: e.target.value }))} disabled={disabledByLock} className="h-10 w-full rounded-lg border border-border bg-background" />
          </div>
        </div>
      </div>

      {/* SEÇÃO 5 — Upload */}
      <div className={`${sectionCls} mb-4`}>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> 5. Imagens (assinatura e carimbo físico)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UploadBox
            title="Imagem da assinatura"
            hint="PNG (preferencial transparente), JPG, JPEG · até 1,5 MB"
            url={assinaturaUrl}
            onPick={() => assRef.current?.click()}
            onRemove={() => removeImage.mutate("assinatura")}
            disabled={disabledByLock}
            kind="assinatura"
            sizeCtl={{ value: stamp.assinatura_tamanho, set: v => setStamp(s => ({ ...s, assinatura_tamanho: v })) }}
          />
          <UploadBox
            title="Imagem do carimbo físico"
            hint="PNG (preferencial transparente), JPG, JPEG · até 1,5 MB"
            url={carimboUrl}
            onPick={() => carRef.current?.click()}
            onRemove={() => removeImage.mutate("carimbo")}
            disabled={disabledByLock}
            kind="carimbo"
            sizeCtl={{ value: stamp.carimbo_tamanho, set: v => setStamp(s => ({ ...s, carimbo_tamanho: v })) }}
          />
        </div>
        <input ref={assRef} type="file" accept={ACCEPTED.join(",")} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage.mutate({ kind: "assinatura", file: f }); e.target.value = ""; }} />
        <input ref={carRef} type="file" accept={ACCEPTED.join(",")} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage.mutate({ kind: "carimbo", file: f }); e.target.value = ""; }} />
      </div>

      {/* SEÇÃO 6 — Preview */}
      <div className={`${sectionCls} mb-4`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> 6. Pré-visualização</h4>
          <select value={previewMode} onChange={e => setPreviewMode(e.target.value as any)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
            <option value="visual">Com assinatura visual</option>
            <option value="sem_assinatura">Sem assinatura visual</option>
            <option value="carimbo_fisico">Com carimbo físico</option>
            <option value="eletronica">Com assinatura eletrônica interna</option>
          </select>
        </div>
        <div className="rounded-xl border-2 border-dashed border-border bg-background p-6 flex justify-center">
          <div style={{ width: stamp.largura, maxHeight: stamp.altura_max, paddingTop: stamp.espacamento_top, paddingBottom: stamp.espacamento_bottom, color: stamp.cor_texto, textAlign: stamp.alinhamento_texto === "esquerda" ? "left" : stamp.alinhamento_texto === "direita" ? "right" : "center", fontSize: stamp.tamanho_fonte }}>
            {previewMode === "visual" && assinaturaUrl && (
              <img src={assinaturaUrl} alt="Assinatura" style={{ height: stamp.assinatura_tamanho * 0.5, margin: stamp.alinhamento_texto === "centro" ? "0 auto" : undefined }} />
            )}
            {previewMode === "carimbo_fisico" && carimboUrl && (
              <img src={carimboUrl} alt="Carimbo" style={{ height: stamp.carimbo_tamanho * 0.5, margin: stamp.alinhamento_texto === "centro" ? "0 auto" : undefined }} />
            )}
            {stamp.mostrar_linha_assinatura && previewMode !== "carimbo_fisico" && (
              <div className="border-t border-foreground/40 my-2" />
            )}
            {(stamp.estilo !== "oficial" || previewMode !== "eletronica") && linhas.map((l, i) => (
              <div key={i} style={{ fontWeight: i === 0 ? 600 : 400, fontSize: i === 0 ? stamp.tamanho_fonte + 1 : stamp.tamanho_fonte }}>{l}</div>
            ))}
            {previewMode === "eletronica" && (
              <div className="mt-2 text-[11px] italic text-muted-foreground" style={{ color: stamp.cor_texto }}>
                Documento assinado eletronicamente por <strong>{(professional?.nome || "—").toUpperCase()}</strong>
                {stamp.cargo ? `, ${stamp.cargo}` : ""}, em <em>{`{{data_hora_assinatura}}`}</em>.
                <br />
                Código de validação: <strong>{`{{codigo_validacao}}`}</strong>
                <br />Verifique a autenticidade pelo QR Code.
              </div>
            )}
            {stamp.mostrar_data_local && (
              <div className="mt-2 text-[11px]">{stamp.cidade_uf || "Oriximiná/PA"}, {`{{data_emissao}}`}</div>
            )}
            {stamp.mostrar_qr_code && (
              <div className="mt-2 inline-flex items-center gap-1 rounded border border-foreground/20 bg-background px-2 py-1 text-[10px]"><QrCode className="h-3 w-3" /> QR de validação</div>
            )}
            {stamp.mostrar_codigo_validacao && (
              <div className="mt-1 text-[10px]">Código: <strong>{`{{codigo_validacao}}`}</strong></div>
            )}
            {stamp.mostrar_hash && (
              <div className="mt-1 text-[10px] flex items-center justify-center gap-1"><Hash className="h-3 w-3" /> {`{{hash_documento_parcial}}`}</div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 7 — Contextos de uso */}
      <div className={`${sectionCls} mb-4`}>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" /> 7. Onde este carimbo pode ser usado</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {CONTEXTOS_USO.map(c => {
            const checked = stamp.contextos_uso.includes(c.value);
            return (
              <label key={c.value} className={`flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm cursor-pointer ${disabledByLock ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50"}`}>
                <span className="text-foreground">{c.label}</span>
                <input type="checkbox" disabled={disabledByLock} checked={checked} onChange={e => {
                  setStamp(s => ({ ...s, contextos_uso: e.target.checked ? [...s.contextos_uso, c.value] : s.contextos_uso.filter(v => v !== c.value) }));
                }} className="rounded" />
              </label>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 8 — Bloqueio Master */}
      {isMaster && (
        <div className={`${sectionCls} mb-4`}>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> 8. Controle do Gestor Master</h4>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={stamp.bloqueado} onChange={e => setStamp(s => ({ ...s, bloqueado: e.target.checked }))} className="rounded" />
            <span>Bloquear edição deste carimbo</span>
          </label>
          {stamp.bloqueado && (
            <input value={stamp.bloqueado_motivo || ""} onChange={e => setStamp(s => ({ ...s, bloqueado_motivo: e.target.value }))} placeholder="Motivo do bloqueio" className={`${inputCls} mt-2`} />
          )}
        </div>
      )}

      {/* SEÇÃO 9 — Botões */}
      <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
        <button onClick={restorePadrao} disabled={disabledByLock || save.isPending} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
          <RotateCcw className="h-4 w-4" /> Restaurar padrão
        </button>
        <button onClick={() => save.mutate()} disabled={disabledByLock || save.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar carimbo"}
        </button>
      </div>
    </section>
  );
}

function UploadBox({ title, hint, url, onPick, onRemove, disabled, kind, sizeCtl }: {
  title: string; hint: string; url: string | null; onPick: () => void; onRemove: () => void;
  disabled?: boolean; kind: "assinatura" | "carimbo"; sizeCtl: { value: number; set: (v: number) => void };
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {url && (
          <button onClick={onRemove} disabled={disabled} className="text-xs text-destructive hover:underline disabled:opacity-50 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Remover
          </button>
        )}
      </div>
      <div className="flex items-center justify-center min-h-[100px] rounded-md border border-dashed border-border bg-muted/30 mb-2 overflow-hidden">
        {url ? (
          <img src={url} alt={kind} style={{ maxHeight: 96 }} className="object-contain" />
        ) : (
          <div className="text-center text-xs text-muted-foreground p-3">
            <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-50" />
            Nenhuma imagem
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={onPick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
          <Upload className="h-3 w-3" /> {url ? "Substituir" : "Enviar"}
        </button>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
        <div>
          <label className="text-[10px] text-muted-foreground">Tamanho de exibição: {sizeCtl.value}px</label>
          <input type="range" min={60} max={480} step={10} value={sizeCtl.value} onChange={e => sizeCtl.set(Number(e.target.value))} disabled={disabled} className="w-full" />
        </div>
      </div>
    </div>
  );
}
