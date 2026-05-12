import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

// Helper to identify TLS/SSL related errors
function isTLSError(error: any): boolean {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("invalid peer certificate") || 
    msg.includes("unknownissuer") || 
    msg.includes("handshakefailure") ||
    msg.includes("expired") ||
    msg.includes("cert")
  );
}

// Helper to create a dedicated client for migration tasks
async function getClient(config: SupabaseConfig) {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Não autorizado: Cabeçalho de autenticação ausente.");

    // Internal client to verify the requester's identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const internalClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const { data: { user }, error: authError } = await internalClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error("Sessão inválida ou expirada.");

    // RBAC: Check if user is gestor_master
    const { data: profile, error: profileError } = await internalClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || profile?.role !== 'gestor_master') {
      console.error(`Acesso negado para usuário ${user.id}: Role ${profile?.role}`);
      throw new Error("Apenas Gestor Master tem permissão para realizar migrações de infraestrutura.");
    }

    // Parse request body
    const body = await req.json();
    const { action, source, destination, table } = body;

    // Strict validation of source/destination credentials
    if (!source?.url || !source?.serviceRoleKey || !destination?.url || !destination?.serviceRoleKey) {
      throw new Error("Credenciais de origem e destino (URL e Service Role Key) são obrigatórias.");
    }

    // Prevent cross-talk or security leaks by ensuring keys are treated as sensitive
    const sourceClient = await getClient(source);
    const destClient = await getClient(destination);

    // --- ACTIONS ---

    if (action === 'test-connections') {
      console.log(`[ACTION] test-connections requested by ${user.id}`);
      
      const testConnection = async (client: any) => {
        try {
          // Attempt a simple query. For self-hosted, we use the health-check approach.
          const { error } = await client.from('profiles').select('count', { count: 'exact', head: true }).limit(1);
          
          if (error) {
            // PGRST301 (JWT expired/invalid) or PGRST107 (Schema not found) mean connection failed.
            // 42P01 (relation does not exist) is actually OK for destination connection test if schema is empty.
            if (error.code === '42P01') return { ok: true, error: null };
            
            // PGRST301 means the service role key is invalid or not correctly mapped in the JWT secret of the self-hosted instance
            return { ok: false, error: `${error.code}: ${error.message}`, type: 'api_error' };
          }
          return { ok: true, error: null };
        } catch (e: any) {
          // Deno client error (network/TLS)
          const errorMessage = e.message || String(e);
          if (isTLSError(e)) {
            return { ok: false, error: errorMessage, type: 'tls_error' };
          }
          return { ok: false, error: errorMessage, type: 'connection_error' };
        }
      };

      const sourceResult = await testConnection(sourceClient);
      const destResult = await testConnection(destClient);

      return new Response(JSON.stringify({ 
        source: sourceResult,
        destination: destResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'diagnostic') {
      console.log(`[ACTION] diagnostic requested by ${user.id}`);
      const result: any = {
        source: { tables: [], usersCount: 0, storageBuckets: [] },
        destination: { tables: [], isEmpty: true }
      };

      // 1. Get source tables info via RPC
      const { data: tablesData, error: tErr } = await sourceClient.rpc('get_tables_info');
      if (!tErr && tablesData) {
        result.source.tables = tablesData.map((t: any) => ({ 
          name: String(t.table_name), 
          count: Number(t.record_count) 
        }));
      }

      // 2. Get source users count
      const { data: { users }, error: uErr } = await sourceClient.auth.admin.listUsers();
      if (!uErr) result.source.usersCount = users.length;

      // 3. Get source storage info
      const { data: buckets, error: bErr } = await sourceClient.storage.listBuckets();
      if (!bErr && buckets) {
        result.source.storageBuckets = buckets.map(b => ({ id: b.id, public: b.public }));
      }

      // 4. Check destination state
      const { data: dTables } = await destClient.rpc('get_tables_info');
      if (dTables && dTables.length > 0) {
        result.destination.isEmpty = false;
        result.destination.tables = dTables.map((t: any) => ({ name: t.table_name }));
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate-sql') {
      console.log(`[ACTION] generate-sql requested by ${user.id}`);
      const { data: tablesData, error: tErr } = await sourceClient.rpc('get_tables_info');
      if (tErr) throw new Error(`Erro ao listar tabelas: ${tErr.message}`);

      let fullSql = `-- ESTRUTURA DE BANCO DE DADOS (SCHEMA)\n-- Gerado automaticamente em: ${new Date().toLocaleString('pt-BR')}\n\n`;
      fullSql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pg_net";\n\n`;

      if (tablesData) {
        for (const t of tablesData) {
          const { data: ddl, error: ddlErr } = await sourceClient.rpc('get_table_ddl', { target_table: t.table_name });
          if (!ddlErr && ddl) {
            fullSql += `-- Tabela: ${t.table_name}\n${ddl}\n\n`;
          } else {
            fullSql += `-- Tabela: ${t.table_name}\n-- [Erro ao extrair DDL: ${ddlErr?.message || 'vazio'}]\n\n`;
          }
        }
      }

      return new Response(JSON.stringify({ sql: fullSql }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-table-data') {
      if (!table) throw new Error("Ação 'migrate-table-data' exige o nome da tabela.");
      console.log(`[ACTION] migrate-table-data for ${table} requested by ${user.id}`);

      let totalMigrated = 0;
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        // Fetch batch from source
        let query = sourceClient.from(table).select('*').range(offset, offset + batchSize - 1);
        
        // Use stable sorting if columns exist
        query = query.order('id', { ascending: true }).order('created_at', { ascending: true, nullsFirst: true });

        const { data: rows, error: fetchErr } = await query;
        
        if (fetchErr) {
          // Fallback if sorting columns are missing
          const { data: fallbackRows, error: fallbackErr } = await sourceClient
            .from(table)
            .select('*')
            .range(offset, offset + batchSize - 1);
          
          if (fallbackErr) throw fallbackErr;
          if (!fallbackRows || fallbackRows.length === 0) break;
          
          const { error: insertErr } = await destClient.from(table).upsert(fallbackRows);
          if (insertErr) throw insertErr;
          totalMigrated += fallbackRows.length;
          if (fallbackRows.length < batchSize) break;
        } else {
          if (!rows || rows.length === 0) break;
          const { error: insertErr } = await destClient.from(table).upsert(rows);
          if (insertErr) throw insertErr;
          totalMigrated += rows.length;
          if (rows.length < batchSize) break;
        }
        
        offset += batchSize;
      }

      return new Response(JSON.stringify({ table, totalMigrated, success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-auth') {
      console.log(`[ACTION] migrate-auth requested by ${user.id}`);
      let page = 1;
      const results = [];
      
      while (true) {
        const { data: { users }, error: listErr } = await sourceClient.auth.admin.listUsers({
          page,
          perPage: 50
        });
        
        if (listErr) throw listErr;
        if (!users || users.length === 0) break;

        for (const userEntry of users) {
          // Attempt to recreate user with EXACT ID to maintain relations
          const { error: createErr } = await destClient.auth.admin.createUser({
            id: userEntry.id,
            email: userEntry.email,
            email_confirm: true,
            user_metadata: userEntry.user_metadata,
            app_metadata: userEntry.app_metadata,
            // Passwords cannot be migrated via API, generating random temp password
            password: Math.random().toString(36).slice(-12) + "!", 
          });
          
          results.push({ 
            email: userEntry.email, 
            success: !createErr || createErr.message.includes('already exists'), 
            error: createErr?.message 
          });
        }
        
        if (users.length < 50) break;
        page++;
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-storage') {
      console.log(`[ACTION] migrate-storage requested by ${user.id}`);
      const { data: buckets, error: bErr } = await sourceClient.storage.listBuckets();
      if (bErr) throw bErr;

      const results = [];
      for (const bucket of buckets) {
        // Ensure bucket exists in destination
        await destClient.storage.createBucket(bucket.id, { public: bucket.public });
        
        const migratePath = async (path: string = "") => {
          const { data: items, error: fErr } = await sourceClient.storage.from(bucket.id).list(path);
          if (fErr) return;

          for (const item of items) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            
            if (!item.id) { // Directory
              await migratePath(fullPath);
            } else { // File
              const { data: blob, error: dErr } = await sourceClient.storage.from(bucket.id).download(fullPath);
              if (dErr) {
                console.warn(`[Storage] Erro ao baixar ${fullPath} do bucket ${bucket.id}`);
                continue;
              }
              const { error: uErr } = await destClient.storage.from(bucket.id).upload(fullPath, blob, { upsert: true });
              if (uErr) console.warn(`[Storage] Erro ao enviar ${fullPath} para destino: ${uErr.message}`);
            }
          }
        };

        await migratePath();
        results.push({ bucket: bucket.id, success: true });
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Ação '${action}' não reconhecida pelo servidor.`);

  } catch (error) {
    console.error(`[MIGRATION_ERROR] ${error.message}`);
    
    let errorType = 'internal_error';
    let errorMessage = error.message;

    if (isTLSError(error)) {
      errorType = 'tls_error';
      errorMessage = `Erro de Certificado TLS: O servidor de destino possui um certificado inválido ou não confiável (${error.message}). A migração exige HTTPS válido para produção.`;
    }

    return new Response(JSON.stringify({ 
      error: errorMessage,
      type: errorType,
      timestamp: new Date().toISOString(),
      details: errorType === 'tls_error' 
        ? "O endpoint HTTPS do destino está com certificado não confiável (Self-signed, expirado ou cadeia incompleta)."
        : "Verifique as credenciais e a conectividade de rede."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})