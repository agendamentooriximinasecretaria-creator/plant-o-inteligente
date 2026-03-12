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
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getUserClient(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!anonKey) throw new Error("Missing anon key");
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getCaller(authHeader?: string | null) {
  if (!authHeader) return { user: null, error: "missing_auth" } as const;
  const userClient = getUserClient(authHeader);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { user: null, error: "invalid_auth" } as const;
  return { user, error: null } as const;
}

async function isMaster(admin: ReturnType<typeof getAdmin>, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "gestor_master")
    .maybeSingle();
  return !!data;
}

async function writeAudit(admin: ReturnType<typeof getAdmin>, userId: string, usuarioNome: string, acao: string, modulo: string, detalhes: Record<string, unknown>, status = "sucesso") {
  await admin.from("audit_logs").insert({ user_id: userId, usuario_nome: usuarioNome, acao, modulo, status, detalhes });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = getAdmin();
    const authHeader = req.headers.get("Authorization");
    const callerResult = await getCaller(authHeader);

    if (!callerResult.user) return json(401, { error: "Usuário não autenticado." });

    const caller = callerResult.user;
    const payload = await req.json();
    const action = payload?.action as string | undefined;

    if (!action) return json(400, { error: "Ação não informada." });

    // --- update_my_profile (any authenticated user) ---
    if (action === "update_my_profile") {
      const telefone = String(payload?.telefone ?? "").trim();
      const endereco = String(payload?.endereco ?? "").trim();

      const { data: professional, error: profError } = await admin
        .from("professionals").select("id").eq("user_id", caller.id).maybeSingle();

      if (profError || !professional) return json(404, { error: "Profissional não encontrado para este usuário." });

      const { error: updateError } = await admin
        .from("professionals")
        .update({ telefone: telefone || null, endereco: endereco || null })
        .eq("id", professional.id);

      if (updateError) return json(400, { error: updateError.message });

      await writeAudit(admin, caller.id, caller.email ?? "Usuário", "Perfil profissional atualizado", "perfil", { professional_id: professional.id });
      return json(200, { success: true });
    }

    // --- All actions below require gestor_master ---
    const callerIsMaster = await isMaster(admin, caller.id);
    if (!callerIsMaster) return json(403, { error: "Apenas Gestor Master pode executar esta ação." });

    // --- create_user ---
    if (action === "create_user") {
      const nome = String(payload?.nome ?? "").trim();
      const email = String(payload?.email ?? "").trim().toLowerCase();
      const password = String(payload?.password ?? "");
      const role = String(payload?.role ?? "");
      const profissionalId = payload?.professional_id ? String(payload.professional_id) : null;

      if (!nome || !email || !password || !role) return json(400, { error: "Nome, e-mail, senha e perfil são obrigatórios." });
      if (password.length < 8) return json(400, { error: "Senha inicial deve ter no mínimo 8 caracteres." });
      if (!["gestor_master", "coordenador", "profissional"].includes(role)) return json(400, { error: "Perfil inválido." });
      if (role === "profissional" && !profissionalId) return json(400, { error: "Selecione um profissional para vincular o usuário." });

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nome },
      });

      if (createError || !created.user) return json(400, { error: createError?.message ?? "Erro ao criar usuário." });

      const newUserId = created.user.id;

      const { error: roleError } = await admin.from("user_roles").insert({ user_id: newUserId, role });
      if (roleError) {
        await admin.auth.admin.deleteUser(newUserId);
        return json(400, { error: roleError.message });
      }

      const { error: profileError } = await admin.from("profiles").insert({
        user_id: newUserId, nome, email, role, profissional_id: profissionalId, ativo: true,
      });

      if (profileError) {
        await admin.from("user_roles").delete().eq("user_id", newUserId);
        await admin.auth.admin.deleteUser(newUserId);
        return json(400, { error: profileError.message });
      }

      if (profissionalId) {
        const { error: bindError } = await admin.from("professionals").update({ user_id: newUserId, email }).eq("id", profissionalId);
        if (bindError) {
          await admin.from("profiles").delete().eq("user_id", newUserId);
          await admin.from("user_roles").delete().eq("user_id", newUserId);
          await admin.auth.admin.deleteUser(newUserId);
          return json(400, { error: bindError.message });
        }
      }

      await writeAudit(admin, caller.id, caller.email ?? "Gestor Master", "Usuário criado", "usuarios", {
        created_user_id: newUserId, created_email: email, role,
      });

      // Dispatch welcome notification
      await admin.from("notifications").insert({
        professional_id: profissionalId || null,
        user_id: newUserId,
        tipo: "boas_vindas",
        titulo: "👋 Bem-vindo ao GestorPlantão SMS Oriximiná",
        mensagem: `Olá ${nome}, sua conta foi criada com o perfil ${role === "gestor_master" ? "Gestor Master" : role === "coordenador" ? "Coordenador" : "Profissional de Saúde"}. Acesse o sistema com seu e-mail ${email}.`,
        lida: false,
        canal: "sistema",
        status_envio: "enviado",
      });

      return json(200, { success: true, user_id: newUserId });
    }

    // --- reset_password ---
    if (action === "reset_password") {
      const userId = String(payload?.user_id ?? "");
      const newPassword = String(payload?.new_password ?? "");
      if (!userId || !newPassword) return json(400, { error: "Usuário e nova senha são obrigatórios." });
      if (newPassword.length < 8) return json(400, { error: "Nova senha deve ter no mínimo 8 caracteres." });

      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return json(400, { error: error.message });

      await writeAudit(admin, caller.id, caller.email ?? "Gestor Master", "Senha redefinida por gestor", "usuarios", { target_user_id: userId });
      return json(200, { success: true });
    }

    // --- set_active ---
    if (action === "set_active") {
      const userId = String(payload?.user_id ?? "");
      const active = Boolean(payload?.active);
      if (!userId) return json(400, { error: "Usuário não informado." });

      const { error: authError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: active ? "none" : "876000h",
      });
      if (authError) return json(400, { error: authError.message });

      const { error: profileError } = await admin.from("profiles").update({ ativo: active }).eq("user_id", userId);
      if (profileError) return json(400, { error: profileError.message });

      await writeAudit(admin, caller.id, caller.email ?? "Gestor Master", active ? "Usuário ativado" : "Usuário inativado", "usuarios", { target_user_id: userId, active });
      return json(200, { success: true });
    }

    return json(400, { error: "Ação inválida." });
  } catch (error) {
    console.error("Edge function error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return json(500, { error: message });
  }
});
