import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import {
  Stamp, Upload, X, Lock, AlertTriangle, Save, RotateCcw, Eye, FileSignature,
  PenLine, FileImage, ShieldCheck, Settings2, Layout, Type, QrCode, Hash, Info,
  User, BadgeCheck, Wand2, History, Building2, MapPin,
} from "lucide-react";

// =============================================================
// Carimbo e Assinatura Profissional — Padrão Hospitalar
// 7 abas, preenchimento automático, selects inteligentes, preview oficial.
// Reaproveita a tabela `professional_stamps` (sem migração nova).
// =============================================================

interface Props {
  profissionalId: string;
  isMaster?: boolean;
  isMyProfile?: boolean;
  compact?: boolean;
}

type TipoCarimbo = "digital_gerado" | "imagem_carimbo" | "assinatura_manuscrita" | "eletronica_interna";
type Estilo = "compacto" | "completo" | "oficial";
type Posicao = "esquerda" | "centro" | "direita" | "rodape_esquerdo" | "rodape_centro" | "rodape_direito" | "final_documento" | "personalizado";
type Alinhamento = "esquerda" | "centro" | "direita" | "justificado";
type TipoAssinante = "profissional_saude" | "coordenador" | "gestor_master" | "gestor_unidade" | "responsavel_tecnico" | "diretor_clinico" | "coord_enfermagem" | "administrativo" | "outro";

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
  contextos_uso: string[];
  bloqueado: boolean;
  bloqueado_motivo: string | null;
  metadata: Record<string, any>;
}

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg"];
const MAX_BYTES = 1.5 * 1024 * 1024;

const TIPOS_ASSINANTE: { value: TipoAssinante; label: string }[] = [
  { value: "profissional_saude", label: "Profissional de saúde" },
  { value: "coordenador", label: "Coordenador(a)" },
  { value: "gestor_master", label: "Gestor Master" },
  { value: "gestor_unidade", label: "Gestor de Unidade" },
  { value: "responsavel_tecnico", label: "Responsável Técnico" },
  { value: "diretor_clinico", label: "Diretor Clínico" },
  { value: "coord_enfermagem", label: "Coordenação de Enfermagem" },
  { value: "administrativo", label: "Administrativo autorizado" },
  { value: "outro", label: "Outro" },
];

const CARGOS_SUGESTAO = [
  "Médico Plantonista", "Enfermeiro(a) Plantonista", "Técnico(a) de Enfermagem",
  "Coordenador(a)", "Coordenador(a) de Enfermagem", "Coordenador(a) Médico",
  "Responsável Técnico", "Diretor Clínico", "Gestor Master", "Gestor de Unidade",
  "Administrativo", "Outro",
];

const ESPECIALIDADES = [
  "Clínica Médica", "Cardiologia", "Pediatria", "Ginecologia/Obstetrícia",
  "Ortopedia", "Fisioterapia Respiratória", "Fisioterapia Neurofuncional",
  "Psicologia Clínica", "Enfermagem", "Saúde Mental", "Reabilitação",
  "Administração Hospitalar", "Outra",
];

const CONSELHOS = ["CRM", "COREN", "CREFITO", "CRP", "CRESS", "CRN", "CRF", "CRO", "CREFONO", "CRA", "Não se aplica", "Outro"];

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const CBO_SUGESTAO = [
  { v: "2251-25", label: "2251-25 Médico clínico" },
  { v: "2251-70", label: "2251-70 Médico generalista" },
  { v: "2235-05", label: "2235-05 Enfermeiro" },
  { v: "3222-05", label: "3222-05 Técnico de enfermagem" },
  { v: "2236-05", label: "2236-05 Fisioterapeuta" },
  { v: "2515-10", label: "2515-10 Psicólogo clínico" },
  { v: "2516-05", label: "2516-05 Assistente social" },
  { v: "2237-10", label: "2237-10 Nutricionista" },
  { v: "2234-05", label: "2234-05 Farmacêutico" },
  { v: "2232-08", label: "2232-08 Cirurgião dentista" },
  { v: "4110-10", label: "4110-10 Assistente administrativo" },
];

const TEXTOS_COMPLEMENTARES = [
  "Hospital Municipal de Oriximiná",
  "Secretaria Municipal de Saúde",
  "Coordenação CER II — SMS Oriximiná",
  "Coordenação de Enfermagem",
  "Coordenação Médica",
  "Responsável Técnico",
  "GestorPlantão SMS Oriximiná",
  "Plantonista",
];

