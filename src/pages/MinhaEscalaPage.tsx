import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function MinhaEscalaPage() {
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["professional-my-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, hora_inicio, hora_fim, tipo_plantao, carga_horaria, valor_total, status, sectors:setor_id(nome), units:unidade_id(nome)")
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Minha Escala</h1>
        <p className="text-sm text-muted-foreground mt-1">Seus plantões vinculados ao seu perfil.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Unidade/Setor</th>
              <th className="p-3 text-left">Horário</th>
              <th className="p-3 text-left">Tipo</th>
              <th className="p-3 text-left">Carga</th>
              <th className="p-3 text-left">Valor</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum plantão encontrado.</td></tr>
            ) : (
              shifts.map((s: any) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 text-foreground">{new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-muted-foreground">{(s.units as any)?.nome || "—"} • {(s.sectors as any)?.nome || "—"}</td>
                  <td className="p-3 text-foreground">{s.hora_inicio} - {s.hora_fim}</td>
                  <td className="p-3 text-muted-foreground">{s.tipo_plantao}</td>
                  <td className="p-3 text-muted-foreground">{s.carga_horaria}h</td>
                  <td className="p-3 text-foreground font-medium">R$ {Number(s.valor_total).toLocaleString("pt-BR")}</td>
                  <td className="p-3"><span className="status-badge bg-primary/10 text-primary">{s.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
