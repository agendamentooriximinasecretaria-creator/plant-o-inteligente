import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
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
    const { action, source, destination } = await req.json()

    if (!source?.url || !source?.serviceRoleKey || !destination?.url || !destination?.serviceRoleKey) {
      throw new Error("Credenciais de origem e destino são obrigatórias.");
    }

    const sourceClient = await getClient(source);
    const destClient = await getClient(destination);

    if (action === 'test-connections') {
      const { data: sData, error: sErr } = await sourceClient.from('_test').select('*').limit(1).maybeSingle();
      const sOk = !sErr || sErr.code !== 'PGRST301';

      const { data: dData, error: dErr } = await destClient.from('_test').select('*').limit(1).maybeSingle();
      const dOk = !dErr || dErr.code !== 'PGRST301';

      return new Response(JSON.stringify({ 
        source: { ok: sOk, error: sErr?.message },
        destination: { ok: dOk, error: dErr?.message }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tablesToTrack = [
      'units', 'sectors', 'profiles', 'message_templates', 'document_templates',
      'shift_types', 'professionals', 'professionals_safe', 'professional_stamps',
      'professional_documents', 'shifts', 'shift_swaps', 'swap_history',
      'swap_attachments', 'audit_logs', 'notifications', 'user_roles',
      'setor_ocupacao', 'generated_documents', 'censo_pacientes',
      'historico_ocupacao', 'professional_unavailability', 'document_signatures',
      'acionamentos_reforco', 'system_settings'
    ];

    if (action === 'diagnostic') {
      const diagnosticResult: any = {
        source: { tables: [] },
        destination: { tables: [], isEmpty: true }
      };

      const { data: tablesData, error: tErr } = await sourceClient.rpc('get_tables_info');
      
      if (!tErr && tablesData) {
        // We use the returned list but order it according to our tracking list if possible
        const returnedTables = tablesData.map((t: any) => t.table_name);
        for (const tableName of tablesToTrack) {
          if (returnedTables.includes(tableName)) {
            const t = tablesData.find((x: any) => x.table_name === tableName);
            diagnosticResult.source.tables.push({ name: tableName, count: t.record_count });
          }
        }
        // Add any other tables not in our priority list
        for (const t of tablesData) {
          if (!tablesToTrack.includes(t.table_name)) {
            diagnosticResult.source.tables.push({ name: t.table_name, count: t.record_count });
          }
        }
      } else {
        for (const table of tablesToTrack) {
          const { count, error } = await sourceClient.from(table).select('*', { count: 'exact', head: true });
          if (!error) {
            diagnosticResult.source.tables.push({ name: table, count: count || 0 });
          }
        }
      }

      for (const table of diagnosticResult.source.tables) {
        const { error } = await destClient.from(table.name).select('*', { count: 'exact', head: true });
        if (!error) {
          diagnosticResult.destination.isEmpty = false;
          diagnosticResult.destination.tables.push({ name: table.name });
        }
      }

      return new Response(JSON.stringify(diagnosticResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate-sql') {
      let fullSql = `-- MIGRAÇÃO DE SCHEMA\n-- Gerado em: ${new Date().toISOString()}\n\n`;
      fullSql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pg_net";\n\n`;

      for (const tableName of tablesToTrack) {
        const { data: ddl, error: ddlErr } = await sourceClient.rpc('get_table_ddl', { target_table: tableName });
        if (!ddlErr && ddl) {
          fullSql += `-- Tabela: ${tableName}\n${ddl}\n\n`;
        }
      }

      return new Response(JSON.stringify({ sql: fullSql }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-table-data') {
      const { table } = await req.json();
      if (!table) throw new Error("Nome da tabela é obrigatório.");

      let totalMigrated = 0;
      let lastId = null;
      const batchSize = 100;

      while (true) {
        // Try to order by id, but fallback to ordering by first column if id doesn't exist
        let query = sourceClient.from(table).select('*').limit(batchSize);
        
        // Some tables might not have 'id'. We could detect PK but for now we try id.
        try {
          query = query.order('id', { ascending: true });
          if (lastId) query = query.gt('id', lastId);
        } catch (e) {
          // If no id, we might have duplicates if we don't have a unique column to paginate
        }

        const { data: rows, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;
        if (!rows || rows.length === 0) break;

        const { error: insertErr } = await destClient.from(table).insert(rows);
        if (insertErr) throw insertErr;

        totalMigrated += rows.length;
        if (rows[rows.length - 1].id) {
          lastId = rows[rows.length - 1].id;
        } else {
          // Can't paginate safely without id, break after first batch to avoid infinite loop
          if (rows.length === batchSize) {
             throw new Error(`Tabela ${table} não possui coluna 'id' para paginação segura.`);
          }
          break;
        }
        
        if (rows.length < batchSize) break;
      }

      return new Response(JSON.stringify({ table, totalMigrated, success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-auth') {
      const { data: { users }, error: listErr } = await sourceClient.auth.admin.listUsers();
      if (listErr) throw listErr;

      const results = [];
      for (const user of users) {
        const { data: newUser, error: createErr } = await destClient.auth.admin.createUser({
          id: user.id,
          email: user.email,
          email_confirm: true,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata,
          password: Math.random().toString(36).slice(-12), 
        });
        
        results.push({ email: user.email, success: !createErr, error: createErr?.message });
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
        await destClient.storage.createBucket(bucket.id, { public: bucket.public });
        
        const migratePath = async (path: string = "") => {
          const { data: files, error: fErr } = await sourceClient.storage.from(bucket.id).list(path);
          if (fErr) return;

          for (const file of files) {
            const fullPath = path ? `${path}/${file.name}` : file.name;
            if (file.id === null) { 
              await migratePath(fullPath);
            } else {
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