// Mapeamento profissão -> conselho/CBO sugerido
function sugerirConselho(profissao?: string | null): string {
  const p = String(profissao || "").toLowerCase();
  if (p.includes("médico") || p.includes("medico")) return "CRM";
  if (p.includes("enferm") && !p.includes("técnic") && !p.includes("tecnic")) return "COREN";
  if (p.includes("técnic") && p.includes("enferm")) return "COREN";
  if (p.includes("fisio")) return "CREFITO";
  if (p.includes("terap") && p.includes("ocupac")) return "CREFITO";
  if (p.includes("psic")) return "CRP";
  if (p.includes("assist") && p.includes("social")) return "CRESS";
  if (p.includes("nutric")) return "CRN";
  if (p.includes("farm")) return "CRF";
  if (p.includes("dentista") || p.includes("odont")) return "CRO";
  if (p.includes("fono")) return "CREFONO";
  return "Não se aplica";
}

function sugerirCBO(profissao?: string | null): string {
  const p = String(profissao || "").toLowerCase();
  if (p.includes("médico") || p.includes("medico")) return "2251-25";
  if (p.includes("enferm") && !p.includes("técnic") && !p.includes("tecnic")) return "2235-05";
  if (p.includes("técnic") && p.includes("enferm")) return "3222-05";
  if (p.includes("fisio")) return "2236-05";
  if (p.includes("psic")) return "2515-10";
  if (p.includes("assist") && p.includes("social")) return "2516-05";
  if (p.includes("nutric")) return "2237-10";
  if (p.includes("farm")) return "2234-05";
  if (p.includes("dentista") || p.includes("odont")) return "2232-08";
  if (p.includes("admin")) return "4110-10";
  return "";
}

function sugerirCargo(profissao?: string | null, tipoAssinante?: TipoAssinante): string {
  if (tipoAssinante === "gestor_master") return "Gestor Master";
  if (tipoAssinante === "gestor_unidade") return "Gestor de Unidade";
  if (tipoAssinante === "diretor_clinico") return "Diretor Clínico";
  if (tipoAssinante === "responsavel_tecnico") return "Responsável Técnico";
  if (tipoAssinante === "coord_enfermagem") return "Coordenador(a) de Enfermagem";
  if (tipoAssinante === "coordenador") return "Coordenador(a)";
  const p = String(profissao || "").toLowerCase();
  if (p.includes("médico") || p.includes("medico")) return "Médico Plantonista";
  if (p.includes("enferm") && !p.includes("técnic") && !p.includes("tecnic")) return "Enfermeiro(a) Plantonista";
  if (p.includes("técnic") && p.includes("enferm")) return "Técnico(a) de Enfermagem";
  return "";
}

const CONTEXTOS_USO = [
  { value: "escala_mensal", label: "Escala mensal oficial" },
  { value: "escala_semanal", label: "Escala semanal" },
  { value: "comprovante_plantao", label: "Comprovante de plantão" },
  { value: "comprovante_troca", label: "Comprovante de troca de plantão" },
  { value: "solicitacao_troca", label: "Solicitação de troca" },
  { value: "aceite_troca", label: "Aceite de troca" },
  { value: "aprovacao_troca", label: "Aprovação de troca" },
  { value: "recusa_troca", label: "Recusa de troca" },
  { value: "relatorios", label: "Relatórios" },
  { value: "documentos_personalizados", label: "Documentos personalizados" },
];

const POSICOES: { value: Posicao; label: string }[] = [
  { value: "esquerda", label: "Esquerda" },
  { value: "centro", label: "Centro" },
  { value: "direita", label: "Direita" },
  { value: "rodape_esquerdo", label: "Rodapé esquerdo" },
  { value: "rodape_centro", label: "Rodapé central" },
  { value: "rodape_direito", label: "Rodapé direito" },
  { value: "final_documento", label: "Final do documento" },
  { value: "personalizado", label: "Campo personalizado do modelo" },
];

