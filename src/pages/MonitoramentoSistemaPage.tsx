import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Database, HardDrive, Server, Bell, RefreshCw, Download, Loader2, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function MonitoramentoSistemaPage() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

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

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display">Monitoramento do Sistema</h1>
          <p className="text-muted-foreground mt-1">Acompanhe a saúde, banco de dados, storage e serviços.</p>
        </div>
        <Button onClick={fetchStats} disabled={loading} variant="outline" className="gap-2">
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar análise
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard title="Status do Sistema" value={stats ? "Online" : "Indisponível"} icon={CheckCircle} color="text-success" />
        <StatusCard title="Banco de Dados" value={stats?.database ? "Conectado" : "Falha"} icon={Database} color={stats?.database ? "text-primary" : "text-destructive"} />
        <StatusCard title="Storage" value={stats?.storage ? `${stats.storage.length} Buckets` : "Indisponível"} icon={HardDrive} color="text-accent" />
        <StatusCard title="Ambiente" value="Lovable Cloud" icon={Server} color="text-muted-foreground" />
      </div>

      <Tabs defaultValue="db">
        <TabsList>
          <TabsTrigger value="db">Banco de Dados</TabsTrigger>
          <TabsTrigger value="storage">Arquivos e Storage</TabsTrigger>
          <TabsTrigger value="performance">Desempenho</TabsTrigger>
        </TabsList>
        <TabsContent value="db" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Tabelas monitoradas</CardTitle></CardHeader>
            <CardContent>
              {stats?.database?.tables ? (
                <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">{JSON.stringify(stats.database.tables, null, 2)}</pre>
              ) : "Dados de banco não disponíveis."}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
