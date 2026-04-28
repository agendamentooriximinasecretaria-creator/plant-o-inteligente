import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, Loader2, ArrowLeft } from "lucide-react";

interface ValidationResult {
  document_type: string;
  document_title: string | null;
  document_version: number;
  signer_name: string;
  signer_role: string;
  signed_at: string;
  status: string;
  content_hash: string;
  validation_code: string;
}

const ROLE_LABEL: Record<string, string> = {
  profissional: 'Profissional de saúde',
  coordenador: 'Coordenador',
  gestor_master: 'Gestor Master',
  institucional: 'Institucional',
};

const DOC_LABEL: Record<string, string> = {
  comprovante_plantao: 'Comprovante de plantão',
  troca: 'Troca de plantão',
  escala_mensal_oficial: 'Escala mensal oficial',
  escala_semanal: 'Escala semanal',
  relatorio: 'Relatório oficial',
  modelo_personalizado: 'Documento personalizado',
};

export default function ValidarAssinaturaPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    setLoading(true);
    (supabase as any).rpc('validate_signature', { _code: codigo })
      .then(({ data, error }: any) => {
        if (error || !data?.length) { setNotFound(true); }
        else setResult(data[0]);
      })
      .finally(() => setLoading(false));
  }, [codigo]);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-lg p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao sistema
          </Link>
          <span className="text-xs text-muted-foreground">GestorPlantão · SMS Oriximiná</span>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Validação de Assinatura Eletrônica</h1>
          <p className="text-sm text-muted-foreground mt-1">Código: <strong className="font-mono">{codigo}</strong></p>
        </div>

        {loading && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando assinatura...</p>
          </div>
        )}

        {!loading && notFound && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-5 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-2" />
            <h2 className="font-semibold text-destructive">Assinatura não encontrada</h2>
            <p className="text-sm text-destructive/80 mt-1">
              O código informado não corresponde a nenhuma assinatura registrada no sistema.
            </p>
          </div>
        )}

        {!loading && result && (
          <div className="space-y-4">
            <div className={`rounded-lg p-5 text-center ${
              result.status === 'ativa' ? 'border border-green-500/30 bg-green-500/10' :
              result.status === 'revogada' ? 'border border-destructive/30 bg-destructive/10' :
              'border border-amber-500/30 bg-amber-500/10'
            }`}>
              {result.status === 'ativa' ? (
                <ShieldCheck className="h-10 w-10 text-green-600 mx-auto mb-2" />
              ) : (
                <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-2" />
              )}
              <h2 className="font-semibold">
                {result.status === 'ativa' ? 'Assinatura válida' :
                 result.status === 'revogada' ? 'Assinatura revogada' : 'Assinatura substituída'}
              </h2>
            </div>

            <dl className="text-sm space-y-2 border border-border rounded-lg p-4 bg-muted/20">
              <Row label="Documento" value={result.document_title || DOC_LABEL[result.document_type] || result.document_type} />
              <Row label="Tipo" value={DOC_LABEL[result.document_type] || result.document_type} />
              <Row label="Versão" value={`v${result.document_version}`} />
              <Row label="Assinante" value={result.signer_name} />
              <Row label="Perfil" value={ROLE_LABEL[result.signer_role] || result.signer_role} />
              <Row label="Data/Hora" value={new Date(result.signed_at).toLocaleString('pt-BR')} />
              <Row label="Hash SHA-256" value={<span className="font-mono text-[11px] break-all">{result.content_hash}</span>} />
            </dl>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Esta é uma <strong>assinatura eletrônica interna</strong> do GestorPlantão, com rastreabilidade,
              hash do conteúdo e código único de validação. <strong>Não substitui assinatura digital ICP-Brasil.</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-32 text-xs text-muted-foreground flex-shrink-0">{label}</dt>
      <dd className="flex-1 text-foreground">{value}</dd>
    </div>
  );
}
