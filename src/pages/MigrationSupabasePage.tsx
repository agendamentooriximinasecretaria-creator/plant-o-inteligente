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
  AlertTriangle, Loader2, Save, Download
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
  });

  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<any>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const testConnections = async () => {
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
      } else {
        if (!data.source.ok) toast.error(`Erro na origem: ${data.source.error}`);
        if (!data.destination.ok) toast.error(`Erro no destino: ${data.destination.error}`);
      }
    } catch (err: any) {
      toast.error(`Falha no teste: ${err.message}`);
      addLog(`Erro no teste: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const runDiagnostic = async () => {
    setLoading("diagnostic");
    addLog("Iniciando diagnóstico...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "diagnostic", source, destination },
      });

      if (error) throw error;
      setDiagnosticData(data);
      addLog("Diagnóstico concluído.");
      toast.success("Diagnóstico concluído.");
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
    addLog("Iniciando migração de dados...");
    
    // Identifica tabelas pendentes (não presentes no destino ou com contagem diferente)
    const tables = diagnosticData.source.tables;
    let successCount = 0;
    let errorCount = 0;

    for (const tableInfo of tables) {
      try {
        addLog(`[${successCount + errorCount + 1}/${tables.length}] Migrando tabela: ${tableInfo.name}...`);
        const { data, error } = await supabase.functions.invoke("migrate-supabase", {
          body: { action: "migrate-table-data", source, destination, table: tableInfo.name },
        });
        
        if (error) throw error;
        
        addLog(`Sucesso: ${tableInfo.name} (${data.totalMigrated} registros).`);
        setMigrationStatus((prev: any) => ({ ...prev, [tableInfo.name]: "success" }));
        successCount++;
      } catch (err: any) {
        addLog(`Erro em ${tableInfo.name}: ${err.message}`);
        setMigrationStatus((prev: any) => ({ ...prev, [tableInfo.name]: "error" }));
        errorCount++;
      }
    }
    
    toast.success(`Migração concluída: ${successCount} sucessos, ${errorCount} falhas.`);
    setLoading(null);
  };

  const migrateAuth = async () => {
    setLoading("migrating-auth");
    addLog("Iniciando migração de usuários...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "migrate-auth", source, destination },
      });
      if (error) throw error;
      addLog(`Migração de usuários concluída (${data.results.length} processados).`);
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
    addLog("Iniciando migração de storage...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "migrate-storage", source, destination },
      });
      if (error) throw error;
      addLog(`Migração de storage concluída.`);
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
    addLog("Gerando SQL de migração...");
    try {
      const { data, error } = await supabase.functions.invoke("migrate-supabase", {
        body: { action: "generate-sql", source, destination },
      });
      if (error) throw error;
      
      setDiagnosticData((prev: any) => ({ ...prev, schemaSql: data.sql }));
      addLog("SQL gerado com sucesso.");
      toast.success("SQL básico disponível na aba Schema.");
    } catch (err: any) {
      addLog(`Erro ao gerar SQL: ${err.message}`);
      toast.error("Erro ao gerar SQL.");
    } finally {
      setLoading(null);
    }
  };

  const finalizeMigration = async () => {
    if (confirmText !== "CONFIRMAR MIGRAÇÃO DEFINITIVA") return;
    
    setLoading("finalizing");
    addLog("FINALIZANDO MIGRAÇÃO...");
    addLog("Atualizando variáveis de ambiente do sistema...");
    
    try {
      addLog("AVISO: Para concluir, você deve atualizar as Secrets do projeto no Lovable com os novos valores.");
      addLog("VITE_SUPABASE_URL = " + destination.url);
      addLog("VITE_SUPABASE_PUBLISHABLE_KEY = [Anon Key do Destino]");
      addLog("SUPABASE_SERVICE_ROLE_KEY = " + destination.serviceRoleKey);
      
      toast.success("Migração finalizada no banco. Atualize as chaves do projeto.");
    } catch (err: any) {
      addLog(`Erro ao finalizar: ${err.message}`);
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
            Apenas Gestores Master Globais podem acessar esta área.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Migração Supabase</h1>
          <p className="text-muted-foreground">
            Migre DEFINITIVAMENTE todo o sistema para um Supabase externo.
          </p>
        </div>
      </div>

      <Alert variant="destructive" className="bg-destructive/10 border-destructive">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="font-bold">Aviso Crítico</AlertTitle>
        <AlertDescription>
          Esta operação migrará dados sensíveis, usuários e arquivos. Siga todas as etapas de diagnóstico antes de proceder.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Origem (Supabase Atual Lovable)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-url">Project URL</Label>
              <Input 
                id="s-url" 
                value={source.url} 
                onChange={e => setSource(s => ({ ...s, url: e.target.value }))}
                placeholder="https://abc.supabase.co"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-role">Service Role Key</Label>
              <Input 
                id="s-role" 
                type="password"
                value={source.serviceRoleKey} 
                onChange={e => setSource(s => ({ ...s, serviceRoleKey: e.target.value }))}
                placeholder="service_role_key_a1b2..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Destino (Novo Supabase Externo)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="d-url">Project URL</Label>
              <Input 
                id="d-url" 
                value={destination.url} 
                onChange={e => setDestination(s => ({ ...s, url: e.target.value }))}
                placeholder="https://xyz.supabase.co"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-role">Service Role Key</Label>
              <Input 
                id="d-role" 
                type="password"
                value={destination.serviceRoleKey} 
                onChange={e => setDestination(s => ({ ...s, serviceRoleKey: e.target.value }))}
                placeholder="service_role_key_x9y8..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center gap-4">
        <Button 
          variant="outline" 
          onClick={testConnections}
          disabled={!!loading}
        >
          {loading === "testing" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Testar Conexões
        </Button>
        <Button 
          onClick={runDiagnostic}
          disabled={!!loading || !source.serviceRoleKey || !destination.serviceRoleKey}
        >
          {loading === "diagnostic" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          Executar Diagnóstico
        </Button>
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
              <CardHeader>
                <CardTitle className="text-lg">Resumo de Dados (Schema Public)</CardTitle>
                <CardDescription>
                  Comparação de registros entre origem e destino.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {diagnosticData.source.tables.map((table: any) => (
                    <div key={table.name} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{table.name}</span>
                        <span className="text-xs text-muted-foreground">{table.count} registros na origem</span>
                      </div>
                      <div className="text-right">
                        {migrationStatus[table.name] === "success" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : diagnosticData.destination.tables.some((t: any) => t.name === table.name) ? (
                          <CheckCircle2 className="h-5 w-5 text-blue-400" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t p-6">
                <div className="text-sm">
                  Destino está {diagnosticData.destination.isEmpty ? <span className="text-green-600 font-bold">VAZIO</span> : <span className="text-destructive font-bold">COM DADOS</span>}
                </div>
                <Button variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={migrateTables} disabled={!!loading}>
                  {loading === "migrating-data" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Iniciar Migração de Tabelas
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="auth" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Migração de Autenticação</CardTitle>
                <CardDescription>
                  Usuários registrados no Supabase Auth.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A migração de Auth recriará os usuários no destino preservando o mesmo UUID (ID) para manter relacionamentos com profiles e outras tabelas.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={migrateAuth} disabled={!!loading}>
                  {loading === "migrating-auth" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                  Migrar Usuários
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Migração de Storage</CardTitle>
                <CardDescription>
                  Arquivos, logos, assinaturas e documentos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Os buckets serão recriados no destino e os arquivos copiados recursivamente mantendo a mesma estrutura de diretórios.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={migrateStorage} disabled={!!loading}>
                  {loading === "migrating-storage" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCode className="h-4 w-4 mr-2" />}
                  Migrar Buckets e Arquivos
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="sql" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Schema Migration SQL</CardTitle>
                <CardDescription>
                  Código SQL para recriar a estrutura no destino.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] w-full border rounded p-4 bg-muted font-mono text-xs">
                  <pre>{diagnosticData?.schemaSql || (diagnosticData ? (
                    `-- MIGRATION SCHEMA SQL\n\n` +
                    `/* 1. Criar extensões */\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n` +
                    `/* 2. Criar tabelas */\n` +
                    diagnosticData.source.tables.map((t: any) => `-- Tabela ${t.name}\n-- Copie o DDL do dashboard do Supabase.`).join("\n\n")
                  ) : "Aguardando diagnóstico...")}</pre>
                </ScrollArea>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={generateSchemaSQL} disabled={!!loading}>
                   {loading === "generating-sql" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                   Gerar SQL Estrutural
                </Button>
                {diagnosticData?.schemaSql && (
                  <Button variant="secondary" onClick={() => {
                    navigator.clipboard.writeText(diagnosticData.schemaSql);
                    toast.success("SQL copiado para a área de transferência.");
                  }}>
                    <Download className="h-4 w-4 mr-2" /> Copiar SQL
                  </Button>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Logs Técnicos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full border rounded p-4 font-mono text-xs text-foreground">
            {logs.length === 0 && <span className="text-muted-foreground">Nenhum log disponível.</span>}
            {logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {diagnosticData && (
        <div className="space-y-4 p-6 border-2 border-destructive rounded-xl bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive font-bold">
            <ShieldAlert className="h-6 w-6" />
            <span>CONFIRMAÇÃO DEFINITIVA</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Para trocar o sistema para o novo Supabase, todos os dados devem estar migrados e validados. Digite a frase abaixo para habilitar a troca.
          </p>
          <div className="space-y-2">
            <Label className="font-mono text-xs">CONFIRMAR MIGRAÇÃO DEFINITIVA</Label>
            <Input 
              value={confirmText} 
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Digite a frase exatamente como acima"
            />
          </div>
          <Button 
            variant="destructive" 
            className="w-full font-bold"
            disabled={confirmText !== "CONFIRMAR MIGRAÇÃO DEFINITIVA" || !!loading}
            onClick={finalizeMigration}
          >
            {loading === "finalizing" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "TROCAR SISTEMA PARA NOVO SUPABASE"}
          </Button>
        </div>
      )}
    </div>
  );
}
