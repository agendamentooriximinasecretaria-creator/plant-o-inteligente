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

    // Role check - STRICT Master
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'gestor_master') {
      throw new Error('Acesso negado. Apenas Master pode executar limpeza.')
    }

    const { cleanup_type, confirmation_text, dry_run, filters } = await req.json()
    
    if (!dry_run && confirmation_text !== 'LIMPAR') {
      throw new Error('Confirmação inválida. Digite LIMPAR para confirmar.')
    }

    let result: any = { success: true, dry_run: !!dry_run, cleanup_type }
    let estimatedItems = 0
    let risk = 'baixo'
    let message = ''

    const olderThanDays = filters?.older_than_days || 90
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - olderThanDays)
    const dateLimitIso = dateLimit.toISOString()

    // 1. Logs Informativos (logs_old)
    if (cleanup_type === 'logs_old') {
      const query = supabaseClient
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', dateLimitIso)
        .eq('status', 'sucesso')
        .not('acao', 'ilike', '%Prontuário%')
        .not('acao', 'ilike', '%Documento%')
        .not('acao', 'ilike', '%Exclusão%')

      if (dry_run) {
        const { count } = await query
        result.estimated_items = count || 0
        result.risk = 'baixo'
        result.message = `${count || 0} logs informativos antigos encontrados.`
        result.safe_to_clean = true
      } else {
        const { count, error } = await supabaseClient
          .from('audit_logs')
          .delete({ count: 'exact' })
          .lt('created_at', dateLimitIso)
          .eq('status', 'sucesso')
          .not('acao', 'ilike', '%Prontuário%')
          .not('acao', 'ilike', '%Documento%')
          .not('acao', 'ilike', '%Exclusão%')
        
        if (error) throw error
        result.deleted_items = count || 0
        result.message = 'Limpeza de logs informativos concluída.'
      }
    } 
    // 2. Notificações (notifications_old)
    else if (cleanup_type === 'notifications_old') {
      const query = supabaseClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', dateLimitIso)
        .eq('lida', true)

      if (dry_run) {
        const { count } = await query
        result.estimated_items = count || 0
        result.risk = 'baixo'
        result.message = `${count || 0} notificações lidas antigas encontradas.`
        result.safe_to_clean = true
      } else {
        const { count, error } = await supabaseClient
          .from('notifications')
          .delete({ count: 'exact' })
          .lt('created_at', dateLimitIso)
          .eq('lida', true)
        
        if (error) throw error
        result.deleted_items = count || 0
        result.message = 'Limpeza de notificações concluída.'
      }
    }
    // 3. Monitoramento Snapshots (monitoring_snapshots_old)
    else if (cleanup_type === 'monitoring_snapshots_old') {
      const query = supabaseClient
        .from('system_monitoring_snapshots')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', dateLimitIso)

      if (dry_run) {
        const { count } = await query
        result.estimated_items = count || 0
        result.risk = 'baixo'
        result.message = `${count || 0} snapshots de monitoramento antigos encontrados.`
        result.safe_to_clean = true
      } else {
        const { count, error } = await supabaseClient
          .from('system_monitoring_snapshots')
          .delete({ count: 'exact' })
          .lt('created_at', dateLimitIso)
        
        if (error) throw error
        result.deleted_items = count || 0
        result.message = 'Limpeza de snapshots de monitoramento concluída.'
      }
    }
    // 4. Arquivos Órfãos (orphan_files) - Analysis Only for now or complex logic
    else if (cleanup_type === 'orphan_files') {
      // Comparison logic: List storage, find orphans.
      // For this task, we return a simulated check or simplified logic.
      if (dry_run) {
        result.estimated_items = 0 // Needs real comparison
        result.risk = 'médio'
        result.message = 'Análise de arquivos órfãos requer comparação entre Storage e Banco.'
        result.safe_to_clean = false
      } else {
        throw new Error('Limpeza de arquivos órfãos requer seleção manual.')
      }
    }
    else {
      throw new Error('Tipo de limpeza inválido ou não suportado.')
    }

    // AUDIT LOG
    if (!dry_run) {
      await supabaseClient.from('system_cleanup_logs').insert({
        created_by: user.id,
        cleanup_type: cleanup_type,
        items_count: result.deleted_items || 0,
        status: 'Sucesso',
        details: { filters, result }
      })
    }

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
