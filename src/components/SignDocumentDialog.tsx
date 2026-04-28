import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, Loader2, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  signDocument, listSignatures, renderSignatureBlock,
  type SignableDocument, type SignatureRecord, type SignatureRole,
} from "@/lib/eSignature";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: SignableDocument;
  /** Callback após assinar com sucesso (recebe assinatura e bloco HTML pronto). */
  onSigned?: (sig: SignatureRecord, htmlBlock: string) => void;
}

const ROLE_LABEL: Record<SignatureRole, string> = {
  profissional: 'Profissional',
  coordenador: 'Coordenador',
  gestor_master: 'Gestor Master',
  institucional: 'Institucional',
};

export default function SignDocumentDialog({ open, onOpenChange, document, onSigned }: Props) {
  const { user, isMaster, isCoordinator } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previous, setPrevious] = useState<SignatureRecord[]>([]);
  const [role, setRole] = useState<SignatureRole>('profissional');

  useEffect(() => {
    if (!open) { setPassword(""); setConfirm(false); return; }
    setRole(isMaster ? 'gestor_master' : isCoordinator ? 'coordenador' : 'profissional');
    listSignatures(document.document_type, document.document_id).then(setPrevious).catch(() => setPrevious([]));
  }, [open, document.document_type, document.document_id, isMaster, isCoordinator]);

  const activePrev = previous.find(s => s.status === 'ativa');
  const nextVersion = (previous[previous.length - 1]?.document_version || 0) + 1;

  const handleSign = async () => {
    if (!user) { toast.error("Sessão expirada."); return; }
    if (!password) { toast.error("Informe sua senha."); return; }
    if (!confirm) { toast.error("Confirme a declaração."); return; }
    setLoading(true);
    try {
      const sig = await signDocument(
        { ...document, document_version: nextVersion },
        { password, role, previousSignatureId: activePrev?.id ?? null },
      );
      const html = renderSignatureBlock(sig);
      toast.success("Documento assinado eletronicamente.");
      onSigned?.(sig, html);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao assinar.");
    } finally {
      setLoading(false);
    }
  };

  const labelCls = "text-xs font-medium text-muted-foreground";
  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Assinar documento eletronicamente
          </DialogTitle>
          <DialogDescription>
            Esta é uma assinatura eletrônica interna do GestorPlantão (rastreável, com hash e código de validação).
            <strong className="block mt-1">Não substitui assinatura digital ICP-Brasil.</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
            <div><strong>Documento:</strong> {document.document_title || document.document_type}</div>
            <div><strong>ID:</strong> {document.document_id}</div>
            <div><strong>Versão a gerar:</strong> {nextVersion}</div>
            {activePrev && (
              <div className="text-amber-600 flex items-start gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>Existe uma assinatura ativa anterior (v{activePrev.document_version} por {activePrev.signer_name}). A nova substituirá como versão atual.</span>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Assinar como</label>
            <select value={role} onChange={e => setRole(e.target.value as SignatureRole)} className={inputCls}>
              <option value="profissional">{ROLE_LABEL.profissional}</option>
              {isCoordinator && <option value="coordenador">{ROLE_LABEL.coordenador}</option>}
              {isMaster && <option value="coordenador">{ROLE_LABEL.coordenador}</option>}
              {isMaster && <option value="gestor_master">{ROLE_LABEL.gestor_master}</option>}
              {isMaster && <option value="institucional">{ROLE_LABEL.institucional}</option>}
            </select>
          </div>

          <div>
            <label className={labelCls}>Confirme sua senha</label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" className={`${inputCls} pl-9`}
                onKeyDown={e => e.key === 'Enter' && confirm && handleSign()} />
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-foreground">
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5" />
            <span>
              Declaro estar ciente de que esta assinatura eletrônica interna gera registro auditável,
              com hash SHA-256 do conteúdo, código de validação único e QR Code, e que <strong>não substitui assinatura digital ICP-Brasil</strong>.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => onOpenChange(false)} disabled={loading}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
          <button onClick={handleSign} disabled={loading || !password || !confirm}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Assinar agora
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
