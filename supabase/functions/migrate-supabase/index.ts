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

async function getClient(config: SupabaseConfig) {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Não autorizado.");

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const internalClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify if the user is a gestor_master
    const { data: { user }, error: authError } = await internalClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error("Sessão inválida.");

    const { data: profile } = await internalClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.role !== 'gestor_master') {
      throw new Error("Apenas Gestor Master pode realizar migrações.");
    }

    const body = await req.json();
    const { action, source, destination, table } = body;

    if (!source?.url || !source?.serviceRoleKey || !destination?.url || !destination?.serviceRoleKey) {
      throw new Error("Credenciais de origem e destino são obrigatórias.");
    }

    const sourceClient = await getClient(source);
    const destClient = await getClient(destination);

    if (action === 'test-connections') {
      const { data: sData, error: sErr } = await sourceClient.from('profiles').select('count', { count: 'exact', head: true }).limit(1);
      const sOk = !sErr;

      const { data: dData, error: dErr } = await destClient.from('_non_existent_table_test').select('*').limit(1).maybeSingle();
      // If error is 404/PGRST116 it means connection worked but table doesn't exist, which is fine for destination
      const dOk = !dErr || (dErr.code !== 'PGRST301' && dErr.code !== '42P01');

      return new Response(JSON.stringify({ 
        source: { ok: sOk, error: sErr?.message },
        destination: { ok: dOk, error: dErr?.message }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'diagnostic') {
      const diagnosticResult: any = {
        source: { tables: [], usersCount: 0, storageBuckets: [] },
        destination: { tables: [], isEmpty: true }
      };

      // 1. Tables Info
      const { data: tablesData, error: tErr } = await sourceClient.rpc('get_tables_info');
      if (!tErr && tablesData) {
        diagnosticResult.source.tables = tablesData.map((t: any) => ({ name: t.table_name, count: t.record_count }));
      }

      // 2. Users Count
      const { data: { users }, error: uErr } = await sourceClient.auth.admin.listUsers();
      if (!uErr) diagnosticResult.source.usersCount = users.length; // Basic count, listUsers is limited

      // 3. Storage Info
      const { data: buckets, error: bErr } = await sourceClient.storage.listBuckets();
      if (!bErr && buckets) {
        diagnosticResult.source.storageBuckets = buckets.map(b => ({ id: b.id, public: b.public }));
      }

      // 4. Check Destination
      const { data: dTables } = await destClient.rpc('get_tables_info');
      if (dTables && dTables.length > 0) {
        diagnosticResult.destination.isEmpty = false;
        diagnosticResult.destination.tables = dTables.map((t: any) => ({ name: t.table_name }));
      }

      return new Response(JSON.stringify(diagnosticResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate-sql') {
      const { data: tablesData } = await sourceClient.rpc('get_tables_info');
      let fullSql = `-- MIGRAÇÃO DE SCHEMA\n-- Gerado em: ${new Date().toISOString()}\n\n`;
      fullSql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pg_net";\n\n`;

      if (tablesData) {
        for (const t of tablesData) {
          const { data: ddl } = await sourceClient.rpc('get_table_ddl', { target_table: t.table_name });
          if (ddl) {
            fullSql += `-- Tabela: ${t.table_name}\n${ddl}\n\n`;
          }
        }
      }

      return new Response(JSON.stringify({ sql: fullSql }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-table-data') {
      if (!table) throw new Error("Nome da tabela é obrigatório.");

      let totalMigrated = 0;
      let offset = 0;
      const batchSize = 500;

      while (true) {
        let query = sourceClient.from(table).select('*').range(offset, offset + batchSize - 1);
        
        // Try ordering by id or created_at for stable pagination
        query = query.order('id', { ascending: true }).order('created_at', { ascending: true, nullsFirst: true });

        const { data: rows, error: fetchErr } = await query;
        if (fetchErr) {
          // Fallback if id/created_at doesn't exist
          const { data: rowsFallback, error: fetchErr2 } = await sourceClient
            .from(table)
            .select('*')
            .range(offset, offset + batchSize - 1);
          
          if (fetchErr2) throw fetchErr2;
          if (!rowsFallback || rowsFallback.length === 0) break;
          
          const { error: insertErr } = await destClient.from(table).upsert(rowsFallback);
          if (insertErr) throw insertErr;
          totalMigrated += rowsFallback.length;
          if (rowsFallback.length < batchSize) break;
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
      let page = 1;
      const results = [];
      
      while (true) {
        const { data: { users }, error: listErr } = await sourceClient.auth.admin.listUsers({
          page,
          perPage: 50
        });
        
        if (listErr) throw listErr;
        if (!users || users.length === 0) break;

        for (const user of users) {
          // Attempt to create user with SAME ID
          const { error: createErr } = await destClient.auth.admin.createUser({
            id: user.id,
            email: user.email,
            email_confirm: true,
            user_metadata: user.user_metadata,
            app_metadata: user.app_metadata,
            password: Math.random().toString(36).slice(-12), 
          });
          
          results.push({ email: user.email, success: !createErr, error: createErr?.message });
        }
        
        if (users.length < 50) break;
        page++;
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-storage') {
      const { data: buckets, error: bErr } = await sourceClient.storage.listBuckets();
      if (bErr) throw bErr;

      const results = [];
      for (const bucket of buckets) {
        // Create bucket if not exists
        await destClient.storage.createBucket(bucket.id, { public: bucket.public });
        
        const migratePath = async (path: string = "") => {
          const { data: items, error: fErr } = await sourceClient.storage.from(bucket.id).list(path);
          if (fErr) return;

          for (const item of items) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            
            if (!item.id) { // It's a directory (id is null for folders in some versions/cases)
              // Recursive call for folders
              await migratePath(fullPath);
            } else {
              // It's a file
              const { data: blob, error: dErr } = await sourceClient.storage.from(bucket.id).download(fullPath);
              if (dErr) continue;
              await destClient.storage.from(bucket.id).upload(fullPath, blob, { upsert: true });
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

    throw new Error(`Ação desconhecida: ${action}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
