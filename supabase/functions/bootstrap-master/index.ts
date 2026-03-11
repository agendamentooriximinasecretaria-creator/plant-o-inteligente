import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { data: rolesCountData, error: countError } = await admin
      .from("user_roles")
      .select("id", { count: "exact", head: true });

    if (countError) return json(500, { error: countError.message });

    // Só roda quando a base ainda não foi inicializada
    if ((rolesCountData as unknown) !== null) {
      // noop to satisfy TS in Deno runtime
    }

    const { count } = await admin
      .from("user_roles")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) > 0) {
      return json(409, { error: "Sistema já inicializado. Bootstrap bloqueado." });
    }

    const email = "gestor@hospital.com";
    const password = "gestor123";

    const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) return json(500, { error: listError.message });

    const existing = usersPage.users.find((u) => (u.email ?? "").toLowerCase() === email);

    let userId = existing?.id;

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome: "Gestor Master" },
      });

      if (createError || !created.user) {
        return json(500, { error: createError?.message ?? "Erro ao criar usuário inicial." });
      }

      userId = created.user.id;
    } else {
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { nome: "Gestor Master" },
      });
    }

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: userId,
      role: "gestor_master",
    });

    if (roleError) return json(500, { error: roleError.message });

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      nome: "Gestor Master",
      email,
      role: "gestor_master",
      ativo: true,
    });

    if (profileError) return json(500, { error: profileError.message });

    await admin.from("audit_logs").insert({
      user_id: userId,
      usuario_nome: email,
      acao: "Bootstrap do Gestor Master inicial",
      modulo: "usuarios",
      status: "sucesso",
      detalhes: { email },
    });

    return json(200, {
      success: true,
      email,
      password,
      message: "Gestor Master inicial criado com sucesso.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return json(500, { error: message });
  }
});
