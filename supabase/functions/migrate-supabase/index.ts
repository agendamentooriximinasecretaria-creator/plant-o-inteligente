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
      // 1. List tables
      const { data: tables, error: tablesErr } = await sourceClient.rpc('get_tables_info');
      // If RPC doesn't exist, we fallback to a direct query if possible or inform the user
      
      // Since we might not have the RPC, let's use a direct query to information_schema
      // But Supabase REST API doesn't expose information_schema directly.
      // We need a helper function in the DB or we use standard select on known tables.
      
      // A better way is to query the 'pg_catalog' or 'information_schema' via a custom function
      // that we'll ask the user to create or we try to run it if we have enough permissions.
      
      const diagnosticResult: any = {
        source: { tables: [] },
        destination: { tables: [], isEmpty: true }
      };

      // Try to get tables from source
      const { data: sourceTablesData, error: sourceTablesErr } = await sourceClient
        .from('pg_tables') // This might not work via PostgREST without specific setup
        .select('*')
        .eq('schemaname', 'public');
      
      // In Supabase, often we need to create a helper function to inspect the schema
      // Let's assume for now we'll fetch common tables we saw earlier
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
          diagnosticResult.source.tables.push({ name: table, count });
        }
      }

      // Check destination
      for (const table of tablesToTrack) {
        const { error } = await destClient.from(table).select('*', { count: 'exact', head: true });
        if (!error) {
          diagnosticResult.destination.isEmpty = false;
          diagnosticResult.destination.tables.push({ name: table });
        }
      }

      return new Response(JSON.stringify(diagnosticResult), {
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
