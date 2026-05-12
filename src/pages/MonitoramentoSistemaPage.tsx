import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, HardDrive, Server, RefreshCw, 
  Loader2, AlertTriangle, CheckCircle, Info, 
  Trash2, ShieldAlert, Activity, FileText,
  Clock, Gauge, Zap, Download, LineChart, Shield,
  Link2, Settings2, Network, Save, TestTube
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
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<string | null>(null);
  const [cleanupText, setCleanupText] = useState("");
  const [showExternalConfig, setShowExternalConfig] = useState(false);
  
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

  useEffect(() => { 
    // Measure page load time
    const loadTime = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (loadTime) {
      setMetrics(prev => ({ ...prev, pageLoadTime: Math.round(loadTime.duration) }));
    }

    // Measure Supabase latency
    const measureSupabase = async () => {
      const s = performance.now();
      await supabase.from('profiles').select('id').limit(1);
      const e = performance.now();
      setMetrics(prev => ({ ...prev, supabaseLatency: Math.round(e - s) }));
    };

    measureSupabase();
    fetchStats(); 
  }, []);

  const totalRows = stats?.database?.tables?.reduce((acc: number, t: any) => acc + Number(t.row_count), 0) || 0;
  const heaviestTable = stats?.database?.tables?.sort((a: any, b: any) => {
      const valA = parseFloat(a.total_size.replace(/[^0-9.]/g, ''));
      const valB = parseFloat(b.total_size.replace(/[^0-9.]/g, ''));
      return valB - valA;
  })[0];

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 w-full">
        <div className="max-w-full">
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-foreground truncate block">Monitoramento do Sistema</h1>
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
        <TabsList className="grid grid-cols-2 md:grid-cols-8 h-auto p-1 bg-muted/50">
          <TabsTrigger value="overview">Geral</TabsTrigger>
          <TabsTrigger value="db">Banco</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="perf">Desempenho</TabsTrigger>
          <TabsTrigger value="hosting">Hospedagem</TabsTrigger>
          <TabsTrigger value="supabase">Supabase</TabsTrigger>
          <TabsTrigger value="cleanup">Limpeza</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
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

        <TabsContent value="hosting" className="mt-6">
           <Card className="border-border/60 shadow-sm">
             <CardHeader>
               <CardTitle>Configuração de Hospedagem</CardTitle>
               <CardDescription>Detalhes do ambiente de execução.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="p-4 rounded-xl border bg-muted/10">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Ambiente Atual</p>
                      <p className="text-lg font-bold">Lovable Cloud (Managed)</p>
                   </div>
                   <div className="p-4 rounded-xl border bg-muted/10">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Região</p>
                      <p className="text-lg font-bold">AWS us-east-1</p>
                   </div>
                </div>
                <div className="mt-4 p-6 border border-dashed rounded-2xl bg-muted/5 flex flex-col items-center text-center">
                   <Server className="h-10 w-10 text-muted-foreground/30 mb-3" />
                   <h3 className="font-semibold">Monitoramento Externo (Coolify/VPS)</h3>
                   <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">Integre sua VPS própria ou painel Coolify para métricas de CPU, RAM e Disco.</p>
                   <Button variant="outline" disabled>Configurar Monitoramento Externo</Button>
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="supabase" className="mt-6">
           <Card className="border-border/60 shadow-sm">
             <CardHeader>
               <CardTitle>Infraestrutura Supabase</CardTitle>
               <CardDescription>Status dos serviços gerenciados.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="space-y-4">
                   <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded bg-primary/10"><Database className="h-4 w-4 text-primary" /></div>
                         <span className="font-medium text-sm">PostgreSQL (Database)</span>
                      </div>
                      <Badge className="bg-success">Operacional</Badge>
                   </div>
                   <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded bg-accent/10"><Zap className="h-4 w-4 text-accent" /></div>
                         <span className="font-medium text-sm">GoTrue (Auth)</span>
                      </div>
                      <Badge className="bg-success">Operacional</Badge>
                   </div>
                   <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded bg-orange-500/10"><Activity className="h-4 w-4 text-orange-500" /></div>
                         <span className="font-medium text-sm">Realtime Engine</span>
                      </div>
                      <Badge className="bg-success">Operacional</Badge>
                   </div>
                   <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded bg-purple-500/10"><Server className="h-4 w-4 text-purple-500" /></div>
                         <span className="font-medium text-sm">Edge Functions</span>
                      </div>
                      <Badge className="bg-success">Operacional</Badge>
                   </div>
                </div>
                <div className="pt-4 flex gap-2">
                   <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="gap-2">
                      <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Testar Conexão Supabase
                   </Button>
                </div>
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


