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
      // _test might not exist, but we just want to see if we can connect
      const sOk = !sErr || sErr.code !== 'PGRST301'; // 301 is JWT error, others like 404 table not found mean connection ok

      const { data: dData, error: dErr } = await destClient.from('_test').select('*').limit(1).maybeSingle();
      const dOk = !dErr || dErr.code !== 'PGRST301';

      return new Response(JSON.stringify({ 
        source: { ok: sOk, error: sErr?.message },
        destination: { ok: dOk, error: dErr?.message }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'diagnostic') {
      const diagnosticResult: any = {
        source: { tables: [] },
        destination: { tables: [], isEmpty: true }
      };

      // Get tables from source using the new RPC
      const { data: tablesData, error: tErr } = await sourceClient.rpc('get_tables_info');
      
      if (!tErr && tablesData) {
        diagnosticResult.source.tables = tablesData.map((t: any) => ({ 
          name: t.table_name, 
          count: t.record_count 
        }));
      } else {
        // Fallback for diagnostic if RPC fails
        const tablesToTrack = [
          'professional_unavailability', 'professionals_safe', 'notifications', 
          'message_templates', 'audit_logs', 'profiles', 'document_signatures', 
          'shift_swaps', 'user_roles', 'setor_ocupacao', 'generated_documents', 
          'swap_attachments', 'censo_pacientes', 'units', 'historico_ocupacao', 
          'professional_documents', 'professionals', 'acionamentos_reforco', 
          'system_settings', 'shifts', 'shift_types', 'sectors', 
          'professional_stamps', 'document_templates', 'swap_history'
        ];
        for (const table of tablesToTrack) {
          const { count, error } = await sourceClient.from(table).select('*', { count: 'exact', head: true });
          if (!error) {
            diagnosticResult.source.tables.push({ name: table, count: count || 0 });
          }
        }
      }

      // Check destination tables
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
      const { data: tablesData, error: tErr } = await sourceClient.rpc('get_tables_info');
      if (tErr) throw tErr;

      let fullSql = `-- MIGRAÇÃO DE SCHEMA\n-- Gerado em: ${new Date().toISOString()}\n\n`;
      fullSql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pg_net";\n\n`;

      for (const table of tablesData) {
        const { data: ddl, error: ddlErr } = await sourceClient.rpc('get_table_ddl', { target_table: table.table_name });
        if (!ddlErr && ddl) {
          fullSql += `-- Tabela: ${table.table_name}\n${ddl}\n\n`;
        }
      }

      return new Response(JSON.stringify({ sql: fullSql }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

      return new Response(JSON.stringify(diagnosticResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-table-data') {
      const { table } = await req.json();
      if (!table) throw new Error("Nome da tabela é obrigatório.");

      let totalMigrated = 0;
      let lastId = null;
      const batchSize = 100;

      // We need to know the primary key to paginate correctly. 
      // For now we assume 'id' or we'll need to fetch it.
      // Most tables here use 'id'.
      
      while (true) {
        let query = sourceClient.from(table).select('*').order('id', { ascending: true }).limit(batchSize);
        if (lastId) {
          query = query.gt('id', lastId);
        }

        const { data: rows, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;
        if (!rows || rows.length === 0) break;

        const { error: insertErr } = await destClient.from(table).insert(rows);
        if (insertErr) {
          // If insert fails, maybe it's because of existing data or FK issues
          // We could try to upsert if the user wants, but the requirement is to migrate.
          throw insertErr;
        }

        totalMigrated += rows.length;
        lastId = rows[rows.length - 1].id;
        
        if (rows.length < batchSize) break;
      }

      return new Response(JSON.stringify({ table, totalMigrated, success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate-auth') {
      // Supabase Auth Admin API
      const { data: { users }, error: listErr } = await sourceClient.auth.admin.listUsers();
      if (listErr) throw listErr;

      const results = [];
      for (const user of users) {
        const { data: newUser, error: createErr } = await destClient.auth.admin.createUser({
          id: user.id, // Preserving UUID
          email: user.email,
          email_confirm: true,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata,
          // Password cannot be migrated easily, so we set a random one and user must reset
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
        // Create bucket in destination
        await destClient.storage.createBucket(bucket.id, { public: bucket.public });
        
        // List files (recursively would be better, but listFiles is flat-ish)
        // We'll need a recursive helper
        const migratePath = async (path: string = "") => {
          const { data: files, error: fErr } = await sourceClient.storage.from(bucket.id).list(path);
          if (fErr) return;

          for (const file of files) {
            const fullPath = path ? `${path}/${file.name}` : file.name;
            if (file.id === null) { 
              // It's a directory (usually indicated by id null in list)
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
