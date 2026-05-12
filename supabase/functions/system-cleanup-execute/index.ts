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
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') || '')
    if (!user) throw new Error('Não autorizado')

    // Role check
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'gestor_master') throw new Error('Acesso negado')

    const { type, payload } = await req.json()

    let result = { success: false, items_count: 0 }

    if (type === 'logs') {
      const days = payload.days || 90
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - days)
      
      const { count, error } = await supabaseClient
        .from('audit_logs')
        .delete({ count: 'exact' })
        .lt('created_at', dateLimit.toISOString())
        .neq('acao', 'Alteração de Prontuário') // Security: Don't delete critical logs

      if (error) throw error
      result = { success: true, items_count: count || 0 }
    } else if (type === 'notifications') {
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - 30)
      
      const { count, error } = await supabaseClient
        .from('notifications')
        .delete({ count: 'exact' })
        .lt('created_at', dateLimit.toISOString())
        .eq('lida', true)

      if (error) throw error
      result = { success: true, items_count: count || 0 }
    }

    // Audit the cleanup
    await supabaseClient.from('system_cleanup_logs').insert({
        created_by: user.id,
        cleanup_type: type,
        items_count: result.items_count,
        status: 'Sucesso',
        details: payload
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
