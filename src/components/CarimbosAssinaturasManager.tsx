import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileSignature, Lock, CheckCircle2, Search, Stamp } from "lucide-react";
import CarimboAssinaturaProfissional from "@/components/CarimboAssinaturaProfissional";

/**
 * Painel de Assinaturas e Carimbos — visível para Gestor Master.
 * Lista profissionais com status do carimbo e permite abrir/editar
 * o carimbo de qualquer um, reaproveitando o componente
 * CarimboAssinaturaProfissional.
 */
export default function CarimbosAssinaturasManager() {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stamps-overview"],
    queryFn: async () => {
      const { data: profs } = await supabase
        .from("professionals")
        .select("id,nome,profissao,unidade_principal_id,setor_principal_id,status")
        .eq("status", "ativo")
        .order("nome");
      const ids = (profs || []).map(p => p.id);
      if (!ids.length) return [] as any[];
      const sb = supabase as any;
      const { data: stamps } = await sb
        .from("professional_stamps")
        .select("profissional_id,tipo,bloqueado,assinatura_path,carimbo_path,updated_at")
        .in("profissional_id", ids);
      const map = new Map((stamps || []).map((s: any) => [s.profissional_id, s]));
      return (profs || []).map(p => ({ ...p, stamp: map.get(p.id) || null }));
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r: any) => (r.nome || "").toLowerCase().includes(t) || (r.profissao || "").toLowerCase().includes(t));
  }, [rows, q]);

  const tipoLabel: Record<string, string> = {
    digital_gerado: "Digital gerado",
    imagem_carimbo: "Carimbo físico",
    assinatura_manuscrita: "Assinatura manuscrita",
    eletronica_interna: "Eletrônica interna",
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10"><FileSignature className="h-5 w-5 text-primary" /></div>
        <div className="flex-1">
          <h3 className="font-display font-semibold text-foreground">Assinaturas e Carimbos</h3>
          <p className="text-sm text-muted-foreground">Gerencie carimbos e assinaturas de todos os profissionais. Apenas Gestor Master.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar profissional…" className="pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Profissional</th>
                <th className="text-left px-3 py-2">Profissão</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{r.nome}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.profissao}</td>
                  <td className="px-3 py-2">
                    {r.stamp ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] px-2 py-0.5">
                        <Stamp className="h-3 w-3" /> {tipoLabel[r.stamp.tipo] || "Configurado"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Não configurado</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.stamp?.bloqueado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[11px] px-2 py-0.5"><Lock className="h-3 w-3" /> Bloqueado</span>
                    ) : r.stamp ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success text-[11px] px-2 py-0.5"><CheckCircle2 className="h-3 w-3" /> Ativo</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setOpenId(r.id)} className="text-xs font-medium text-primary hover:underline">Gerenciar</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum profissional encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4" onClick={() => setOpenId(null)}>
          <div className="w-full max-w-4xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setOpenId(null)} className="rounded-lg bg-background border border-border px-3 py-1.5 text-sm">Fechar</button>
            </div>
            <CarimboAssinaturaProfissional profissionalId={openId} isMaster />
          </div>
        </div>
      )}
    </div>
  );
}