const emptyStamp = (profId: string): StampRow => ({
  profissional_id: profId,
  tipo: "digital_gerado",
  cargo: "", especialidade: "", uf_conselho: "PA", cbo: "", cns: "", cidade_uf: "Oriximiná/PA",
  texto_personalizado: "",
  assinatura_path: null, carimbo_path: null,
  assinatura_posicao: "centro",
  assinatura_tamanho: 180, carimbo_tamanho: 140,
  cor_texto: "#0f172a",
  estilo: "oficial",
  largura: 380, altura_max: 220,
  espacamento_top: 10, espacamento_bottom: 10,
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
  mostrar_cidade_uf: true,
  mostrar_data_local: false,
  mostrar_codigo_validacao: false,
  mostrar_hash: false,
  mostrar_qr_code: false,
  contextos_uso: [],
  bloqueado: false, bloqueado_motivo: "",
  metadata: { tipo_assinante: "profissional_saude", matricula: "", conselho_manual: "" },
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

const TABS = [
  { id: "assinante", label: "Dados do Assinante", icon: User },
  { id: "conselho", label: "Conselho e Registro", icon: BadgeCheck },
  { id: "imagens", label: "Assinatura e Carimbo", icon: PenLine },
  { id: "exibicao", label: "Exibição no Documento", icon: Settings2 },
  { id: "preview", label: "Pré-visualização", icon: Eye },
  { id: "permissoes", label: "Permissões e Uso", icon: ShieldCheck },
  { id: "historico", label: "Histórico", icon: History },
] as const;

type TabId = typeof TABS[number]["id"];

export default function CarimboAssinaturaProfissional({ profissionalId, isMaster, isMyProfile, compact }: Props) {
  const sb = supabase as any;
  const qc = useQueryClient();
  const { isMaster: myIsMaster, isCoordinator: myIsCoordinator, user } = useAuth();
  const [stamp, setStamp] = useState<StampRow>(emptyStamp(profissionalId));
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [carimboUrl, setCarimboUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"visual" | "carimbo_fisico" | "eletronica" | "sem_assinatura">("visual");
  const [tab, setTab] = useState<TabId>("assinante");
  const [tipoAssinante, setTipoAssinante] = useState<TipoAssinante>("profissional_saude");
  const [conselhoManual, setConselhoManual] = useState<string>("");
  const [matricula, setMatricula] = useState<string>("");
  const assRef = useRef<HTMLInputElement>(null);
  const carRef = useRef<HTMLInputElement>(null);

  const { data: professional } = useQuery({
    queryKey: ["prof-for-stamp", profissionalId],
    queryFn: async () => {
      const { data } = await supabase.from("professionals")
        .select("nome,profissao,especialidade,conselho,registro,documento_conselho,documento_numero,unidade_principal_id,setor_principal_id,user_id")
        .eq("id", profissionalId).maybeSingle();
      return data as any;
    },
    enabled: !!profissionalId,
  });

  const isOwnProfile = useMemo(() => {
    if (isMyProfile) return true;
    if (!user?.id || !professional?.user_id) return false;
    return user.id === professional.user_id;
  }, [user?.id, professional?.user_id, isMyProfile]);

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

  const { data: history } = useQuery({
    queryKey: ["stamp-history", profissionalId],
    queryFn: async () => {
      const { data } = await sb.from("audit_logs")
        .select("acao,usuario_nome,created_at,detalhes")
        .eq("modulo", "carimbo_digital")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []).filter((r: any) => r?.detalhes?.profissional_id === profissionalId);
    },
    enabled: !!profissionalId && tab === "historico",
  });

  useEffect(() => {
    if (existing) {
      setStamp({ ...emptyStamp(profissionalId), ...existing });
      const md = (existing as any).metadata || {};
      
      // Se for o próprio perfil, estabelece o tipo de acordo com o acesso
      if (isOwnProfile) {
        if (myIsMaster) setTipoAssinante("gestor_master");
        else if (myIsCoordinator) setTipoAssinante("coordenador");
        else if (md.tipo_assinante) setTipoAssinante(md.tipo_assinante);
      } else if (md.tipo_assinante) {
        setTipoAssinante(md.tipo_assinante);
      }

      if (md.conselho_manual) setConselhoManual(md.conselho_manual);
      if (md.matricula) setMatricula(md.matricula);
    } else {
      setStamp(emptyStamp(profissionalId));
      if (isOwnProfile) {
        if (myIsMaster) setTipoAssinante("gestor_master");
        else if (myIsCoordinator) setTipoAssinante("coordenador");
      }
    }
  }, [existing, profissionalId, isOwnProfile, myIsMaster, myIsCoordinator]);


  useEffect(() => {
    if (isOwnProfile) {
      if (myIsMaster && tipoAssinante !== "gestor_master") {
        setTipoAssinante("gestor_master");
      } else if (myIsCoordinator && tipoAssinante !== "coordenador") {
        setTipoAssinante("coordenador");
      }
    }
  }, [isOwnProfile, myIsMaster, myIsCoordinator, tipoAssinante]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const a = await getSignedUrl(stamp.assinatura_path);
      const c = await getSignedUrl(stamp.carimbo_path);
      if (!cancel) { setAssinaturaUrl(a); setCarimboUrl(c); }
    })();
    return () => { cancel = true; };
  }, [stamp.assinatura_path, stamp.carimbo_path]);

  const conselho = conselhoManual || professional?.documento_conselho || professional?.conselho || sugerirConselho(professional?.profissao);
  const registro = professional?.documento_numero || professional?.registro || "";

  const uploadImage = useMutation({
    mutationFn: async ({ kind, file }: { kind: "assinatura" | "carimbo"; file: File }) => {
      if (!ACCEPTED.includes(file.type)) throw new Error("Apenas PNG, JPG ou JPEG.");
      if (file.size > MAX_BYTES) throw new Error("Arquivo acima de 1,5 MB.");
      const safe = sanitizeFileName(file.name);
      const path = `stamps/${profissionalId}/${kind}_${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("professional-documents").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const oldPath = kind === "assinatura" ? stamp.assinatura_path : stamp.carimbo_path;
      if (oldPath) await supabase.storage.from("professional-documents").remove([oldPath]).catch(() => {});
      setStamp(s => ({ ...s, [kind === "assinatura" ? "assinatura_path" : "carimbo_path"]: path }));
      await logAudit(`upload_${kind}_carimbo`, "carimbo_digital", { profissional_id: profissionalId, path });
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
      await logAudit(`remocao_${kind}_carimbo`, "carimbo_digital", { profissional_id: profissionalId });
    },
    onSuccess: () => toast.success("Imagem removida."),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...stamp,
        profissional_id: profissionalId,
        metadata: { ...(stamp.metadata || {}), tipo_assinante: tipoAssinante, conselho_manual: conselhoManual, matricula },
      };
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
    toast.info("Padrões restaurados (não salvos ainda).");
  };

  const preencherAuto = () => {
    if (!professional) return toast.error("Dados do profissional não carregados.");
    const sobrescrever = (!stamp.cargo && !stamp.cbo && !conselhoManual) ||
      window.confirm("Já existem dados preenchidos. Deseja sobrescrever com os dados do cadastro?");
    if (!sobrescrever) return;
    const novoCargo = sugerirCargo(professional.profissao, tipoAssinante);
    const novoCbo = sugerirCBO(professional.profissao);
    const novoConselho = sugerirConselho(professional.profissao);
    setStamp(s => ({
      ...s,
      cargo: novoCargo || s.cargo,
      cbo: novoCbo || s.cbo,
      especialidade: professional.especialidade || s.especialidade,
      cidade_uf: s.cidade_uf || "Oriximiná/PA",
      uf_conselho: s.uf_conselho || "PA",
    }));
    setConselhoManual(novoConselho);
    toast.success("Campos preenchidos automaticamente. Revise antes de salvar.");
  };

  const linhas = useMemo(() => {
    const arr: string[] = [];
    if (professional?.nome) arr.push((professional.nome as string).toUpperCase());
    if (stamp.cargo) arr.push(stamp.cargo);
    if (stamp.mostrar_profissao && professional?.profissao && stamp.cargo !== professional.profissao) arr.push(String(professional.profissao));
    if (stamp.mostrar_especialidade && (stamp.especialidade || professional?.especialidade)) arr.push(stamp.especialidade || professional?.especialidade);
    if (stamp.mostrar_conselho && (conselho || registro) && conselho !== "Não se aplica") {
      const parts = [conselho, registro].filter(Boolean).join(" ");
      const final = stamp.mostrar_uf_conselho && stamp.uf_conselho ? `${parts} / ${stamp.uf_conselho}` : parts;
      if (final.trim()) arr.push(final);
    }
    if (stamp.mostrar_cbo && stamp.cbo) arr.push(`CBO: ${stamp.cbo}`);
    if (stamp.mostrar_cns && stamp.cns) arr.push(`CNS: ${stamp.cns}`);
    if (matricula) arr.push(`Matrícula: ${matricula}`);
    if (stamp.mostrar_unidade && unidade?.nome) arr.push(unidade.nome);
    if (stamp.mostrar_setor && setor?.nome) arr.push(setor.nome);
    if (stamp.texto_personalizado) arr.push(stamp.texto_personalizado);
    if (stamp.mostrar_cidade_uf && stamp.cidade_uf) arr.push(stamp.cidade_uf);
    return arr;
  }, [stamp, professional, unidade, setor, conselho, registro, matricula]);

  const disabledByLock = stamp.bloqueado && !isMaster;
  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 disabled:bg-muted/50";
  const labelCls = "text-xs font-medium text-muted-foreground mb-1.5 block";
  const cardSection = "rounded-xl border border-border/70 bg-card/50 p-5";

  const Switch = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
    <label className={`flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm cursor-pointer transition ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-primary/40 hover:bg-primary/5"}`}>
      <span className="text-foreground">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="rounded accent-primary" />
    </label>
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse">
        <div className="h-5 w-64 bg-muted rounded mb-4" />
        <div className="h-40 bg-muted/60 rounded" />
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden ${compact ? "" : ""}`}>
      {/* Header hospitalar */}
      <header className="bg-gradient-to-r from-primary/5 via-card to-accent/5 border-b border-border px-6 py-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Stamp className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground tracking-tight">Carimbo e Assinatura Profissional</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Padrão hospitalar institucional · GestorPlantão SMS Oriximiná</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stamp.bloqueado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/20">
              <Lock className="h-3 w-3" /> Bloqueado
            </span>
          )}
          <button
            onClick={preencherAuto}
            disabled={disabledByLock}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" /> Preencher automaticamente
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="px-6 pt-4 border-b border-border bg-background/40 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-6 space-y-5">
        {stamp.bloqueado && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <strong>Edição bloqueada pelo Gestor Master.</strong>
              {stamp.bloqueado_motivo && <div className="mt-1 text-foreground/80">{stamp.bloqueado_motivo}</div>}
            </div>
          </div>
        )}

        {/* ABA 1 — Dados do Assinante */}
        {tab === "assinante" && (
          <div className={cardSection}>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary" />
              <h4 className="text-base font-semibold text-foreground">Dados do Assinante</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground block mb-0">Tipo de assinante</label>
                  {isOwnProfile && (myIsMaster || myIsCoordinator) && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                      <ShieldCheck className="h-2.5 w-2.5" /> Automático (Gestão)
                    </span>
                  )}
                </div>
                {isOwnProfile && (myIsMaster || myIsCoordinator) ? (
                  <div className="relative">
                    <input 
                      value={TIPOS_ASSINANTE.find(t => t.value === tipoAssinante)?.label || (myIsMaster ? "Gestor Master" : "Coordenador(a)")} 
                      readOnly 
                      className={`${inputCls} pr-10 font-medium border-primary/20 bg-primary/5`} 
                    />
                    <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  </div>
                ) : (
                  <select 
                    value={tipoAssinante} 
                    onChange={e => setTipoAssinante(e.target.value as TipoAssinante)} 
                    disabled={disabledByLock} 
                    className={inputCls}
                  >
                    {TIPOS_ASSINANTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                )}
                {isOwnProfile && (myIsMaster || myIsCoordinator) && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Definido permanentemente com base no seu nível de acesso.
                  </p>
                )}
              </div>
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
                <input list="cargos-list" value={stamp.cargo || ""} onChange={e => setStamp(s => ({ ...s, cargo: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Selecione ou digite" />
                <datalist id="cargos-list">
                  {CARGOS_SUGESTAO.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Especialidade</label>
                <input list="esp-list" value={stamp.especialidade || ""} onChange={e => setStamp(s => ({ ...s, especialidade: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder={professional?.especialidade || "Ex.: Cardiologia"} />
                <datalist id="esp-list">
                  {ESPECIALIDADES.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Unidade principal</label>
                <input value={unidade?.nome || "—"} disabled className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Setor principal</label>
                <input value={setor?.nome || "—"} disabled className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cidade / UF</label>
                <input value={stamp.cidade_uf || ""} onChange={e => setStamp(s => ({ ...s, cidade_uf: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Oriximiná/PA" />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Texto complementar</label>
                <input list="txt-list" value={stamp.texto_personalizado || ""} onChange={e => setStamp(s => ({ ...s, texto_personalizado: e.target.value.slice(0, 200) }))} disabled={disabledByLock} className={inputCls} placeholder='Ex.: "Coordenação CER II — SMS Oriximiná"' />
                <datalist id="txt-list">
                  {TEXTOS_COMPLEMENTARES.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2 — Conselho e Registro */}
        {tab === "conselho" && (
          <div className={cardSection}>
            <div className="flex items-center gap-2 mb-4">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <h4 className="text-base font-semibold text-foreground">Conselho e Registro</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Conselho</label>
                <select value={conselhoManual || sugerirConselho(professional?.profissao)} onChange={e => setConselhoManual(e.target.value)} disabled={disabledByLock} className={inputCls}>
                  {CONSELHOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Sugestão baseada na profissão: {sugerirConselho(professional?.profissao)}</p>
              </div>
              <div>
                <label className={labelCls}>Número do registro</label>
                <input value={registro} disabled className={inputCls} placeholder="Ex.: 12345-F" />
                <p className="text-[11px] text-muted-foreground mt-1">Editar em "Profissionais → Editar Profissional".</p>
              </div>
              <div>
                <label className={labelCls}>UF do conselho</label>
                <select value={stamp.uf_conselho || "PA"} onChange={e => setStamp(s => ({ ...s, uf_conselho: e.target.value }))} disabled={disabledByLock} className={inputCls}>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>CBO</label>
                <input list="cbo-list" value={stamp.cbo || ""} onChange={e => setStamp(s => ({ ...s, cbo: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder={sugerirCBO(professional?.profissao) || "Ex.: 2251-25"} />
                <datalist id="cbo-list">
                  {CBO_SUGESTAO.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>CNS profissional <span className="text-muted-foreground/70">(opcional)</span></label>
                <input value={stamp.cns || ""} onChange={e => setStamp(s => ({ ...s, cns: e.target.value.replace(/\D/g, "").slice(0, 15) }))} disabled={disabledByLock} className={inputCls} placeholder="Cartão Nacional de Saúde" />
              </div>
              <div>
                <label className={labelCls}>Matrícula funcional <span className="text-muted-foreground/70">(opcional)</span></label>
                <input value={matricula} onChange={e => setMatricula(e.target.value.slice(0, 30))} disabled={disabledByLock} className={inputCls} placeholder="Ex.: 12345" />
              </div>
            </div>
          </div>
        )}

        {/* ABA 3 — Assinatura e Carimbo */}
        {tab === "imagens" && (
          <div className="space-y-5">
            <div className={cardSection}>
              <div className="flex items-center gap-2 mb-4">
                <FileSignature className="h-5 w-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">Tipo de assinatura/carimbo</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { v: "digital_gerado" as TipoCarimbo, t: "Carimbo digital gerado", d: "Monta automaticamente com nome, cargo, conselho e registro.", i: <Stamp className="h-4 w-4" /> },
                  { v: "imagem_carimbo" as TipoCarimbo, t: "Imagem do carimbo físico", d: "Usa a imagem do carimbo enviada abaixo.", i: <FileImage className="h-4 w-4" /> },
                  { v: "assinatura_manuscrita" as TipoCarimbo, t: "Assinatura manuscrita digitalizada", d: "Usa a imagem da assinatura enviada.", i: <PenLine className="h-4 w-4" /> },
                  { v: "eletronica_interna" as TipoCarimbo, t: "Assinatura eletrônica interna", d: "Sistema registra usuário, data/hora, hash e código.", i: <ShieldCheck className="h-4 w-4" /> },
                ].map(opt => (
                  <label key={opt.v} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${stamp.tipo === opt.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"} ${disabledByLock ? "opacity-60 cursor-not-allowed" : ""}`}>
                    <input type="radio" name="tipo" disabled={disabledByLock} checked={stamp.tipo === opt.v} onChange={() => setStamp(s => ({ ...s, tipo: opt.v }))} className="mt-1 accent-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">{opt.i}{opt.t}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.d}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground flex items-start gap-1.5"><Info className="h-3 w-3 mt-0.5" /> Carimbo visual e assinatura eletrônica interna não são ICP-Brasil. Campo preparado para integração futura.</p>
            </div>

            <div className={cardSection}>
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">Imagens (PNG, JPG, JPEG · até 1,5 MB)</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UploadBox
                  title="Imagem da assinatura"
                  hint="PNG transparente recomendado"
                  url={assinaturaUrl}
                  onPick={() => assRef.current?.click()}
                  onRemove={() => removeImage.mutate("assinatura")}
                  disabled={disabledByLock}
                  kind="assinatura"
                  sizeCtl={{ value: stamp.assinatura_tamanho, set: v => setStamp(s => ({ ...s, assinatura_tamanho: v })) }}
                />
                <UploadBox
                  title="Imagem do carimbo físico"
                  hint="PNG transparente recomendado"
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
          </div>
        )}

        {/* ABA 4 — Exibição no documento */}
        {tab === "exibicao" && (
          <div className="space-y-5">
            <div className={cardSection}>
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="h-5 w-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">Campos exibidos</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <Switch checked={stamp.mostrar_linha_assinatura} onChange={v => setStamp(s => ({ ...s, mostrar_linha_assinatura: v }))} label="Linha de assinatura" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_profissao} onChange={v => setStamp(s => ({ ...s, mostrar_profissao: v }))} label="Profissão" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_especialidade} onChange={v => setStamp(s => ({ ...s, mostrar_especialidade: v }))} label="Especialidade" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_conselho} onChange={v => setStamp(s => ({ ...s, mostrar_conselho: v }))} label="Conselho + Nº registro" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_uf_conselho} onChange={v => setStamp(s => ({ ...s, mostrar_uf_conselho: v }))} label="UF do conselho" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_cbo} onChange={v => setStamp(s => ({ ...s, mostrar_cbo: v }))} label="CBO" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_cns} onChange={v => setStamp(s => ({ ...s, mostrar_cns: v }))} label="CNS" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_unidade} onChange={v => setStamp(s => ({ ...s, mostrar_unidade: v }))} label="Unidade" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_setor} onChange={v => setStamp(s => ({ ...s, mostrar_setor: v }))} label="Setor" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_cidade_uf} onChange={v => setStamp(s => ({ ...s, mostrar_cidade_uf: v }))} label="Cidade / UF" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_data_local} onChange={v => setStamp(s => ({ ...s, mostrar_data_local: v }))} label="Data e local" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_qr_code} onChange={v => setStamp(s => ({ ...s, mostrar_qr_code: v }))} label="QR Code de validação" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_codigo_validacao} onChange={v => setStamp(s => ({ ...s, mostrar_codigo_validacao: v }))} label="Código de validação" disabled={disabledByLock} />
                <Switch checked={stamp.mostrar_hash} onChange={v => setStamp(s => ({ ...s, mostrar_hash: v }))} label="Hash parcial" disabled={disabledByLock} />
              </div>
            </div>

            <div className={cardSection}>
              <div className="flex items-center gap-2 mb-4">
                <Layout className="h-5 w-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">Posição e estilo</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <option value="completo">Profissional</option>
                    <option value="oficial">Oficial Hospitalar</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Alinhamento</label>
                  <select value={stamp.alinhamento_texto} onChange={e => setStamp(s => ({ ...s, alinhamento_texto: e.target.value as Alinhamento }))} disabled={disabledByLock} className={inputCls}>
                    <option value="esquerda">Esquerda</option>
                    <option value="centro">Centro</option>
                    <option value="direita">Direita</option>
                    <option value="justificado">Justificado</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Largura: {stamp.largura}px</label>
                  <input type="range" min={200} max={600} step={10} value={stamp.largura} onChange={e => setStamp(s => ({ ...s, largura: Number(e.target.value) }))} disabled={disabledByLock} className="w-full accent-primary" />
                </div>
                <div>
                  <label className={labelCls}>Altura máxima: {stamp.altura_max}px</label>
                  <input type="range" min={100} max={400} step={10} value={stamp.altura_max} onChange={e => setStamp(s => ({ ...s, altura_max: Number(e.target.value) }))} disabled={disabledByLock} className="w-full accent-primary" />
                </div>
                <div>
                  <label className={labelCls}>Tamanho da fonte: {stamp.tamanho_fonte}px</label>
                  <input type="range" min={9} max={18} step={1} value={stamp.tamanho_fonte} onChange={e => setStamp(s => ({ ...s, tamanho_fonte: Number(e.target.value) }))} disabled={disabledByLock} className="w-full accent-primary" />
                </div>
                <div>
                  <label className={labelCls}>Cor do texto</label>
                  <input type="color" value={stamp.cor_texto} onChange={e => setStamp(s => ({ ...s, cor_texto: e.target.value }))} disabled={disabledByLock} className="h-10 w-full rounded-lg border border-border bg-background cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 5 — Pré-visualização */}
        {tab === "preview" && (
          <div className={cardSection}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">Pré-visualização oficial</h4>
              </div>
              <select value={previewMode} onChange={e => setPreviewMode(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
                <option value="visual">Com assinatura visual</option>
                <option value="sem_assinatura">Sem assinatura visual</option>
                <option value="carimbo_fisico">Com carimbo físico</option>
                <option value="eletronica">Com assinatura eletrônica interna</option>
              </select>
            </div>
            <div className="rounded-xl border-2 border-dashed border-border bg-gradient-to-br from-background to-muted/30 p-8 flex justify-center">
              <div style={{
                width: stamp.largura,
                maxHeight: stamp.altura_max,
                paddingTop: stamp.espacamento_top,
                paddingBottom: stamp.espacamento_bottom,
                color: stamp.cor_texto,
                textAlign: stamp.alinhamento_texto === "esquerda" ? "left" : stamp.alinhamento_texto === "direita" ? "right" : stamp.alinhamento_texto === "justificado" ? "justify" : "center",
                fontSize: stamp.tamanho_fonte,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                {previewMode === "visual" && assinaturaUrl && (
                  <img src={assinaturaUrl} alt="Assinatura" style={{ height: stamp.assinatura_tamanho * 0.5, margin: stamp.alinhamento_texto === "centro" ? "0 auto" : undefined }} />
                )}
                {previewMode === "carimbo_fisico" && carimboUrl && (
                  <img src={carimboUrl} alt="Carimbo" style={{ height: stamp.carimbo_tamanho * 0.5, margin: stamp.alinhamento_texto === "centro" ? "0 auto" : undefined }} />
                )}
                {stamp.mostrar_linha_assinatura && previewMode !== "carimbo_fisico" && (
                  <div className="border-t border-foreground/40 my-2 mx-auto" style={{ width: "85%" }} />
                )}
                {previewMode !== "eletronica" && linhas.map((l, i) => (
                  <div key={i} style={{
                    fontWeight: i === 0 ? 700 : i === 1 ? 600 : 400,
                    fontSize: i === 0 ? stamp.tamanho_fonte + 1 : stamp.tamanho_fonte,
                    letterSpacing: i === 0 ? "0.02em" : undefined,
                    lineHeight: 1.4,
                  }}>{l}</div>
                ))}
                {previewMode === "eletronica" && (
                  <div className="mt-2 text-[11px] italic" style={{ color: stamp.cor_texto, lineHeight: 1.5 }}>
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
                  <div className="mt-3 inline-flex items-center gap-1 rounded border border-foreground/20 bg-background px-2 py-1 text-[10px]"><QrCode className="h-3 w-3" /> QR de validação</div>
                )}
                {stamp.mostrar_codigo_validacao && (
                  <div className="mt-1 text-[10px]">Código: <strong>{`{{codigo_validacao}}`}</strong></div>
                )}
                {stamp.mostrar_hash && (
                  <div className="mt-1 text-[10px] flex items-center justify-center gap-1"><Hash className="h-3 w-3" /> {`{{hash_documento_parcial}}`}</div>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><Info className="h-3 w-3" /> Visualização aproximada de como o carimbo aparecerá em escalas, comprovantes e documentos oficiais.</p>
          </div>
        )}

        {/* ABA 6 — Permissões e Uso */}
        {tab === "permissoes" && (
          <div className="space-y-5">
            <div className={cardSection}>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h4 className="text-base font-semibold text-foreground">Onde este carimbo pode ser usado</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CONTEXTOS_USO.map(c => {
                  const checked = stamp.contextos_uso.includes(c.value);
                  return (
                    <label key={c.value} className={`flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm cursor-pointer ${disabledByLock ? "opacity-60 cursor-not-allowed" : "hover:border-primary/40 hover:bg-primary/5"}`}>
                      <span className="text-foreground">{c.label}</span>
                      <input type="checkbox" disabled={disabledByLock} checked={checked} onChange={e => {
                        setStamp(s => ({ ...s, contextos_uso: e.target.checked ? [...s.contextos_uso, c.value] : s.contextos_uso.filter(v => v !== c.value) }));
                      }} className="rounded accent-primary" />
                    </label>
                  );
                })}
              </div>
            </div>

            {isMaster && (
              <div className={cardSection}>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-primary" />
                  <h4 className="text-base font-semibold text-foreground">Controle do Gestor Master</h4>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={stamp.bloqueado} onChange={e => setStamp(s => ({ ...s, bloqueado: e.target.checked }))} className="rounded accent-primary" />
                  <span>Bloquear edição deste carimbo</span>
                </label>
                {stamp.bloqueado && (
                  <input value={stamp.bloqueado_motivo || ""} onChange={e => setStamp(s => ({ ...s, bloqueado_motivo: e.target.value }))} placeholder="Motivo do bloqueio" className={`${inputCls} mt-3`} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA 7 — Histórico */}
        {tab === "historico" && (
          <div className={cardSection}>
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-primary" />
              <h4 className="text-base font-semibold text-foreground">Histórico de alterações</h4>
            </div>
            {!history || history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nenhum registro de alteração encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-left py-2 px-2">Ação</th>
                      <th className="text-left py-2 px-2">Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-2 text-foreground">{r.acao}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.usuario_nome || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer com botões */}
      <footer className="border-t border-border bg-muted/30 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> SMS Oriximiná
          <span className="mx-1">·</span>
          <MapPin className="h-3.5 w-3.5" /> {stamp.cidade_uf || "Oriximiná/PA"}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={restorePadrao} disabled={disabledByLock || save.isPending} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </button>
          <button onClick={() => save.mutate()} disabled={disabledByLock || save.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-sm">
            <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar carimbo"}
          </button>
        </div>
      </footer>
    </section>
  );
}

function UploadBox({ title, hint, url, onPick, onRemove, disabled, kind, sizeCtl }: {
  title: string; hint: string; url: string | null; onPick: () => void; onRemove: () => void;
  disabled?: boolean; kind: "assinatura" | "carimbo"; sizeCtl: { value: number; set: (v: number) => void };
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {url && (
          <button onClick={onRemove} disabled={disabled} className="text-xs text-destructive hover:underline disabled:opacity-50 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Remover
          </button>
        )}
      </div>
      <div className="flex items-center justify-center min-h-[120px] rounded-md border border-dashed border-border bg-muted/30 mb-3 overflow-hidden">
        {url ? (
          <img src={url} alt={kind} style={{ maxHeight: 110 }} className="object-contain" />
        ) : (
          <div className="text-xs text-muted-foreground text-center px-3">{hint}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onPick} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
          <Upload className="h-3 w-3" /> {url ? "Substituir" : "Enviar imagem"}
        </button>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground block">Tamanho preview: {sizeCtl.value}</label>
          <input type="range" min={80} max={300} value={sizeCtl.value} onChange={e => sizeCtl.set(Number(e.target.value))} disabled={disabled} className="w-full accent-primary" />
        </div>
      </div>
    </div>
  );
}
