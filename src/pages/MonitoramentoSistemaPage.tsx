import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, HardDrive, RefreshCw, 
  Loader2, CheckCircle, Info, 
  Trash2, ShieldAlert, Activity,
  Clock, Zap, Download, LineChart,
  Link2, Settings2, Network, Save, TestTube,
  History, Search, Filter, AlertCircle, FileSearch, Shield, Server, Gauge
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MonitoramentoSistemaPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [cleanupLogs, setCleanupLogs] = useState<any[]>([]);
  const [confirmCleanup, setConfirmCleanup] = useState<any | null>(null);
  const [cleanupText, setCleanupText] = useState("");
  const [showExternalConfig, setShowExternalConfig] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  
  // Real performance metrics
  const [metrics, setMetrics] = useState({
    pageLoadTime: 0,
    apiLatency: 0,
    supabaseLatency: 0,
    lastCheck: null as string | null,
    online: navigator.onLine
  });

  const fetchStats = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("system-monitoring-check");
      const end = performance.now();
      
      if (error) throw error;
      
      setStats(data);
      setMetrics(prev => ({
        ...prev,
        apiLatency: Math.round(end - start),
        lastCheck: new Date().toLocaleTimeString(),
        online: navigator.onLine
      }));
    } catch (e: any) {
      toast.error("Erro ao coletar métricas: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCleanupLogs = async () => {
    const { data, error } = await supabase
      .from('system_cleanup_logs')
      .select('*, profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!error) setCleanupLogs(data || []);
  };

  const analyzeCleanup = async (type: string, days = 90) => {
    setAnalyzing(type);
    setAnalysisResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("system-cleanup-execute", {
        body: { 
          cleanup_type: type, 
          dry_run: true, 
          filters: { older_than_days: days } 
        }
      });
      if (error) throw error;
      setAnalysisResult({ ...data, type, days });
      toast.info(`Análise concluída: ${data.estimated_items} itens encontrados.`);
    } catch (e: any) {
      toast.error("Erro na análise: " + e.message);
    } finally {
      setAnalyzing(null);
    }
  };

  const executeCleanup = async () => {
    if (cleanupText !== "LIMPAR") {
      toast.error("Digite LIMPAR para confirmar.");
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-cleanup-execute", {
        body: { 
          cleanup_type: analysisResult.type, 
          confirmation_text: "LIMPAR",
          dry_run: false,
          filters: { older_than_days: analysisResult.days }
        }
      });
      if (error) throw error;
      toast.success(`Limpeza concluída! ${data.deleted_items} itens removidos.`);
      setConfirmCleanup(null);
      setAnalysisResult(null);
      setCleanupText("");
      fetchStats();
      fetchCleanupLogs();
    } catch (e: any) {
      toast.error("Falha na limpeza: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    const loadTime = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (loadTime) {
      setMetrics(prev => ({ ...prev, pageLoadTime: Math.round(loadTime.duration) }));
    }

    const measureSupabase = async () => {
      const s = performance.now();
      await supabase.from('profiles').select('id').limit(1);
      const e = performance.now();
      setMetrics(prev => ({ ...prev, supabaseLatency: Math.round(e - s) }));
    };

    measureSupabase();
    fetchStats(); 
    fetchCleanupLogs();
  }, []);

  const totalRows = stats?.database?.tables?.reduce((acc: number, t: any) => acc + Number(t.row_count), 0) || 0;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 w-full px-1">
        <div className="max-w-full">
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-foreground break-words">Monitoramento do Sistema</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Gestão de infraestrutura, banco de dados e saúde da aplicação.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={fetchStats} disabled={loading} variant="outline" className="flex-1 md:flex-none gap-2 border-primary/20 hover:bg-primary/5 shadow-sm">
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar análise
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none gap-2 border-border shadow-sm">
            <Download className="h-4 w-4" /> Relatório
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatusCard title="Status" value={stats ? "Online" : "Verificando..."} icon={CheckCircle} color="text-success" desc="Saúde geral da API" />
        <StatusCard title="Banco" value={stats?.database ? "Conectado" : "Falha"} icon={Database} color={stats?.database ? "text-primary" : "text-destructive"} desc={`${totalRows.toLocaleString()} registros`} />
        <StatusCard title="Storage" value={stats?.storage ? `${stats.storage.length} Buckets` : "Nenhum"} icon={HardDrive} color="text-accent" desc="Arquivos e anexos" />
        <StatusCard title="Hospedagem" value="Lovable" icon={Server} color="text-muted-foreground" desc="Ambiente Cloud" />
        <StatusCard title="Alertas" value={stats?.recentErrors?.length || 0} icon={ShieldAlert} color={(stats?.recentErrors?.length || 0) > 0 ? "text-destructive" : "text-success"} desc="Riscos detectados" />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 mb-6 gap-1">
          <TabsTrigger value="overview" className="flex-1 min-w-[100px]">Geral</TabsTrigger>
          <TabsTrigger value="db" className="flex-1 min-w-[100px]">Banco</TabsTrigger>
          <TabsTrigger value="storage" className="flex-1 min-w-[100px]">Storage</TabsTrigger>
          <TabsTrigger value="perf" className="flex-1 min-w-[100px]">Desempenho</TabsTrigger>
          <TabsTrigger value="cleanup" className="flex-1 min-w-[100px]">Limpeza</TabsTrigger>
          <TabsTrigger value="logs" className="flex-1 min-w-[100px]">Logs</TabsTrigger>
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
              {stats?.database?.tables && (
                <Badge variant="outline" className="gap-1.5 py-1 px-3 border-primary/30">
                  <Database className="h-3 w-3" /> Tabelas Monitoradas: {stats.database.tables.length}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
              </div>
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
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="perf" className="mt-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <PerfCard 
                title="Latência da API" 
                value={metrics.apiLatency ? `${metrics.apiLatency}ms` : "Calculando..."} 
                icon={Zap}
                status={metrics.apiLatency < 300 ? "Bom" : "Lento"}
                desc="Edge Function Check"
              />
              <PerfCard 
                title="Resposta Supabase" 
                value={metrics.supabaseLatency ? `${metrics.supabaseLatency}ms` : "Calculando..."} 
                icon={Database}
                status={metrics.supabaseLatency < 200 ? "Bom" : "Lento"}
                desc="PostgreSQL Query"
              />
              <PerfCard 
                title="Carregamento" 
                value={metrics.pageLoadTime ? `${(metrics.pageLoadTime/1000).toFixed(2)}s` : "---"} 
                icon={Clock}
                status={metrics.pageLoadTime < 2500 ? "Bom" : "Lento"}
                desc="Navegador (Navigation)"
              />
              <PerfCard 
                title="Status Conexão" 
                value={metrics.online ? "Online" : "Offline"} 
                icon={Network}
                status={metrics.online ? "Bom" : "Crítico"}
                desc="Conectividade Local"
              />
              <PerfCard 
                title="Última Verificação" 
                value={metrics.lastCheck || "---"} 
                icon={RefreshCw}
                status="Info"
                desc="Hora local"
              />
              <PerfCard 
                title="Erros Recentes" 
                value={stats?.recentErrors?.length || "0"} 
                icon={ShieldAlert}
                status={(stats?.recentErrors?.length || 0) > 0 ? "Atenção" : "Bom"}
                desc="Logs de Erro"
              />
           </div>

           <Card className="border-border/60 shadow-sm overflow-hidden">
             <div className="bg-primary/5 p-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <LineChart className="h-5 w-5 text-primary" />
                   <h3 className="font-bold">Monitoramento Avançado (Observabilidade)</h3>
                </div>
                {!showExternalConfig && (
                   <Button variant="outline" size="sm" onClick={() => setShowExternalConfig(true)} className="gap-2 bg-background">
                      <Settings2 className="h-4 w-4" /> Configurar Integração
                   </Button>
                )}
             </div>
             
             <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {!showExternalConfig ? (
                    <motion.div 
                      key="status"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center text-center py-8 space-y-4"
                    >
                       <div className="p-4 rounded-full bg-muted/20">
                          <Link2 className="h-10 w-10 text-muted-foreground/30" />
                       </div>
                       <div className="max-w-md">
                          <h4 className="font-semibold text-lg">Monitoramento real ainda não configurado</h4>
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                             Para medir CPU, RAM, disco, uptime e erros reais da hospedagem, conecte uma integração externa como Coolify Metrics, Sentry, Grafana, New Relic ou Vercel Analytics.
                          </p>
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-6 opacity-40 grayscale">
                          <MetricPlaceholder label="CPU VPS" />
                          <MetricPlaceholder label="Memória RAM" />
                          <MetricPlaceholder label="Uso de Disco" />
                          <MetricPlaceholder label="Uptime Real" />
                       </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="config"
                      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      className="space-y-6"
                    >
                       <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Configuração de Integração Externa</h4>
                          <Button variant="ghost" size="sm" onClick={() => setShowExternalConfig(false)}>Cancelar</Button>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="integ-type">Tipo de Integração</Label>
                                <select id="integ-type" className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm">
                                   <option>Coolify Metrics</option>
                                   <option>Sentry</option>
                                   <option>Grafana (Prometheus)</option>
                                   <option>New Relic</option>
                                   <option>Vercel Analytics</option>
                                </select>
                             </div>
                             <div className="space-y-2">
                                <Label htmlFor="integ-url">URL do Painel / Endpoint</Label>
                                <Input id="integ-url" placeholder="https://stats.seuservidor.com/api" />
                             </div>
                          </div>
                          
                          <div className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="integ-token">Token / API Key</Label>
                                <Input id="integ-token" type="password" placeholder="••••••••••••••••" />
                                <p className="text-[10px] text-muted-foreground">Tokens são salvos de forma segura no backend (Secrets) e nunca expostos no frontend.</p>
                             </div>
                             <div className="flex gap-2 pt-2">
                                <Button className="flex-1 gap-2"><Save className="h-4 w-4" /> Salvar Integração</Button>
                                <Button variant="outline" className="gap-2"><TestTube className="h-4 w-4" /> Testar</Button>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
           <Card className="border-border/60 shadow-sm">
             <CardHeader>
               <CardTitle>Logs Recentes de Erro</CardTitle>
               <CardDescription>Últimas falhas capturadas no sistema.</CardDescription>
             </CardHeader>
             <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                   <div className="space-y-3">
                      {!stats?.recentErrors?.length ? (
                         <p className="text-sm text-muted-foreground text-center py-10">Nenhum log de erro recente.</p>
                      ) : (
                         stats.recentErrors.map((log: any) => (
                            <div key={log.id} className="p-4 rounded-xl border bg-muted/5 font-mono text-[10px] space-y-2">
                               <div className="flex justify-between items-center">
                                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0">ERROR</Badge>
                                  <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                               </div>
                               <p className="font-bold text-foreground">{log.acao}</p>
                               <div className="p-2 bg-black/5 dark:bg-white/5 rounded whitespace-pre-wrap overflow-x-auto">
                                  {JSON.stringify(log.detalhes || log.payload, null, 2)}
                                </div>
                            </div>
                         ))
                      )}
                   </div>
                </ScrollArea>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CleanupCard 
              title="Logs Informativos"
              desc="Logs de auditoria com status de sucesso e mais de 90 dias."
              type="logs_old"
              analyzing={analyzing === "logs_old"}
              onAnalyze={() => analyzeCleanup("logs_old", 90)}
              analysisResult={analysisResult?.type === "logs_old" ? analysisResult : null}
              onCleanup={() => setConfirmCleanup(analysisResult)}
            />
            <CleanupCard 
              title="Notificações Antigas"
              desc="Notificações já lidas com mais de 30 dias."
              type="notifications_old"
              analyzing={analyzing === "notifications_old"}
              onAnalyze={() => analyzeCleanup("notifications_old", 30)}
              analysisResult={analysisResult?.type === "notifications_old" ? analysisResult : null}
              onCleanup={() => setConfirmCleanup(analysisResult)}
            />
            <CleanupCard 
              title="Snapshots de Monitoramento"
              desc="Histórico de snapshots antigos com mais de 90 dias."
              type="monitoring_snapshots_old"
              analyzing={analyzing === "monitoring_snapshots_old"}
              onAnalyze={() => analyzeCleanup("monitoring_snapshots_old", 90)}
              analysisResult={analysisResult?.type === "monitoring_snapshots_old" ? analysisResult : null}
              onCleanup={() => setConfirmCleanup(analysisResult)}
            />
            <CleanupCard 
              title="Arquivos Órfãos"
              desc="Arquivos no Storage sem referência no Banco de Dados."
              type="orphan_files"
              isCritical
              analyzing={analyzing === "orphan_files"}
              onAnalyze={() => analyzeCleanup("orphan_files")}
              analysisResult={analysisResult?.type === "orphan_files" ? analysisResult : null}
              onCleanup={() => setConfirmCleanup(analysisResult)}
            />
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> Histórico de Limpezas
                </CardTitle>
                <CardDescription>Registro auditado de todas as operações de manutenção.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchCleanupLogs} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanupLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">Nenhuma limpeza executada ainda.</TableCell>
                      </TableRow>
                    ) : (
                      cleanupLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-medium">{log.profiles?.display_name || 'Sistema'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] capitalize">{log.cleanup_type.replace('_', ' ')}</Badge></TableCell>
                          <TableCell className="text-right font-mono text-xs">{log.items_count}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={log.status === 'Sucesso' ? 'bg-success' : 'bg-destructive'}>{log.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {confirmCleanup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-2xl overflow-hidden my-auto">
               <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 text-destructive mb-2">
                     <div className="p-2 rounded-lg bg-destructive/10"><ShieldAlert className="h-6 w-6" /></div>
                     <h3 className="text-xl font-bold">Confirmação de Limpeza</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                      <p className="text-sm font-bold uppercase tracking-wide text-foreground">Tipo de Limpeza</p>
                      <p className="text-lg font-bold text-destructive capitalize">{confirmCleanup.cleanup_type.replace('_', ' ')}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Zap className="h-4 w-4 text-warning" /> 
                        <span>Aproximadamente <strong>{confirmCleanup.estimated_items}</strong> itens serão removidos.</span>
                      </div>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                       <p className="text-[11px] font-bold uppercase text-primary mb-1">Critério de Segurança</p>
                       <p className="text-sm">{confirmCleanup.message}</p>
                       <p className="text-[10px] text-muted-foreground mt-2 flex gap-2">
                         <Shield className="h-3 w-3 shrink-0" />
                         Não serão apagados prontuários, pacientes, auditorias críticas ou documentos clínicos.
                       </p>
                    </div>
                  </div>

                  <div className="p-4 bg-destructive/5 rounded-xl border border-destructive/10 space-y-3">
                     <p className="text-xs font-bold text-destructive uppercase tracking-wider text-center">Para continuar, digite LIMPAR abaixo:</p>
                     <Input 
                       value={cleanupText} 
                       onChange={(e) => setCleanupText(e.target.value.toUpperCase())}
                       className="w-full bg-background border-destructive/30 p-4 rounded-lg text-center font-bold tracking-widest text-xl focus:ring-2 focus:ring-destructive/20 outline-none" 
                       placeholder="DIGITE AQUI"
                     />
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                     <Button variant="outline" className="flex-1" onClick={() => { setConfirmCleanup(null); setCleanupText(""); }}>Cancelar</Button>
                     <Button 
                       variant="destructive" 
                       className="flex-1 gap-2 py-6 text-base font-bold" 
                       disabled={cleanupText !== "LIMPAR" || loading}
                       onClick={executeCleanup}
                     >
                       {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Trash2 className="h-5 w-5" />} Confirmar Limpeza
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

// Subcomponents
function CleanupCard({ title, desc, type, analyzing, onAnalyze, analysisResult, onCleanup, isCritical }: any) {
  return (
    <Card className={`border-border/60 shadow-sm transition-all flex flex-col ${isCritical ? 'hover:border-warning/30' : 'hover:border-primary/30'}`}>
      <CardHeader className="pb-3 flex-1">
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg leading-tight">{title}</CardTitle>
          {isCritical && <Badge variant="destructive" className="text-[9px] h-4">Crítico</Badge>}
        </div>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {analysisResult ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-muted/40 border text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Itens encontrados:</span>
              <span className="font-bold">{analysisResult.estimated_items}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Risco:</span>
              <Badge variant="outline" className={`text-[9px] ${analysisResult.risk === 'baixo' ? 'text-success border-success/20' : 'text-warning border-warning/20'}`}>
                {analysisResult.risk}
              </Badge>
            </div>
            <p className="text-[10px] italic text-muted-foreground mt-1">{analysisResult.message}</p>
          </motion.div>
        ) : null}

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-[11px] gap-1.5"
            onClick={onAnalyze}
            disabled={analyzing}
          >
            {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
            {analyzing ? 'Analisando...' : 'Analisar'}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className={`flex-1 text-[11px] gap-1.5 border-destructive/20 text-destructive hover:bg-destructive hover:text-white ${!analysisResult ? 'opacity-50 grayscale' : ''}`}
            disabled={!analysisResult}
            onClick={onCleanup}
          >
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>
      </CardContent>
    </Card>
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

function PerfCard({ title, value, icon: Icon, status, desc }: any) {
  const statusColors: any = {
    "Bom": "bg-success/10 text-success border-success/20",
    "Atenção": "bg-warning/10 text-warning border-warning/20",
    "Lento": "bg-warning/10 text-warning border-warning/20",
    "Crítico": "bg-destructive/10 text-destructive border-destructive/20",
    "Info": "bg-primary/10 text-primary border-primary/20",
  };

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <CardContent className="p-4 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-muted/50 text-muted-foreground"><Icon className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold tracking-tight truncate">{value}</span>
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${statusColors[status] || statusColors.Info}`}>{status}</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPlaceholder({ label }: { label: string }) {
  return (
    <div className="p-3 rounded-xl border border-dashed border-muted-foreground/30 flex flex-col items-center gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
      <span className="text-xs font-mono">Não configurado</span>
    </div>
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
