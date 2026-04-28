import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Loader2,
  Search,
  ArrowLeft,
  FileText,
  AlertTriangle,
  History,
} from "lucide-react";

/**
 * Tela de validação de documentos por código + QR Code.
 *
 * - Rota pública: /validar-documento  e  /validar-documento/:codigo
 * - Rota interna: mesma página, com mais detalhes quando logado.
 * - Mantém compatibilidade com /validar/:codigo (assinaturas legadas).
 *
 * Não expõe CPF, dados bancários, endereço, conteúdo completo no modo público.
 */

type DocStatus =
  | "valido"
  | "retificado"
  | "cancelado"
  | "assinatura_pendente"
  | "assinatura_invalida"
  | "nao_encontrado";

interface DocResult {
  origem: "documento" | "assinatura";
  // Documento gerado
  document_id?: string;
  tipo_documento?: string;
  titulo?: string;
  unidade_nome?: string | null;
  setor_nome?: string | null;
  data_emissao?: string;
  versao?: number;
  status_doc?: string;
  retificado?: boolean;
  hash_parcial?: string;
  codigo_validacao: string;
  conteudo_html?: string;
  // Assinatura
  signer_name?: string;
  signer_role?: string;
  signed_at?: string;
  signature_status?: string;
  document_version?: number;
}

const ROLE_LABEL: Record<string, string> = {
  profissional: "Profissional de saúde",
  coordenador: "Coordenador",
  gestor_master: "Gestor Master",
  institucional: "Assinatura institucional",
};

const DOC_LABEL: Record<string, string> = {
  comprovante_plantao: "Comprovante de plantão",
  troca: "Troca de plantão",
  troca_plantao: "Troca de plantão",
  escala_mensal: "Escala mensal oficial",
  escala_mensal_oficial: "Escala mensal oficial",
  escala_semanal: "Escala semanal",
  relatorio: "Relatório oficial",
  relatorio_oficial: "Relatório oficial",
  modelo_personalizado: "Documento personalizado",
  documento_personalizado: "Documento personalizado",
  outro: "Documento",
};

