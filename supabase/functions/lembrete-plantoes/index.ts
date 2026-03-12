import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = getAdmin();

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Get all confirmed/agendado shifts for tomorrow
    const { data: shifts, error } = await admin
      .from("shifts")
      .select("id, data, hora_inicio, hora_fim, profissional_id, professionals:profissional_id(nome, email, user_id), sectors:setor_id(nome), units:unidade_id(nome)")
      .eq("data", tomorrowStr)
      .in("status", ["confirmado", "agendado"]);

    if (error) {
      console.error("Error fetching shifts:", error);
      return json(500, { error: error.message });
    }

    if (!shifts || shifts.length === 0) {
      return json(200, { success: true, message: "Nenhum plantão para amanhã.", count: 0 });
    }

    let sent = 0;
    for (const shift of shifts) {
      const prof = shift.professionals as any;
      if (!prof) continue;

      await admin.from("notifications").insert({
        professional_id: shift.profissional_id,
        user_id: prof.user_id || null,
        tipo: "lembrete",
        titulo: `⏰ Lembrete: plantão amanhã em ${(shift.sectors as any)?.nome || ""}`,
        mensagem: `Olá ${prof.nome}, seu plantão é amanhã (${new Date(tomorrowStr + "T12:00:00").toLocaleDateString("pt-BR")}) das ${shift.hora_inicio} às ${shift.hora_fim} em ${(shift.units as any)?.nome || ""} - ${(shift.sectors as any)?.nome || ""}.`,
        lida: false,
        canal: "sistema",
        status_envio: "enviado",
      });
      sent++;
    }

    return json(200, { success: true, count: sent });
  } catch (error) {
    console.error("lembrete-plantoes error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return json(500, { error: message });
  }
});
