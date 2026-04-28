import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  GeneratedDocument,
  STATUS_LABELS,
  TIPO_LABELS,
  criarRetificacao,
  listarHistorico,
  alterarStatus,
} from "@/lib/documentVersioning";
import { History, FileSignature, Archive, Ban, ShieldCheck, Clock, Hash } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoId: string | null;
  /** chamado após retificação bem-sucedida com a nova versão */
  onRetificado?: (novo: GeneratedDocument) => void;
}

const statusColor: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  gerado: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  assinado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  publicado: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  retificado: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelado: "bg-red-500/15 text-red-700 dark:text-red-300",
  arquivado: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export function DocumentVersionHistoryDialog({ open, onOpenChange, documentoId, onRetificado }: Props) {
  const [historico, setHistorico] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [retificando, setRetificando] = useState<GeneratedDocument | null>(null);
  const [novoConteudo, setNovoConteudo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    if (!documentoId) return;
    setLoading(true);
    try {
      const list = await listarHistorico(documentoId);
      setHistorico(list);
    } catch (e: any) {
      toast.error("Erro ao carregar histórico", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && documentoId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentoId]);

  const handleAbrirRetificacao = (doc: GeneratedDocument) => {
    setRetificando(doc);
    setNovoConteudo(doc.conteudo_html);
    setMotivo("");
  };

  const handleConfirmarRetificacao = async () => {
    if (!retificando) return;
    if (motivo.trim().length < 10) {
      toast.error("Informe o motivo da retificação (mínimo 10 caracteres)");
      return;
    }
    setSalvando(true);
    try {
      const nova = await criarRetificacao({
        documentoAnteriorId: retificando.id,
        novoConteudoHtml: novoConteudo,
        motivo: motivo.trim(),
      });
      toast.success(`Retificação criada — versão ${nova.versao}`);
      setRetificando(null);
      onRetificado?.(nova);
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao retificar", { description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const handleArquivar = async (doc: GeneratedDocument) => {
    try {
      await alterarStatus(doc.id, "arquivado");
      toast.success("Documento arquivado");
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao arquivar", { description: e.message });
    }
  };

  const handleCancelar = async (doc: GeneratedDocument) => {
    try {
      await alterarStatus(doc.id, "cancelado");
      toast.success("Documento cancelado");
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao cancelar", { description: e.message });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Versões
            </DialogTitle>
            <DialogDescription>
              Cadeia completa de versões e retificações do documento, com hash e código de validação.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando…</div>
          ) : historico.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhuma versão encontrada.</div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <ol className="relative border-l border-border ml-3 space-y-4 py-2">
                {historico.map((doc) => {
                  const isAssinado = doc.status === "assinado";
                  const isRetificado = doc.status === "retificado";
                  const isCancelado = doc.status === "cancelado" || doc.status === "arquivado";
                  return (
                    <li key={doc.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border border-background" />
                      <div className="rounded-lg border bg-card p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">Versão {doc.versao}</span>
                              <Badge className={statusColor[doc.status]}>
                                {STATUS_LABELS[doc.status]}
                              </Badge>
                              <Badge variant="outline">{TIPO_LABELS[doc.tipo_documento]}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{doc.titulo}</div>
                          </div>
                          <div className="flex gap-2">
                            {isAssinado && (
                              <Button size="sm" variant="outline" onClick={() => handleAbrirRetificacao(doc)}>
                                <FileSignature className="h-4 w-4 mr-1" />
                                Criar retificação
                              </Button>
                            )}
                            {!isAssinado && !isRetificado && !isCancelado && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleArquivar(doc)}>
                                  <Archive className="h-4 w-4 mr-1" /> Arquivar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleCancelar(doc)}>
                                  <Ban className="h-4 w-4 mr-1" /> Cancelar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Criado em {new Date(doc.created_at).toLocaleString("pt-BR")}
                          </div>
                          <div className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            Código: <span className="font-mono">{doc.codigo_validacao}</span>
                          </div>
                          {doc.assinado_em && (
                            <div className="flex items-center gap-1 col-span-2">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              Assinado em {new Date(doc.assinado_em).toLocaleString("pt-BR")}
                            </div>
                          )}
                          <div className="col-span-2 truncate">
                            <span className="font-mono text-[10px]">hash: {doc.hash.slice(0, 32)}…</span>
                          </div>
                          {doc.motivo_retificacao && (
                            <div className="col-span-2 mt-1 p-2 rounded bg-amber-500/10 text-amber-800 dark:text-amber-200">
                              <strong>Motivo da retificação:</strong> {doc.motivo_retificacao}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de retificação */}
      <Dialog open={!!retificando} onOpenChange={(o) => !o && setRetificando(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Criar retificação</DialogTitle>
            <DialogDescription>
              Esta ação gera uma nova versão (v{(retificando?.versao ?? 0) + 1}) preservando a versão assinada anterior.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="motivo">Motivo da retificação *</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Correção de horário do plantão por erro de digitação."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="conteudo">Conteúdo retificado (HTML)</Label>
              <Textarea
                id="conteudo"
                value={novoConteudo}
                onChange={(e) => setNovoConteudo(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRetificando(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarRetificacao} disabled={salvando}>
              {salvando ? "Salvando…" : "Criar nova versão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
