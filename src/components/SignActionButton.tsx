import { useEffect, useState } from "react";
import { ShieldCheck, FileCheck2, Eye, ExternalLink, Loader2, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SignDocumentDialog from "@/components/SignDocumentDialog";
import { listSignatures, type SignatureRecord, type SignableDocument } from "@/lib/eSignature";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/auditLog";

const ROLE_LABEL: Record<string, string> = {
  profissional: "Profissional",
  coordenador: "Coordenador",
  gestor_master: "Gestor Master",
  institucional: "Institucional",
};

interface Props {
  /** Documento alvo. Se `getDocument` for fornecido, ele é usado quando o usuário clica em "Assinar" (lazy). */
  document?: SignableDocument;
  getDocument?: () => Promise<SignableDocument> | SignableDocument;
  /** Permissões de quem pode assinar este documento (RBAC visual). */
  canSign?: boolean;
  /** Texto compacto para botões. */
  compact?: boolean;
  /** Variante visual do botão principal. */
  variant?: "primary" | "outline" | "ghost";
  /** Label customizado do botão de assinar. */
  signLabel?: string;
  /** Callback após assinar com sucesso. */
  onSigned?: (sig: SignatureRecord) => void;
  className?: string;
}

/**
 * Botão reutilizável: "Assinar" + menu "Ver assinaturas / Validar".
 * Usa `SignDocumentDialog` internamente (assinatura eletrônica interna,
 * não substitui ICP-Brasil).
 */
export default function SignActionButton({
  document, getDocument, canSign = true, compact = false,
  variant = "outline", signLabel, onSigned, className,
}: Props) {
  const { user } = useAuth();
  const [signOpen, setSignOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [resolved, setResolved] = useState<SignableDocument | null>(document || null);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [loadingSigs, setLoadingSigs] = useState(false);

  // Mantém doc passado por prop sincronizado
  useEffect(() => { if (document) setResolved(document); }, [document]);

  const loadDocLazy = async (): Promise<SignableDocument | null> => {
    if (resolved) return resolved;
    if (!getDocument) return null;
    setLoadingDoc(true);
    try {
      const d = await getDocument();
      setResolved(d);
      return d;
    } finally {
      setLoadingDoc(false);
    }
  };

  const loadSigs = async () => {
    const d = await loadDocLazy();
    if (!d) return;
    setLoadingSigs(true);
    try {
      const list = await listSignatures(d.document_type, d.document_id);
      setSignatures(list);
    } catch {
      setSignatures([]);
    } finally {
      setLoadingSigs(false);
    }
  };

  const handleSignClick = async () => {
    const d = await loadDocLazy();
    if (!d) return;
    setSignOpen(true);
  };

  const baseBtn = "inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50";
  const sizeCls = compact ? "px-2.5 py-1.5" : "px-3 py-2";
  const variantCls =
    variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90"
    : variant === "ghost"  ? "text-foreground hover:bg-muted"
    : "border border-border text-foreground hover:bg-muted";

  return (
    <div className={`inline-flex items-center gap-1 ${className || ""}`}>
      {canSign && user && (
        <button
          type="button"
          onClick={handleSignClick}
          disabled={loadingDoc}
          className={`${baseBtn} ${sizeCls} ${variantCls}`}
          title="Assinar documento eletronicamente (assinatura interna, não ICP-Brasil)"
        >
          {loadingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {signLabel ?? "Assinar"}
        </button>
      )}

      <DropdownMenu onOpenChange={(o) => { if (o) loadSigs(); }}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`${baseBtn} ${sizeCls} border border-border text-foreground hover:bg-muted`}
            title="Ver assinaturas"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            {!compact && "Assinaturas"}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setListOpen(true); }}>
            <Eye className="h-4 w-4 mr-2" /> Ver assinaturas {signatures.length > 0 && <span className="ml-auto text-[10px] text-muted-foreground">{signatures.length}</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Validar</div>
          {loadingSigs ? (
            <div className="px-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Carregando…</div>
          ) : signatures.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">Nenhuma assinatura ainda.</div>
          ) : signatures.slice(0, 4).map(s => (
            <DropdownMenuItem key={s.id} asChild>
              <a href={`/validar/${s.validation_code}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="font-mono text-[11px]">{s.validation_code}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{s.signer_name}</span>
                </span>
                <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Lista detalhada de assinaturas */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" /> Assinaturas do documento
            </DialogTitle>
            <DialogDescription>
              Assinaturas eletrônicas internas registradas. Cada uma possui hash, código e QR Code de validação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {signatures.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma assinatura registrada para este documento.</p>
            ) : signatures.map(s => (
              <div key={s.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">{s.signer_name}</div>
                    <div className="text-muted-foreground">{ROLE_LABEL[s.signer_role] || s.signer_role} · v{s.document_version}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    s.status === "ativa" ? "bg-success/10 text-success" :
                    s.status === "revogada" ? "bg-destructive/10 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>{s.status}</span>
                </div>
                <div className="text-muted-foreground">{new Date(s.signed_at).toLocaleString("pt-BR")}</div>
                <div className="font-mono text-[10px] break-all text-muted-foreground">Hash: {s.content_hash.slice(0, 32)}…</div>
                <div className="flex items-center justify-between pt-1">
                  <code className="text-[11px] font-mono text-foreground">{s.validation_code}</code>
                  <a href={`/validar/${s.validation_code}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline">
                    Validar <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {resolved && (
        <SignDocumentDialog
          open={signOpen}
          onOpenChange={setSignOpen}
          document={resolved}
          onSigned={(sig) => {
            logAudit("Assinatura aplicada", "assinatura_eletronica", {
              document_type: resolved.document_type,
              document_id: resolved.document_id,
              role: sig.signer_role,
              code: sig.validation_code,
            });
            loadSigs();
            onSigned?.(sig);
          }}
        />
      )}
    </div>
  );
}
