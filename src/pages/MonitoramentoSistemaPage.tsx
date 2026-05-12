import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, HardDrive, Server, RefreshCw, 
  Loader2, AlertTriangle, CheckCircle, Info, 
  Trash2, ShieldAlert, Activity, FileText,
  Clock, Gauge, Zap, Download
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

export default function MonitoramentoSistemaPage() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<string | null>(null);
  const [cleanupText, setCleanupText] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-monitoring-check");
      if (error) throw error;
      setStats(data);
    } catch (e: any) {
      toast.error("Erro ao coletar métricas: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const executeCleanup = async (type: string, days?: number) => {
    if (cleanupText !== "LIMPAR") {
      toast.error("Digite LIMPAR para confirmar a exclusão.");
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-cleanup-execute", {
        body: { type, payload: { days } }
      });
      if (error) throw error;
      toast.success(`Limpeza concluída! ${data.items_count} itens removidos.`);
      setConfirmCleanup(null);
      setCleanupText("");
      fetchStats();
    } catch (e: any) {
      toast.error("Falha na limpeza: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const totalRows = stats?.database?.tables?.reduce((acc: number, t: any) => acc + Number(t.row_count), 0) || 0;
  const heaviestTable = stats?.database?.tables?.sort((a: any, b: any) => {
      const valA = parseFloat(a.total_size.replace(/[^0-9.]/g, ''));
      const valB = parseFloat(b.total_size.replace(/[^0-9.]/g, ''));
      return valB - valA;
  })[0];

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Monitoramento do Sistema</h1>
          <p className="text-muted-foreground mt-1">Gestão de infraestrutura, banco de dados e saúde da aplicação.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchStats} disabled={loading} variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 shadow-sm">
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar análise
          </Button>
          <Button variant="outline" className="gap-2 border-border shadow-sm">
            <Download className="h-4 w-4" /> Relatório
          </Button>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatusCard 
          title="Status" 
          value={stats ? "Online" : "Verificando..."} 
          icon={CheckCircle} 
          color="text-success"
          desc="Saúde geral da API"
        />
        <StatusCard 
          title="Banco de Dados" 
          value={stats?.database ? "Conectado" : "Falha"} 
          icon={Database} 
          color={stats?.database ? "text-primary" : "text-destructive"}
          desc={`${totalRows.toLocaleString()} registros`}
        />
        <StatusCard 
          title="Storage" 
          value={stats?.storage ? `${stats.storage.length} Buckets` : "Nenhum"} 
          icon={HardDrive} 
          color="text-accent"
          desc="Arquivos e anexos"
        />
        <StatusCard 
          title="Hospedagem" 
          value="Lovable" 
          icon={Server} 
          color="text-muted-foreground"
          desc="Ambiente Cloud"
        />
        <StatusCard 
          title="Alertas" 
          value={stats?.recentErrors?.length || 0} 
          icon={ShieldAlert} 
          color={(stats?.recentErrors?.length || 0) > 0 ? "text-destructive" : "text-success"}
          desc="Riscos detectados"
        />
      </div>

      <Tabs defaultValue="db" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted/50">
          <TabsTrigger value="overview">Geral</TabsTrigger>
          <TabsTrigger value="db">Banco</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="perf">Desempenho</TabsTrigger>
          <TabsTrigger value="hosting">Hospedagem</TabsTrigger>
          <TabsTrigger value="cleanup">Limpeza</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="border-border/60 shadow-sm">
               <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-500" /> Alertas Automáticos</CardTitle></CardHeader>
               <CardContent className="space-y-4">
                  {!stats?.recentErrors?.length ? (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                       <CheckCircle className="h-10 w-10 text-success/40 mb-2" />
                       <p>Nenhum alerta crítico no momento.</p>
                    </div>
                  ) : (
                    stats.recentErrors.map((err: any) => (
                      <div key={err.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex gap-3">
                         <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                         <div>
                            <p className="font-semibold text-sm">{err.acao}</p>
                            <p className="text-xs text-muted-foreground">{new Date(err.created_at).toLocaleString()}</p>
                         </div>
                      </div>
                    ))
                  )}
               </CardContent>
             </Card>

             <Card className="border-border/60 shadow-sm">
               <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /> Recomendações</CardTitle></CardHeader>
               <CardContent className="space-y-4">
                  <RecommendationItem text="Muitos registros de logs detectados. Considere arquivar dados com mais de 120 dias." />
                  <RecommendationItem text="O uso do Storage está crescendo. Verifique anexos órfãos." />
                  <RecommendationItem text="A tabela de agendamentos atingiu um volume alto. Avalie estratégias de paginação." />
               </CardContent>
             </Card>
           </div>
        </TabsContent>

        <TabsContent value="db" className="mt-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tabelas e Volume de Dados</CardTitle>
                <CardDescription>Principais tabelas monitoradas do schema público.</CardDescription>
              </div>
              {heaviestTable && (
                <Badge variant="outline" className="gap-1.5 py-1 px-3 border-primary/30">
                  <Database className="h-3 w-3" /> Tabela mais pesada: {heaviestTable.table_name}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.database?.tables?.map((table: any) => (
                    <TableRow key={table.table_name}>
                      <TableCell className="font-mono text-xs">{table.table_name}</TableCell>
                      <TableCell className="text-right font-medium">{Number(table.row_count).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{table.total_size}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={Number(table.row_count) > 100000 ? "bg-warning" : "bg-success"}>
                          {Number(table.row_count) > 100000 ? "Atenção" : "Normal"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-6">
           <Card className="border-border/60 shadow-sm">
             <CardHeader>
               <CardTitle>Buckets do Supabase Storage</CardTitle>
               <CardDescription>Espaço ocupado e gestão de arquivos.</CardDescription>
             </CardHeader>
             <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats?.storage?.map((bucket: any) => (
                    <div key={bucket.id} className="p-4 rounded-xl border border-border/60 bg-muted/20">
                       <div className="flex items-center justify-between mb-2">
                         <div className="p-2 rounded-lg bg-accent/10"><HardDrive className="h-4 w-4 text-accent" /></div>
                         <Badge variant={bucket.public ? "secondary" : "outline"}>{bucket.public ? "Público" : "Privado"}</Badge>
                       </div>
                       <h4 className="font-bold">{bucket.name}</h4>
                       <p className="text-2xl font-bold mt-2">{bucket.fileCount} <span className="text-sm font-normal text-muted-foreground">arquivos</span></p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 p-6 border border-dashed rounded-2xl bg-muted/5 flex flex-col items-center text-center">
                   <ShieldAlert className="h-10 w-10 text-muted-foreground/30 mb-3" />
                   <h3 className="font-semibold">Gestão de Arquivos Órfãos</h3>
                   <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">Esta ferramenta identifica arquivos no Storage que não possuem referência no banco de dados.</p>
                   <Button variant="outline" className="gap-2">Analisar arquivos órfãos</Button>
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="mt-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CleanupAction 
                title="Limpeza de Logs" 
                desc="Remove registros informativos da auditoria com mais de 90 dias." 
                type="logs"
                count="~2.4k registros"
                onConfirm={() => setConfirmCleanup('logs')}
              />
              <CleanupAction 
                title="Notificações Antigas" 
                desc="Exclui notificações já lidas com mais de 30 dias." 
                type="notifications"
                count="~150 itens"
                onConfirm={() => setConfirmCleanup('notifications')}
              />
           </div>
        </TabsContent>
      </Tabs>

      {/* Safety Cleanup Modal */}
      <AnimatePresence>
        {confirmCleanup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card w-full max-w-md border border-border shadow-2xl rounded-2xl overflow-hidden">
               <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 text-destructive mb-2">
                     <div className="p-2 rounded-lg bg-destructive/10"><ShieldAlert className="h-6 w-6" /></div>
                     <h3 className="text-xl font-bold">Confirmação de Limpeza</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Você está prestes a realizar uma exclusão definitiva de dados ({confirmCleanup}). 
                    Essa ação <strong>não pode ser desfeita</strong>.
                  </p>
                  
                  <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                     <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Para continuar, digite LIMPAR abaixo:</p>
                     <input 
                       value={cleanupText} 
                       onChange={(e) => setCleanupText(e.target.value.toUpperCase())}
                       className="w-full bg-background border border-input p-3 rounded-lg text-center font-bold tracking-widest text-lg focus:ring-2 focus:ring-destructive/20 outline-none" 
                       placeholder="DIGITE AQUI"
                     />
                  </div>
                  
                  <div className="flex gap-3">
                     <Button variant="outline" className="flex-1" onClick={() => { setConfirmCleanup(null); setCleanupText(""); }}>Cancelar</Button>
                     <Button 
                       variant="destructive" 
                       className="flex-1 gap-2" 
                       disabled={cleanupText !== "LIMPAR" || loading}
                       onClick={() => executeCleanup(confirmCleanup)}
                     >
                       {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />} Confirmar Limpeza
                     </Button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusCard({ title, value, icon: Icon, color, desc }: any) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-muted/50 ${color}`}><Icon className="h-4 w-4" /></div>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1">{desc}</p>
      </CardContent>
    </Card>
  );
}

function RecommendationItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 items-start p-3 rounded-xl bg-primary/5 border border-primary/10">
      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <p className="text-sm text-foreground/80 leading-snug">{text}</p>
    </div>
  );
}

function CleanupAction({ title, desc, count, onConfirm }: any) {
  return (
    <Card className="border-border/60 shadow-sm hover:border-destructive/20 transition-colors group">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <Badge variant="outline" className="font-mono text-[10px]">{count}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="outline" onClick={onConfirm} className="w-full text-xs gap-2 group-hover:bg-destructive group-hover:text-destructive-foreground transition-all border-destructive/20 text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Iniciar Limpeza Segura
        </Button>
      </CardContent>
    </Card>
  );
}

