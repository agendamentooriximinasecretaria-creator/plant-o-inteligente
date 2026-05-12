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
    if (!authHeader) throw new Error('Não autorizado')
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Não autorizado')

    // Role check
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'gestor_master') {
      throw new Error('Acesso negado: Apenas Gestor Master pode executar limpeza')
    }

    const { type, payload } = await req.json()
    if (!type) throw new Error('Tipo de limpeza não informado')

    let result = { success: false, items_count: 0 }

    // SAFE CLEANUP LOGIC
    if (type === 'logs') {
      const days = payload?.days || 90
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - days)
      
      const { count, error } = await supabaseClient
        .from('audit_logs')
        .delete({ count: 'exact' })
        .lt('created_at', dateLimit.toISOString())
        .not('acao', 'ilike', '%Prontuário%') // Safety: Never delete patient record changes
        .not('acao', 'ilike', '%Documento%') // Safety: Keep document related logs
        .eq('status', 'sucesso') // Only delete successful logs, keep errors for auditing

      if (error) throw error
      result = { success: true, items_count: count || 0 }
    } else if (type === 'notifications') {
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - 30)
      
      const { count, error } = await supabaseClient
        .from('notifications')
        .delete({ count: 'exact' })
        .lt('created_at', dateLimit.toISOString())
        .eq('lida', true) // Only delete read notifications

      if (error) throw error
      result = { success: true, items_count: count || 0 }
    } else {
      throw new Error('Tipo de limpeza inválido ou não suportado')
    }

    // Audit the cleanup with full details
    await supabaseClient.from('system_cleanup_logs').insert({
        created_by: user.id,
        cleanup_type: type,
        items_count: result.items_count,
        status: 'Sucesso',
        details: {
          requested_at: new Date().toISOString(),
          payload,
          client_info: req.headers.get('x-client-info')
        }
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Cleanup execute error:', error.message)
    return new Response(JSON.stringify({ error: error.message || "Erro ao executar limpeza" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
