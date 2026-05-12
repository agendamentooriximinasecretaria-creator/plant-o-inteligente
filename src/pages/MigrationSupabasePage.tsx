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
  AlertTriangle, Loader2, Save, Download, RefreshCw
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MigrationSupabasePage() {
  const { isMaster } = useAuth();
  const [source, setSource] = useState({
    url: import.meta.env.VITE_SUPABASE_URL || "",
    serviceRoleKey: "",
  });
  const [destination, setDestination] = useState({
    url: "",
    serviceRoleKey: "",
    anonKey: "",
  });

  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<Record<string, "pending" | "migrating" | "success" | "error">>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [currentStep, setCurrentStep] = useState(0); // 0: Config, 1: Diagnostic, 2: Migrating, 3: Finalizing

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const validateCredentials = (creds: { url: string; serviceRoleKey: string; anonKey?: string }, type: 'origem' | 'destino') => {
    if (!creds.url || !creds.url.startsWith('https://')) {
      toast.error(`URL da ${type} inválida. Deve começar com https://`);
      return false;
    }
    if (!creds.serviceRoleKey || !creds.serviceRoleKey.startsWith('eyJ')) {
      toast.error(`Service Role Key da ${type} parece inválida (deve começar com eyJ).`);
      return false;
    }
    if (type === 'destino' && (!creds.anonKey || !creds.anonKey.startsWith('eyJ'))) {
      toast.error(`Anon Key do destino parece inválida.`);
      return false;
    }
    return true;
  };

  const testConnections = async () => {
    if (!validateCredentials(source, 'origem') || !validateCredentials(destination, 'destino')) return;
    
    setLoading("testing");
    addLog("Testando conexões...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "test-connections", source, destination },
      });

      if (error) throw error;
      
      if (data.source.ok && data.destination.ok) {
        toast.success("Conexões estabelecidas com sucesso!");
        addLog("Conexões estabelecidas: Origem OK, Destino OK.");
        setCurrentStep(1);
      } else {
        if (!data.source.ok) {
          toast.error(`Erro na origem: ${data.source.error}`);
          addLog(`Erro na origem: ${data.source.error}`);
        }
        if (!data.destination.ok) {
          toast.error(`Erro no destino: ${data.destination.error}`);
          addLog(`Erro no destino: ${data.destination.error}`);
        }
      }
    } catch (err: any) {
      toast.error(`Falha no teste: ${err.message}`);
      addLog(`Erro no teste: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const runDiagnostic = async () => {
    if (!validateCredentials(source, 'origem') || !validateCredentials(destination, 'destino')) return;
    
    setLoading("diagnostic");
    addLog("Iniciando diagnóstico detalhado...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "diagnostic", source, destination },
      });

      if (error) throw error;
      setDiagnosticData(data);
      addLog(`Diagnóstico concluído. Tabelas: ${data.source.tables.length}, Usuários: ${data.source.usersCount}, Buckets: ${data.source.storageBuckets.length}.`);
      toast.success("Diagnóstico concluído.");
      setCurrentStep(2);
    } catch (err: any) {
      toast.error(`Falha no diagnóstico: ${err.message}`);
      addLog(`Erro no diagnóstico: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const migrateTables = async () => {
    if (!diagnosticData) {
      toast.error("Execute o diagnóstico primeiro.");
      return;
    }
    
    setLoading("migrating-data");
    addLog("Iniciando migração de dados das tabelas...");
    
    const tables = diagnosticData.source.tables;
    let successCount = 0;
    let errorCount = 0;

    for (const tableInfo of tables) {
      try {
        setMigrationStatus(prev => ({ ...prev, [tableInfo.name]: "migrating" }));
        addLog(`Migrando tabela: ${tableInfo.name} (${tableInfo.count} registros)...`);
        
        const { data, error } = await supabase.functions.invoke("migrate-supabase", {
          body: { action: "migrate-table-data", source, destination, table: tableInfo.name },
        });
        
        if (error) throw error;
        
        addLog(`Sucesso: ${tableInfo.name} (${data.totalMigrated} registros).`);
        setMigrationStatus(prev => ({ ...prev, [tableInfo.name]: "success" }));
        successCount++;
      } catch (err: any) {
        addLog(`Erro em ${tableInfo.name}: ${err.message}`);
        setMigrationStatus(prev => ({ ...prev, [tableInfo.name]: "error" }));
        errorCount++;
      }
    }
    
    toast.success(`Migração de tabelas finalizada: ${successCount} sucessos, ${errorCount} falhas.`);
    setLoading(null);
  };

  const migrateAuth = async () => {
    setLoading("migrating-auth");
    addLog("Iniciando migração de usuários (Auth)...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "migrate-auth", source, destination },
      });
      if (error) throw error;
      
      const success = data.results.filter((r: any) => r.success).length;
      const failed = data.results.filter((r: any) => !r.success).length;
      
      addLog(`Migração de usuários concluída: ${success} migrados, ${failed} falhas.`);
      data.results.forEach((r: any) => {
        if (!r.success) addLog(`Aviso: Falha ao migrar ${r.email}: ${r.error}`);
      });
      toast.success("Migração de usuários concluída.");
    } catch (err: any) {
      addLog(`Erro na migração de usuários: ${err.message}`);
      toast.error("Erro na migração de usuários.");
    } finally {
      setLoading(null);
    }
  };

  const migrateStorage = async () => {
    setLoading("migrating-storage");
    addLog("Iniciando migração de Storage (buckets e arquivos)...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "migrate-storage", source, destination },
      });
      if (error) throw error;
      
      addLog(`Migração de storage concluída. Buckets processados: ${data.results.length}.`);
      toast.success("Migração de storage concluída.");
    } catch (err: any) {
      addLog(`Erro na migração de storage: ${err.message}`);
      toast.error("Erro na migração de storage.");
    } finally {
      setLoading(null);
    }
  };

  const generateSchemaSQL = async () => {
    setLoading("generating-sql");
    addLog("Gerando SQL de estrutura (Schema)...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "generate-sql", source, destination },
      });
      if (error) throw error;
      
      setDiagnosticData((prev: any) => ({ ...prev, schemaSql: data.sql }));
      addLog("SQL de schema gerado com sucesso.");
      toast.success("SQL disponível na aba Schema.");
    } catch (err: any) {
      addLog(`Erro ao gerar SQL: ${err.message}`);
      toast.error("Erro ao gerar SQL.");
    } finally {
      setLoading(null);
    }
  };

  const runFullMigration = async () => {
    if (!diagnosticData) {
      toast.error("Execute o diagnóstico primeiro.");
      return;
    }
    
    setLoading("full-migration");
    addLog(">>> INICIANDO MIGRAÇÃO AUTOMATIZADA COMPLETA <<<");
    
    try {
      // 1. Auth
      await migrateAuth();
      
      // 2. Tables
      await migrateTables();
      
      // 3. Storage
      await migrateStorage();
      
      addLog(">>> TODAS AS ETAPAS DE DADOS CONCLUÍDAS <<<");
      toast.success("Migração completa concluída!");
    } catch (err: any) {
      addLog(`Erro na migração automatizada: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const finalizeMigration = async () => {
    // 1. Validação de Integridade: Impedir se houver erros em qualquer tabela migrada
    const tablesWithErrors = Object.entries(migrationStatus)
      .filter(([_, status]) => status === "error")
      .map(([name]) => name);

    if (tablesWithErrors.length > 0) {
      toast.error(`Existem erros nas tabelas: ${tablesWithErrors.join(", ")}. Corrija antes de finalizar.`);
      addLog(`❌ Falha na finalização: Erros detectados em ${tablesWithErrors.length} tabelas.`);
      return;
    }

    if (confirmText !== "CONFIRMAR MIGRAÇÃO DEFINITIVA") {
      toast.error("Digite a frase de confirmação exatamente como solicitada.");
      return;
    }
    
    setLoading("finalizing");
    addLog("--------------------------------------------------");
    addLog("📋 CONSOLIDANDO CHECKLIST DE TRANSIÇÃO");
    addLog("--------------------------------------------------");
    
    try {
      // Causa raiz do bug relatado: Possível confusão de mapeamento entre URL e Keys.
      // Correção: Instruções explícitas, separadas e sem expor a service role por segurança.
      
      const instructions = [
        "✅ ETAPA 1: DADOS, USUÁRIOS E ARQUIVOS SINCRONIZADOS.",
        "⚠️ ETAPA 2: CONFIGURAÇÃO MANUAL NO LOVABLE CLOUD (Obrigatório)",
        "",
        "No painel do Lovable (botão 'Cloud' no canto superior direito),",
        "acesse 'Variables' / 'Secrets' e atualize os seguintes campos:",
        "",
        `• VITE_SUPABASE_URL (Nova URL do Projeto):`,
        `  ${destination.url}`,
        "",
        `• VITE_SUPABASE_PUBLISHABLE_KEY (Nova Anon Key):`,
        `  ${destination.anonKey}`,
        "",
        `• SUPABASE_SERVICE_ROLE_KEY (Nova Service Role Key):`,
        `  [Copie do seu novo painel Supabase > Project Settings > API]`,
        "",
        "⚠️ DICA DE SEGURANÇA: Jamais use a URL no lugar da Key.",
        "A URL começa com 'https://' e a Key começa sempre com 'eyJ...'",
        "",
        "✅ ETAPA 3: REINICIAR SERVIDOR",
        "Após salvar as variáveis, o Lovable irá reiniciar para aplicar as novas conexões.",
      ];

      instructions.forEach(line => addLog(line));
      
      toast.success("Migração lógica concluída! Siga o checklist nos logs para a troca definitiva.", { duration: 15000 });
      setCurrentStep(3);
    } catch (err: any) {
      addLog(`❌ Erro ao processar finalização: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  if (!isMaster) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Apenas Gestores Master Globais podem acessar esta área de infraestrutura crítica.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Migração de Infraestrutura</h1>
            <p className="text-muted-foreground">
              Transição segura do Lovable Managed Supabase para sua infraestrutura própria.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {diagnosticData && (
            <Button variant="outline" size="sm" onClick={() => {
              setDiagnosticData(null);
              setCurrentStep(0);
              setLogs([]);
            }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Reiniciar Processo
            </Button>
          )}
        </div>
      </div>

      <Alert variant="destructive" className="bg-destructive/10 border-destructive">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="font-bold">Protocolo de Segurança</AlertTitle>
        <AlertDescription>
          Esta ferramenta migra 100% dos dados, usuários e arquivos. Uma vez completada a troca das chaves no Lovable, o banco antigo será desconectado mas permanecerá intacto como backup.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={currentStep > 0 ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" /> Origem (Projeto Atual)
            </CardTitle>
            <CardDescription>Dados atuais do sistema no Lovable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-url">Supabase URL</Label>
              <Input id="s-url" value={source.url} readOnly className="bg-muted font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-role">Service Role Key (Necessária para leitura total)</Label>
              <Input 
                id="s-role" 
                type="password"
                value={source.serviceRoleKey} 
                onChange={e => setSource(s => ({ ...s, serviceRoleKey: e.target.value }))}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                disabled={currentStep > 0}
              />
            </div>
          </CardContent>
        </Card>

        <Card className={currentStep > 0 ? "opacity-60" : "border-primary/50 shadow-md"}>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> Destino (Novo Projeto Externo)
            </CardTitle>
            <CardDescription>Credenciais da sua nova instância Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="d-url">Nova Supabase URL</Label>
              <Input 
                id="d-url" 
                value={destination.url} 
                onChange={e => setDestination(s => ({ ...s, url: e.target.value }))}
                placeholder="https://sua-instancia.supabase.co"
                disabled={currentStep > 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-role">Nova Service Role Key</Label>
              <Input 
                id="d-role" 
                type="password"
                value={destination.serviceRoleKey} 
                onChange={e => setDestination(s => ({ ...s, serviceRoleKey: e.target.value }))}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                disabled={currentStep > 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-anon">Nova Anon / Publishable Key</Label>
              <Input 
                id="d-anon" 
                type="password"
                value={destination.anonKey} 
                onChange={e => setDestination(s => ({ ...s, anonKey: e.target.value }))}
                placeholder="eyJhbGciOiJIUzI1Ni..."
                disabled={currentStep > 0}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {currentStep === 0 && (
        <div className="flex justify-center p-4">
          <Button 
            size="lg" 
            className="px-12 bg-primary hover:bg-primary/90" 
            onClick={testConnections}
            disabled={!!loading}
          >
            {loading === "testing" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Validar Conexões e Iniciar
          </Button>
        </div>
      )}

      {currentStep >= 1 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Progresso</span>
                <span className="text-sm font-bold">
                  {currentStep === 1 ? "Diagnóstico Pendente" : currentStep === 2 ? "Migração em Curso" : "Aguardando Troca de Chaves"}
                </span>
              </div>
              <Progress value={currentStep * 33.3} className="w-48 h-2" />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={currentStep === 1 ? "default" : "outline"}
                size="sm"
                onClick={runDiagnostic}
                disabled={!!loading}
              >
                <Search className="h-4 w-4 mr-2" /> {diagnosticData ? "Atualizar Diagnóstico" : "Executar Diagnóstico"}
              </Button>
              {diagnosticData && currentStep === 1 && (
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                >
                  Prosseguir para Migração <ArrowRightLeft className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {diagnosticData && (
            <Tabs defaultValue="tables" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="tables">Tabelas ({diagnosticData.source.tables.length})</TabsTrigger>
                <TabsTrigger value="auth">Usuários ({diagnosticData.source.usersCount})</TabsTrigger>
                <TabsTrigger value="storage">Storage ({diagnosticData.source.storageBuckets.length})</TabsTrigger>
                <TabsTrigger value="sql">Schema SQL</TabsTrigger>
              </TabsList>
              
              <TabsContent value="tables" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg">Integridade de Dados</CardTitle>
                      <CardDescription>Sincronização entre origem e destino.</CardDescription>
                    </div>
                    {currentStep === 2 && (
                      <Button size="sm" variant="outline" onClick={migrateTables} disabled={!!loading}>
                         <RefreshCw className="h-4 w-4 mr-2" /> Migrar Tabelas Manualmente
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {diagnosticData.source.tables.map((table: any) => (
                        <div key={table.name} className="flex justify-between items-center p-2 border rounded-md bg-background/50">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs truncate max-w-[120px]">{table.name}</span>
                            <span className="text-[10px] text-muted-foreground">{table.count} registros</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {migrationStatus[table.name] === "success" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : migrationStatus[table.name] === "migrating" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            ) : migrationStatus[table.name] === "error" ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : diagnosticData.destination.tables.some((t: any) => t.name === table.name) ? (
                              <CheckCircle2 className="h-4 w-4 text-blue-400 opacity-50" />
                            ) : (
                              <div className="h-2 w-2 rounded-full bg-muted" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="auth" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Identidades e Acessos</CardTitle>
                    <CardDescription>Migração de usuários preservando UUIDs.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Este processo recria os usuários na nova instância mantendo o mesmo identificador único (UUID). 
                      Isso garante que todos os dados vinculados (escalas, perfis, plantões) continuem funcionando perfeitamente.
                    </p>
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border border-dashed">
                      <div className="text-center flex-1">
                        <div className="text-2xl font-bold">{diagnosticData.source.usersCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Origem</div>
                      </div>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                      <div className="text-center flex-1">
                        <div className="text-2xl font-bold">?</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Destino</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    {currentStep === 2 && (
                      <Button variant="outline" className="w-full" onClick={migrateAuth} disabled={!!loading}>
                        {loading === "migrating-auth" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                        Sincronizar Usuários (Auth)
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="storage" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Arquivos e Mídia</CardTitle>
                    <CardDescription>Cópia binária de todos os buckets.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {diagnosticData.source.storageBuckets.map((b: any) => (
                        <div key={b.id} className="flex items-center gap-2 p-2 border rounded bg-background">
                          <FileCode className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium">{b.id}</span>
                          {b.public && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">Público</span>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    {currentStep === 2 && (
                      <Button variant="outline" className="w-full" onClick={migrateStorage} disabled={!!loading}>
                        {loading === "migrating-storage" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        Migrar Arquivos de Storage
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="sql" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Schema Structural SQL</CardTitle>
                    <CardDescription>Execute no Editor SQL do novo projeto antes da migração de dados.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px] w-full border rounded p-4 bg-muted font-mono text-[10px] leading-tight">
                      <pre>{diagnosticData?.schemaSql || "Clique em 'Gerar SQL Estrutural' para visualizar o código..."}</pre>
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={generateSchemaSQL} disabled={!!loading}>
                       {loading === "generating-sql" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                       Gerar SQL
                    </Button>
                    {diagnosticData?.schemaSql && (
                      <Button variant="secondary" size="sm" onClick={() => {
                        navigator.clipboard.writeText(diagnosticData.schemaSql);
                        toast.success("SQL copiado!");
                      }}>
                        <ClipboardCheck className="h-4 w-4 mr-2" /> Copiar Código
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {currentStep === 2 && (
            <div className="p-6 border-2 border-primary/30 rounded-xl bg-primary/5 flex flex-col items-center gap-4">
              <div className="text-center">
                <h3 className="font-bold text-lg">Migração Completa Automatizada</h3>
                <p className="text-sm text-muted-foreground">Executa Auth, Tabelas e Storage em sequência.</p>
              </div>
              <Button 
                size="lg" 
                className="w-full md:w-auto px-16 bg-blue-600 hover:bg-blue-700 shadow-lg"
                onClick={runFullMigration}
                disabled={!!loading}
              >
                {loading === "full-migration" ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processando tudo...</>
                ) : (
                  <><Zap className="h-5 w-5 mr-2" /> INICIAR MIGRAÇÃO TOTAL AGORA</>
                )}
              </Button>
            </div>
          )}

          <Card className="border-t-4 border-t-primary">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4" /> Console de Saída (Logs)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px] w-full border rounded p-3 font-mono text-[10px] bg-slate-950 text-slate-200">
                {logs.length === 0 && <span className="text-slate-500 italic">Aguardando ações...</span>}
                {logs.map((log, i) => (
                  <div key={i} className="mb-1 border-b border-slate-800 pb-1">{log}</div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          {currentStep >= 2 && (
            <div className="space-y-4 p-6 border-2 border-destructive rounded-xl bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive font-bold">
                <ShieldAlert className="h-6 w-6" />
                <span>CONFIRMAÇÃO E TRANSIÇÃO FINAL</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao clicar no botão abaixo, você declara que validou a migração e está pronto para trocar as chaves de acesso. 
                Isso não altera os dados, apenas gera as instruções finais de conexão.
              </p>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Digite para confirmar:</Label>
                <div className="p-2 bg-muted rounded font-mono text-xs mb-2">CONFIRMAR MIGRAÇÃO DEFINITIVA</div>
                <Input 
                  value={confirmText} 
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Digite a frase acima"
                  className="font-mono text-sm"
                />
              </div>
              <Button 
                variant="destructive" 
                className="w-full font-bold h-12"
                disabled={confirmText !== "CONFIRMAR MIGRAÇÃO DEFINITIVA" || !!loading}
                onClick={finalizeMigration}
              >
                {loading === "finalizing" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "CONCLUIR E OBTER CHAVES DE TRANSIÇÃO"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