function StatusBadge({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { cls: string; label: string; Icon: any }> = {
    valido: { cls: "bg-green-500/10 text-green-700 border-green-500/30", label: "Válido", Icon: ShieldCheck },
    retificado: { cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", label: "Retificado", Icon: AlertTriangle },
    cancelado: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Cancelado", Icon: ShieldAlert },
    assinatura_pendente: { cls: "bg-muted text-muted-foreground border-border", label: "Assinatura pendente", Icon: ShieldQuestion },
    assinatura_invalida: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Assinatura inválida", Icon: ShieldAlert },
    nao_encontrado: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Não encontrado", Icon: ShieldAlert },
  };
  const { cls, label, Icon } = map[status];
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${cls}`}>
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

export default function ValidarDocumentoPage() {
  const { codigo: codigoParam } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { user, isMaster, isCoordinator } = useAuth();
  const isInternal = !!user;
  const canSeeMore = isInternal && (isMaster || isCoordinator);

  const [codigo, setCodigo] = useState(codigoParam || "");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [status, setStatus] = useState<DocStatus | null>(null);
  const [result, setResult] = useState<DocResult | null>(null);

  const validar = async (codeRaw: string) => {
    const code = (codeRaw || "").trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setSearched(true);
    setResult(null);
    setStatus(null);
    try {
      const sb = supabase as any;

      // 1) Tenta como documento gerado
      const { data: docRows } = await sb.rpc("validate_generated_document", { _code: code });
      const doc = docRows?.[0];

      if (doc) {
        // Buscar metadados extras (unidade/setor) com tolerância a RLS
        let unidade_nome: string | null = null;
        let setor_nome: string | null = null;
        let conteudo_html: string | undefined;
        try {
          const { data: full } = await sb
            .from("generated_documents")
            .select("unidade_id,setor_id,conteudo_html")
            .eq("id", doc.id)
            .maybeSingle();
          if (full) {
            if (full.unidade_id) {
              const { data: u } = await sb.from("units").select("nome").eq("id", full.unidade_id).maybeSingle();
              unidade_nome = u?.nome ?? null;
            }
            if (full.setor_id) {
              const { data: s } = await sb.from("sectors").select("nome").eq("id", full.setor_id).maybeSingle();
              setor_nome = s?.nome ?? null;
            }
            if (canSeeMore) conteudo_html = full.conteudo_html;
          }
        } catch {/* ignora */}

        // Buscar assinatura associada (se houver)
        let sig: any = null;
        try {
          const { data: sigs } = await sb
            .from("document_signatures")
            .select("signer_name,signer_role,signed_at,status,document_version")
            .eq("document_id", doc.id)
            .order("signed_at", { ascending: false })
            .limit(1);
          sig = sigs?.[0] || null;
        } catch {/* ignora */}

        const retificado = doc.status === "retificado";
        let st: DocStatus = "valido";
        if (doc.status === "cancelado") st = "cancelado";
        else if (retificado) st = "retificado";
        else if (doc.status === "assinado" && sig?.status === "revogada") st = "assinatura_invalida";
        else if (doc.status !== "assinado") st = "assinatura_pendente";

        setStatus(st);
        setResult({
          origem: "documento",
          document_id: doc.id,
          tipo_documento: doc.tipo_documento,
          titulo: doc.titulo,
          unidade_nome,
          setor_nome,
          data_emissao: doc.created_at,
          versao: doc.versao,
          status_doc: doc.status,
          retificado,
          hash_parcial: (doc.hash || "").slice(0, 16),
          codigo_validacao: doc.codigo_validacao,
          conteudo_html,
          signer_name: sig?.signer_name,
          signer_role: sig?.signer_role,
          signed_at: sig?.signed_at,
          signature_status: sig?.status,
          document_version: sig?.document_version,
        });
        return;
      }

      // 2) Tenta como assinatura (legado / docs sem registro em generated_documents)
      const { data: sigRows } = await sb.rpc("validate_signature", { _code: code });
      const s = sigRows?.[0];
      if (s) {
        let st: DocStatus = "valido";
        if (s.status === "revogada") st = "assinatura_invalida";
        else if (s.status === "substituida") st = "retificado";
        setStatus(st);
        setResult({
          origem: "assinatura",
          tipo_documento: s.document_type,
          titulo: s.document_title,
          versao: s.document_version,
          data_emissao: s.signed_at,
          hash_parcial: (s.content_hash || "").slice(0, 16),
          codigo_validacao: s.validation_code,
          signer_name: s.signer_name,
          signer_role: s.signer_role,
          signed_at: s.signed_at,
          signature_status: s.status,
          document_version: s.document_version,
        });
        return;
      }

      setStatus("nao_encontrado");
    } catch (e) {
      console.error("Erro ao validar:", e);
      setStatus("nao_encontrado");
    } finally {
      setLoading(false);
    }
  };

  // Auto-valida quando vem com código pela URL
  useEffect(() => {
    if (codigoParam) validar(codigoParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoParam]);

  // Auditoria leve: só registra se logado
  useEffect(() => {
    if (!isInternal || !result) return;
    (async () => {
      try {
        await (supabase as any).from("audit_logs").insert({
          modulo: "validacao_documento",
          acao: "validou_documento",
          user_id: user?.id,
          status: "sucesso",
          detalhes: {
            codigo_validacao: result.codigo_validacao,
            origem: result.origem,
            resultado_status: status,
          },
        });
      } catch {/* silencioso */}
    })();
  }, [result, status, isInternal, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    navigate(isInternal ? `/validar-documento/${codigo.trim().toUpperCase()}` : `/validar-documento/${codigo.trim().toUpperCase()}`);
    validar(codigo);
  };

  const headerSubtitle = useMemo(
    () => (isInternal ? "Validação interna de documentos oficiais" : "Verificação pública de autenticidade"),
    [isInternal]
  );

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (isInternal) return <div className="container mx-auto p-6 max-w-3xl">{children}</div>;
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">{children}</div>
      </div>
    );
  };

  return (
    <Wrapper>
      <div className="bg-card border border-border rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
        {!isInternal && (
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Acessar o sistema
            </Link>
            <span className="text-xs text-muted-foreground">GestorPlantão · SMS Oriximiná</span>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">Validar documento</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{headerSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Digite o código de validação (ex.: A1B2C3D4E5F6)"
            maxLength={32}
            className="flex-1 h-11 px-3 rounded-lg border border-input bg-background text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !codigo.trim()}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60 hover:bg-primary/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Validar
          </button>
        </form>

        {loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando documento...</p>
          </div>
        )}

        {!loading && searched && status === "nao_encontrado" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-5 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-2" />
            <h2 className="font-semibold text-destructive">Documento não encontrado</h2>
            <p className="text-sm text-destructive/80 mt-1">
              O código informado não corresponde a nenhum documento emitido pelo sistema.
            </p>
          </div>
        )}

        {!loading && result && status && status !== "nao_encontrado" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-muted-foreground font-mono">{result.codigo_validacao}</span>
            </div>

            {status === "retificado" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 flex items-start gap-2">
                <History className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Este documento foi <strong>retificado</strong>. Existe uma versão mais recente que substitui esta.
                </span>
              </div>
            )}

            <dl className="text-sm space-y-2 border border-border rounded-lg p-4 bg-muted/20">
              <Row
                label="Documento"
                value={result.titulo || DOC_LABEL[result.tipo_documento || ""] || result.tipo_documento}
              />
              <Row label="Tipo" value={DOC_LABEL[result.tipo_documento || ""] || result.tipo_documento} />
              {result.unidade_nome && <Row label="Unidade" value={result.unidade_nome} />}
              {result.setor_nome && <Row label="Setor" value={result.setor_nome} />}
              {result.data_emissao && (
                <Row label="Data de emissão" value={new Date(result.data_emissao).toLocaleString("pt-BR")} />
              )}
              {typeof result.versao === "number" && <Row label="Versão" value={`v${result.versao}`} />}
              {result.signer_name && <Row label="Assinado por" value={result.signer_name} />}
              {result.signer_role && (
                <Row label="Perfil do assinante" value={ROLE_LABEL[result.signer_role] || result.signer_role} />
              )}
              {result.signed_at && (
                <Row label="Data/Hora da assinatura" value={new Date(result.signed_at).toLocaleString("pt-BR")} />
              )}
              {result.signature_status && (
                <Row
                  label="Status da assinatura"
                  value={
                    result.signature_status === "ativa" ? "Ativa" :
                    result.signature_status === "revogada" ? "Revogada" : "Substituída"
                  }
                />
              )}
              {result.hash_parcial && (
                <Row
                  label="Hash do documento"
                  value={<span className="font-mono text-[11px] break-all">{result.hash_parcial}…</span>}
                />
              )}
            </dl>

            {canSeeMore && result.conteudo_html && (
              <details className="border border-border rounded-lg p-3 bg-background">
                <summary className="cursor-pointer text-sm font-medium inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Ver conteúdo do documento (interno)
                </summary>
                <div
                  className="prose prose-sm max-w-none mt-3 p-3 border-t border-border"
                  dangerouslySetInnerHTML={{ __html: result.conteudo_html }}
                />
              </details>
            )}

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Validação eletrônica interna do GestorPlantão, com hash do conteúdo e código único.
              <strong> Não substitui assinatura digital ICP-Brasil.</strong>
              {!isInternal && " Algumas informações detalhadas só estão disponíveis para usuários autenticados."}
            </p>
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start gap-3">
      <dt className="w-40 text-xs text-muted-foreground flex-shrink-0">{label}</dt>
      <dd className="flex-1 text-foreground">{value}</dd>
    </div>
  );
}
