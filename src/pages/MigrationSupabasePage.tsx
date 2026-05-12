import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertCircle, CheckCircle2, Database, ShieldAlert, Zap, 
  Search, FileCode, Play, ClipboardCheck, ArrowRightLeft, 
  AlertTriangle, Loader2, Save, Download, RefreshCw,
  Lock, ExternalLink
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

type StepStatus = "pending" | "migrating" | "success" | "error";

export default function MigrationSupabasePage() {
  const { isMaster } = useAuth();
  
  // Current environment credentials (source)
  const [source, setSource] = useState({
    url: import.meta.env.VITE_SUPABASE_URL || "",
    serviceRoleKey: "",
  });

  // Target environment credentials (destination)
  const [destination, setDestination] = useState({
    url: "",
    serviceRoleKey: "",
    anonKey: "",
  });

  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<Record<string, StepStatus>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [currentStep, setCurrentStep] = useState(0); // 0: Config, 1: Diagnostic, 2: Migrating, 3: Completed

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const validateCredentials = (creds: { url: string; serviceRoleKey: string; anonKey?: string }, type: 'origem' | 'destino') => {
    if (!creds.url || !creds.url.startsWith('https://')) {
      toast.error(`URL da ${type} inválida. Certifique-se de que começa com https://`);
      return false;
    }
    if (!creds.serviceRoleKey || !creds.serviceRoleKey.startsWith('eyJ')) {
      toast.error(`Service Role Key da ${type} inválida. Deve ser uma chave JWT começando com eyJ.`);
      return false;
    }
    if (type === 'destino' && (!creds.anonKey || !creds.anonKey.startsWith('eyJ'))) {
      toast.error(`Anon Key do destino inválida. Deve ser uma chave JWT começando com eyJ.`);
      return false;
    }
    return true;
  };

  const testConnections = async () => {
    if (!validateCredentials(source, 'origem') || !validateCredentials(destination, 'destino')) return;
    
    setLoading("testing");
    addLog("Iniciando teste de conectividade entre servidores...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "test-connections", source, destination },
      });

      if (error) throw error;
      
      if (data.source.ok && data.destination.ok) {
        toast.success("Conexão validada em ambos os projetos!");
        addLog("✅ Conexões OK: Origem respondeu, Destino respondeu.");
        setCurrentStep(1);
      } else {
        if (!data.source.ok) {
          toast.error(`Falha na Origem: ${data.source.error}`);
          addLog(`❌ Falha na Origem: ${data.source.error}`);
        }
        if (!data.destination.ok) {
          toast.error(`Falha no Destino: ${data.destination.error}`);
          addLog(`❌ Falha no Destino: ${data.destination.error}`);
        }
      }
    } catch (err: any) {
      toast.error(`Erro crítico no teste: ${err.message}`);
      addLog(`❌ Erro no teste: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const runDiagnostic = async () => {
    if (currentStep < 1) return;
    setLoading("diagnostic");
    addLog("Executando diagnóstico de volume de dados...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "diagnostic", source, destination },
      });

      if (error) throw error;
      setDiagnosticData(data);
      addLog(`✅ Diagnóstico concluído: ${data.source.tables.length} tabelas, ${data.source.usersCount} usuários.`);
      toast.success("Diagnóstico concluído.");
    } catch (err: any) {
      toast.error(`Falha no diagnóstico: ${err.message}`);
      addLog(`❌ Erro no diagnóstico: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const migrateAuth = async () => {
    setLoading("migrating-auth");
    addLog("Sincronizando banco de usuários (Auth)...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "migrate-auth", source, destination },
      });
      if (error) throw error;
      
      const successCount = data.results.filter((r: any) => r.success).length;
      addLog(`✅ Sincronização de usuários concluída (${successCount} sucessos).`);
      toast.success("Usuários sincronizados.");
    } catch (err: any) {
      addLog(`❌ Erro na sincronização de usuários: ${err.message}`);
      toast.error("Erro na sincronização de usuários.");
    } finally {
      setLoading(null);
    }
  };

  const migrateStorage = async () => {
    setLoading("migrating-storage");
    addLog("Sincronizando arquivos de Storage...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "migrate-storage", source, destination },
      });
      if (error) throw error;
      addLog(`✅ Storage sincronizado (${data.results.length} buckets).`);
      toast.success("Storage sincronizado.");
    } catch (err: any) {
      addLog(`❌ Erro no Storage: ${err.message}`);
      toast.error("Erro no Storage.");
    } finally {
      setLoading(null);
    }
  };

  const migrateTable = async (tableName: string) => {
    setMigrationStatus(prev => ({ ...prev, [tableName]: "migrating" }));
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "migrate-table-data", source, destination, table: tableName },
      });
      if (error) throw error;
      setMigrationStatus(prev => ({ ...prev, [tableName]: "success" }));
      return data.totalMigrated;
    } catch (err: any) {
      setMigrationStatus(prev => ({ ...prev, [tableName]: "error" }));
      throw err;
    }
  };

  const runFullMigration = async () => {
    if (!diagnosticData) return;
    
    setLoading("full-migration");
    addLog("🚀 INICIANDO PROCESSO DE MIGRAÇÃO INTEGRAL...");
    
    try {
      await migrateAuth();
      
      const tables = diagnosticData.source.tables;
      for (const table of tables) {
        addLog(`Copiando dados: ${table.name}...`);
        const count = await migrateTable(table.name);
        addLog(`   -> Concluído: ${count} registros.`);
      }
      
      await migrateStorage();
      
      addLog("✅ MIGRAÇÃO DE DADOS FINALIZADA COM SUCESSO.");
      setCurrentStep(2);
      toast.success("Todos os dados foram sincronizados!");
    } catch (err: any) {
      addLog(`❌ ABORTO: Erro crítico durante migração: ${err.message}`);
      toast.error("A migração falhou. Verifique os logs.");
    } finally {
      setLoading(null);
    }
  };

  const finalizeMigration = () => {
    if (confirmText !== "CONFIRMAR MIGRAÇÃO DEFINITIVA") {
      toast.error("Texto de confirmação incorreto.");
      return;
    }

    // Double check status
    const hasErrors = Object.values(migrationStatus).includes("error");
    if (hasErrors) {
      toast.error("Não é possível finalizar com erros pendentes na migração.");
      return;
    }

    addLog("--------------------------------------------------");
    addLog("✅ PROCESSO DE MIGRAÇÃO CONCLUÍDO NO BANCO.");
    addLog("⚠️ ETAPA FINAL: TROCA DE CHAVES NO LOVABLE CLOUD");
    addLog("--------------------------------------------------");
    addLog("");
    addLog("Siga exatamente estas instruções para ativar o novo projeto:");
    addLog("");
    addLog("1. No editor do Lovable, clique no botão 'Cloud' (topo direito).");
    addLog("2. Acesse a aba 'Variables' ou 'Secrets'.");
    addLog("3. Atualize os seguintes campos com os novos valores:");
    addLog("");
    addLog(`   • VITE_SUPABASE_URL (URL do Novo Projeto):`);
    addLog(`     ${destination.url}`);
    addLog("");
    addLog(`   • VITE_SUPABASE_PUBLISHABLE_KEY (Nova Anon Key):`);
    addLog(`     ${destination.anonKey}`);
    addLog("");
    addLog(`   • SUPABASE_SERVICE_ROLE_KEY:`);
    addLog(`     [Copie a Service Role Key do seu novo painel Supabase]`);
    addLog("");
    addLog("🔒 NOTA DE SEGURANÇA: A Service Role Key nunca é exibida aqui por proteção.");
    addLog("Busque-a em: Project Settings > API > service_role (secret).");
    addLog("");
    addLog("4. Clique em 'Save' e o sistema reiniciará usando a nova infraestrutura.");
    addLog("");
    
    toast.success("Migração finalizada! Siga as instruções no log para a troca de chaves.", { duration: 10000 });
    setCurrentStep(3);
  };

  if (!isMaster) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso Restrito</AlertTitle>
          <AlertDescription>Área exclusiva para Gestores Master.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Database className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Migração Supabase</h1>
          <p className="text-muted-foreground">Transição definitiva para infraestrutura externa própria.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Project */}
        <Card className={currentStep > 0 ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-blue-500" /> Origem (Projeto Atual Lovable)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">URL do Projeto</Label>
              <Input value={source.url} readOnly className="bg-muted font-mono text-[10px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Service Role Key</Label>
              <Input 
                type="password" 
                value={source.serviceRoleKey} 
                onChange={e => setSource(s => ({ ...s, serviceRoleKey: e.target.value.trim() }))}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                className="font-mono text-[10px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Destination Project */}
        <Card className={currentStep > 0 ? "opacity-50 pointer-events-none" : "border-primary/40 shadow-sm"}>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> Destino (Novo Projeto Externo)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">Nova URL do Projeto</Label>
              <Input 
                value={destination.url} 
                onChange={e => setDestination(s => ({ ...s, url: e.target.value.trim().replace(/\/$/, "") }))}
                placeholder="https://xyz.supabase.co"
                className="font-mono text-[10px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nova Anon / Publishable Key</Label>
              <Input 
                type="password"
                value={destination.anonKey} 
                onChange={e => setDestination(s => ({ ...s, anonKey: e.target.value.trim() }))}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                className="font-mono text-[10px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nova Service Role Key</Label>
              <Input 
                type="password"
                value={destination.serviceRoleKey} 
                onChange={e => setDestination(s => ({ ...s, serviceRoleKey: e.target.value.trim() }))}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                className="font-mono text-[10px]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {currentStep === 0 && (
        <div className="flex justify-center">
          <Button size="lg" className="px-16 h-12 text-md font-bold" onClick={testConnections} disabled={!!loading}>
            {loading === "testing" ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Play className="h-5 w-5 mr-2" />}
            Validar Conexões
          </Button>
        </div>
      )}

      {currentStep >= 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/30 p-4 rounded-xl border border-dashed">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm font-medium">Conexões estabelecidas. Pronto para o diagnóstico.</p>
            </div>
            <Button variant="outline" size="sm" onClick={runDiagnostic} disabled={!!loading}>
              <Search className="h-4 w-4 mr-2" /> {diagnosticData ? "Recarregar Diagnóstico" : "Executar Diagnóstico"}
            </Button>
          </div>

          {diagnosticData && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Resumo de Dados</TabsTrigger>
                <TabsTrigger value="sql">Schema SQL</TabsTrigger>
                <TabsTrigger value="process">Execução</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs uppercase text-muted-foreground">Usuários</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-2xl font-bold">{diagnosticData.source.usersCount}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs uppercase text-muted-foreground">Tabelas</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-2xl font-bold">{diagnosticData.source.tables.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs uppercase text-muted-foreground">Storage</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-2xl font-bold">{diagnosticData.source.storageBuckets.length} buckets</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="sql" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground font-mono">Estrutura SQL do Banco (Schema Public)</p>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => {
                        if (diagnosticData.schemaSql) {
                          navigator.clipboard.writeText(diagnosticData.schemaSql);
                          toast.success("SQL copiado!");
                        }
                      }}>
                        <ClipboardCheck className="h-3 w-3 mr-1" /> Copiar
                      </Button>
                    </div>
                    <ScrollArea className="h-[200px] w-full bg-slate-950 text-slate-300 p-3 rounded-lg border font-mono text-[10px]">
                      <pre>{diagnosticData.schemaSql || "SQL não gerado. Vá em Execução para gerar o schema."}</pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="process" className="mt-4 space-y-4">
                {currentStep === 1 && (
                  <Button 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold" 
                    onClick={runFullMigration}
                    disabled={!!loading}
                  >
                    {loading === "full-migration" ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
                    INICIAR MIGRAÇÃO INTEGRAL AUTOMATIZADA
                  </Button>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {diagnosticData.source.tables.map((t: any) => (
                    <div key={t.name} className="p-2 border rounded-md flex items-center justify-between bg-background">
                      <span className="text-[10px] font-medium truncate max-w-[80px]">{t.name}</span>
                      {migrationStatus[t.name] === "success" ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : migrationStatus[t.name] === "migrating" ? (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                      ) : migrationStatus[t.name] === "error" ? (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-muted" />
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <Card className="bg-slate-950 border-slate-800 shadow-2xl">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono text-slate-400">Terminal Output</CardTitle>
              <FileCode className="h-3 w-3 text-slate-600" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-[150px] w-full font-mono text-[10px] text-slate-300">
                {logs.length === 0 && <span className="text-slate-600 italic">Aguardando comando...</span>}
                {logs.map((log, i) => (
                  <div key={i} className="mb-0.5 border-l border-slate-800 pl-2">{log}</div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          {currentStep >= 2 && (
            <div className="p-6 border-2 border-destructive/30 rounded-2xl bg-destructive/5 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3 text-destructive font-bold">
                <ShieldAlert className="h-7 w-7" />
                <h3 className="text-xl">FINALIZAÇÃO DEFINITIVA</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A sincronização de dados está concluída. Para ativar o novo projeto, você deve confirmar a transição. 
                Isso gerará as instruções finais para as variáveis de ambiente do Lovable.
              </p>
              
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider">Confirmar por extenso:</Label>
                <Input 
                  value={confirmText} 
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="CONFIRMAR MIGRAÇÃO DEFINITIVA"
                  className="bg-background font-bold border-destructive/20 h-11"
                />
              </div>

              <Button 
                variant="destructive" 
                className="w-full h-12 text-lg font-black shadow-lg"
                onClick={finalizeMigration}
                disabled={confirmText !== "CONFIRMAR MIGRAÇÃO DEFINITIVA" || !!loading || currentStep === 3}
              >
                {currentStep === 3 ? "MIGRAÇÃO CONCLUÍDA" : "ATIVAR NOVO PROJETO NO LOVABLE"}
              </Button>

              {currentStep === 3 && (
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-blue-500 font-bold">
                    <ExternalLink className="h-5 w-5" />
                    <span>Próximos Passos Obrigatórios:</span>
                  </div>
                  <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-5">
                    <li>Vá em <b>Cloud &gt; Variables</b> no editor do Lovable.</li>
                    <li>Copie a <b>Nova URL</b> e a <b>Nova Anon Key</b> do log acima.</li>
                    <li>Busque a <b>Service Role Key</b> no seu novo painel Supabase.</li>
                    <li>Salve as alterações e aguarde o reinício do sistema.</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
