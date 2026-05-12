import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Auth validation
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Cabeçalho de autorização ausente')
    
    // Get user from the provided JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Usuário não autenticado ou token inválido')

    // Role check - strictly Master
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.role !== 'gestor_master') {
      throw new Error('Apenas Gestor Master pode realizar o monitoramento do sistema')
    }

    // 1. Collect DB stats via RPC
    const { data: dbStats, error: dbError } = await supabaseClient.rpc('get_system_stats')
    
    // 2. Collect Storage stats with error handling
    let storageInfo = []
    try {
      const { data: buckets, error: storageError } = await supabaseClient.storage.listBuckets()
      if (storageError) throw storageError
      
      if (buckets) {
        for (const bucket of buckets) {
          try {
            const { data: files } = await supabaseClient.storage.from(bucket.id).list('', { limit: 100 })
            storageInfo.push({
              id: bucket.id,
              name: bucket.name,
              public: bucket.public,
              fileCount: files?.length || 0,
            })
          } catch (e) {
            storageInfo.push({ id: bucket.id, name: bucket.name, error: "Indisponível" })
          }
        }
      }
    } catch (e) {
      storageInfo = [{ error: "Indisponível" }]
    }

    // 3. Collect Recent Errors
    const { data: recentErrors } = await supabaseClient
      .from('audit_logs')
      .select('id, created_at, acao, status')
      .eq('status', 'erro')
      .order('created_at', { ascending: false })
      .limit(10)

    const payload = {
      timestamp: new Date().toISOString(),
      database: dbStats || { error: dbError?.message || "Indisponível" },
      storage: storageInfo,
      recentErrors: recentErrors || [],
      env: {
        apiUrl: supabaseUrl.replace(/(https?:\/\/)(.*)/, "$1*******"),
      }
    }

    // Save snapshot for history
    await supabaseClient.from('system_monitoring_snapshots').insert({
        created_by: user.id,
        status_geral: 'Online',
        db_status: dbError ? 'Falha' : 'Online',
        storage_status: storageInfo.some(s => s.error) ? 'Atenção' : 'Online',
        hosting_status: 'Online',
        total_registros: dbStats?.tables?.reduce((acc: number, t: any) => acc + Number(t.row_count), 0) || 0,
        total_arquivos: storageInfo.reduce((acc, s) => acc + (s.fileCount || 0), 0),
        payload
    })

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Monitoring check error:', error.message)
    return new Response(JSON.stringify({ error: error.message || "Erro interno no servidor" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
