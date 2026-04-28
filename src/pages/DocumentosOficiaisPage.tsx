import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  GeneratedDocument,
  GeneratedDocumentStatus,
  GeneratedDocumentType,
  STATUS_LABELS,
  TIPO_LABELS,
  listarDocumentos,
} from "@/lib/documentVersioning";
import { DocumentVersionHistoryDialog } from "@/components/documents/DocumentVersionHistoryDialog";
import { FileText, History, Search, Filter } from "lucide-react";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  gerado: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  assinado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  publicado: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  retificado: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cancelado: "bg-red-500/15 text-red-700 dark:text-red-300",
  arquivado: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export default function DocumentosOficiaisPage() {
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [openHistorico, setOpenHistorico] = useState(false);
  const [docSelecionadoId, setDocSelecionadoId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const list = await listarDocumentos({
        tipo: filtroTipo !== "all" ? (filtroTipo as GeneratedDocumentType) : undefined,
        status: filtroStatus !== "all" ? (filtroStatus as GeneratedDocumentStatus) : undefined,
        limit: 200,
      });
      setDocs(list);
    } catch (e: any) {
      toast.error("Erro ao carregar documentos", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, filtroStatus]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return docs;
    const q = busca.toLowerCase();
    return docs.filter(
      (d) =>
        d.titulo.toLowerCase().includes(q) ||
        d.codigo_validacao.toLowerCase().includes(q) ||
        (d.modelo_nome ?? "").toLowerCase().includes(q)
    );
  }, [docs, busca]);

  const abrirHistorico = (id: string) => {
    setDocSelecionadoId(id);
    setOpenHistorico(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Documentos Oficiais
        </h1>
        <p className="text-muted-foreground text-sm">
          Controle de versões, histórico, hash e rastreabilidade de todos os documentos gerados, assinados ou retificados.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, código ou modelo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "Carregando documentos…" : `${filtrados.length} documento(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {filtrados.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium max-w-[280px] truncate" title={d.titulo}>
                      {d.titulo}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TIPO_LABELS[d.tipo_documento]}</Badge>
                    </TableCell>
                    <TableCell>v{d.versao}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[d.status]}>{STATUS_LABELS[d.status]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.codigo_validacao}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirHistorico(d.id)}>
                        <History className="h-4 w-4 mr-1" />
                        Histórico
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DocumentVersionHistoryDialog
        open={openHistorico}
        onOpenChange={setOpenHistorico}
        documentoId={docSelecionadoId}
        onRetificado={() => carregar()}
      />
    </div>
  );
}
