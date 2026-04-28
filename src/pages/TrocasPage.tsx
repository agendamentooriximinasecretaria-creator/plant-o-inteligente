import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCrossSwaps } from "@/lib/queryInvalidation";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { useAuth } from "@/hooks/useAuth";
import { SWAP_STATUS_LABELS } from "@/types/hospital";
import type { SwapStatus } from "@/types/hospital";
import {
  ArrowLeftRight, Clock, CheckCircle2, XCircle, AlertCircle, Plus, Zap, FileText, Filter,
  ChevronDown, Calendar as CalIcon, Search, X, Printer, Download, BellRing, Activity, History, Paperclip,
} from "lucide-react";
import { ContactActionButton } from "@/components/ContactActionButton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ComprovanteTroca from "@/components/ComprovanteTroca";
import SignActionButton from "@/components/SignActionButton";
import SwapAttachmentsSection from "@/components/SwapAttachmentsSection";
import { printSolicitacaoTroca } from "@/lib/printSolicitacaoTroca";
import { calcularHorasMes } from "@/lib/horas";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { CardListSkeleton } from "@/components/PageSkeleton";

const statusStyles: Record<SwapStatus, { class: string; icon: typeof Clock; ring: string }> = {
  solicitada: { class: 'bg-info/10 text-info border-info/20', icon: Clock, ring: 'ring-info/30' },
  aguardando_resposta: { class: 'bg-warning/10 text-warning border-warning/20', icon: Clock, ring: 'ring-warning/30' },
  aceita: { class: 'bg-success/10 text-success border-success/20', icon: CheckCircle2, ring: 'ring-success/30' },
  recusada: { class: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, ring: 'ring-destructive/30' },
  aguardando_aprovacao: { class: 'bg-warning/10 text-warning border-warning/20', icon: AlertCircle, ring: 'ring-warning/30' },
  aprovada: { class: 'bg-success/10 text-success border-success/20', icon: CheckCircle2, ring: 'ring-success/30' },
  rejeitada: { class: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, ring: 'ring-destructive/30' },
  cancelada: { class: 'bg-muted text-muted-foreground border-border', icon: XCircle, ring: 'ring-border' },
  concluida: { class: 'bg-accent/10 text-accent border-accent/20', icon: CheckCircle2, ring: 'ring-accent/30' },
};

type FilterStatus = 'todas' | 'pendentes' | 'aprovadas' | 'recusadas';

const norm = (s: any) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export default function TrocasPage() {
  const qc = useQueryClient();
  const { isMaster } = useAuth();
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [comprovanteId, setComprovanteId] = useState<string | null>(null);
  const [attachmentsSwapId, setAttachmentsSwapId] = useState<string | null>(null);
  const [reviewSwap, setReviewSwap] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'aprovar' | 'rejeitar' | null>(null);
  const [reviewMotivo, setReviewMotivo] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todas');
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [impactSwap, setImpactSwap] = useState<any | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  // Filtros avançados
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [fUnidade, setFUnidade] = useState<string>('');
  const [fSetor, setFSetor] = useState<string>('');
  const [fSolicitante, setFSolicitante] = useState<string>('');
  const [fSubstituto, setFSubstituto] = useState<string>('');
  const [fTipo, setFTipo] = useState<string>(''); // tipo_plantao do shift
  const [fDataIni, setFDataIni] = useState<string>('');
  const [fDataFim, setFDataFim] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const [adminForm, setAdminForm] = useState({ profA: '', shiftA: '', profB: '', shiftB: '', motivo: '' });

  const { data: swaps = [], isLoading, isError, refetch: refetchSwaps, isRefetching } = useQuery({
    queryKey: ['swaps'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_swaps')
        .select('*, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome), shifts:shift_id(data, hora_inicio, hora_fim, tipo_plantao, setor_id, unidade_id, sectors:setor_id(nome), units:unidade_id(nome)), shift_destino:shift_id_destino(data, hora_inicio, hora_fim, tipo_plantao, sectors:setor_id(nome), units:unidade_id(nome))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('swaps-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swaps' }, () => {
        refetchSwaps();
        qc.invalidateQueries({ queryKey: ['swap-histories'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchSwaps, qc]);

  const { data: swapHistories = [] } = useQuery({
    queryKey: ['swap-histories'],
    queryFn: async () => {
      const { data } = await supabase.from('swap_history').select('*').order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['swap-professionals'],
    queryFn: async () => {
      const { data } = await supabase.from('professionals_safe').select('id, nome, telefone').eq('status', 'ativo').order('nome');
      return data || [];
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ['swap-units'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ['swap-sectors'],
    queryFn: async () => {
      const { data } = await supabase.from('sectors').select('id, nome, unidade_id').order('nome');
      return data || [];
    },
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['swap-all-shifts'],
    enabled: isMaster,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('shifts')
        .select('id, data, hora_inicio, hora_fim, profissional_id, status, sectors:setor_id(nome)')
        .gte('data', today)
        .neq('status', 'cancelado')
        .order('data');
      return data || [];
    },
  });

  // Snapshot de horas mensais por profissional para análise de impacto
  const { data: monthShifts = [] } = useQuery({
    queryKey: ['swap-month-shifts'],
    queryFn: async () => {
      const ini = new Date(); ini.setDate(1);
      const fim = new Date(ini); fim.setMonth(fim.getMonth() + 1); fim.setDate(0);
      const iniStr = ini.toISOString().slice(0, 10);
      const fimStr = fim.toISOString().slice(0, 10);
      const { data } = await supabase.from('shifts')
        .select('id, profissional_id, setor_id, data, carga_horaria, status, tipo_plantao, faltou, hora_inicio, hora_fim')
        .gte('data', iniStr).lte('data', fimStr);
      return data || [];
    },
  });

  const shiftsForA = useMemo(() => adminForm.profA ? allShifts.filter((s: any) => s.profissional_id === adminForm.profA) : [], [allShifts, adminForm.profA]);
  const shiftsForB = useMemo(() => adminForm.profB ? allShifts.filter((s: any) => s.profissional_id === adminForm.profB) : [], [allShifts, adminForm.profB]);

  const efetivarTroca = async (trocaId: string) => {
    const { data: troca, error: fetchErr } = await supabase.from('shift_swaps').select('*').eq('id', trocaId).single();
    if (fetchErr || !troca) throw new Error('Troca não encontrada');

    if (troca.shift_id_destino) {
      const [updateA, updateB] = await Promise.all([
        supabase.from('shifts').update({ profissional_id: troca.destinatario_id, updated_at: new Date().toISOString() }).eq('id', troca.shift_id),
        supabase.from('shifts').update({ profissional_id: troca.solicitante_id, updated_at: new Date().toISOString() }).eq('id', troca.shift_id_destino),
      ]);
      if (updateA.error) throw new Error(`Erro plantão A: ${updateA.error.message}`);
      if (updateB.error) throw new Error(`Erro plantão B: ${updateB.error.message}`);
    } else {
      const { error } = await supabase.from('shifts')
        .update({ profissional_id: troca.destinatario_id, updated_at: new Date().toISOString() })
        .eq('id', troca.shift_id);
      if (error) throw new Error(`Erro ao efetivar: ${error.message}`);
    }

    await supabase.from('shift_swaps').update({ status: 'concluida' as any, aprovado_em: new Date().toISOString() }).eq('id', trocaId);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('swap_history').insert({
      swap_id: trocaId, acao: 'Troca efetivada na escala',
      usuario: user?.email || 'Sistema', user_id: user?.id,
    });
    await logAudit('Troca efetivada na escala', 'trocas', {
      swap_id: trocaId, shift_id: troca.shift_id, shift_id_destino: troca.shift_id_destino,
      solicitante_id: troca.solicitante_id, destinatario_id: troca.destinatario_id,
    });
  };

  const updateSwap = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: string; motivo?: string }) => {
      if (status === 'rejeitada' && (!motivo || motivo.trim().length < 5)) {
        throw new Error('Motivo da recusa é obrigatório (mín. 5 caracteres)');
      }
      const updatePayload: Record<string, any> = { status: status as any, observacao_gestor: motivo || null };
      if (status === 'aprovada') updatePayload.aprovado_em = new Date().toISOString();
      if (status === 'rejeitada') {
        updatePayload.rejeitado_em = new Date().toISOString();
        updatePayload.observacao_rejeicao = motivo || null;
      }
      const { error } = await supabase.from('shift_swaps').update(updatePayload as any).eq('id', id);
      if (error) throw error;

      if (status === 'aprovada') await efetivarTroca(id);

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('swap_history').insert({
        swap_id: id,
        acao: status === 'aprovada' ? 'Aprovada pelo gestor' : status === 'rejeitada' ? 'Rejeitada pelo gestor' : `Status alterado para ${status}`,
        usuario: user?.email || 'Gestor', user_id: user?.id, detalhes: motivo || null,
      });
      const swapCtx = swaps.find((s: any) => s.id === id);
      await logAudit(
        status === 'aprovada' ? 'Troca aprovada pelo gestor' : status === 'rejeitada' ? 'Troca recusada pelo gestor' : `Troca status alterado: ${status}`,
        'trocas',
        { swap_id: id, novo_status: status, motivo, shift_id: swapCtx?.shift_id, solicitante_id: swapCtx?.solicitante_id, destinatario_id: swapCtx?.destinatario_id },
      );
      const swap = swaps.find((s: any) => s.id === id);
      if (swap) {
        const titulo = status === 'aprovada' ? '✅ Troca aprovada e efetivada' : '❌ Troca recusada';
        const msg = status === 'aprovada' ? 'Sua solicitação foi aprovada e a escala foi atualizada automaticamente.' : `Sua solicitação foi recusada. Motivo: ${motivo}`;
        await dispatchNotification({ professionalId: swap.solicitante_id, tipo: 'troca', titulo, mensagem: msg });
        if (swap.destinatario_id) {
          await dispatchNotification({ professionalId: swap.destinatario_id, tipo: 'troca', titulo, mensagem: msg });
        }
      }
    },
    onSuccess: () => {
      invalidateCrossSwaps(qc);
      toast.success('Troca processada e escala atualizada!');
      setReviewSwap(null); setReviewAction(null); setReviewMotivo('');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const adminSwapMutation = useMutation({
    mutationFn: async () => {
      const { profA, shiftA, profB, shiftB, motivo } = adminForm;
      if (!profA || !shiftA || !profB || !shiftB) throw new Error('Selecione profissionais e plantões.');
      if (profA === profB) throw new Error('Os profissionais devem ser diferentes.');
      if (motivo.trim().length < 10) throw new Error('Motivo deve ter no mínimo 10 caracteres.');

      const shiftAData = allShifts.find((s: any) => s.id === shiftA);
      const shiftBData = allShifts.find((s: any) => s.id === shiftB);
      if (!shiftAData || !shiftBData) throw new Error('Plantões não encontrados.');

      const { data: conflictA } = await supabase.rpc('check_shift_conflict', {
        p_profissional_id: profB, p_data: shiftAData.data,
        p_hora_inicio: shiftAData.hora_inicio, p_hora_fim: shiftAData.hora_fim, p_exclude_id: shiftB,
      });
      if (conflictA && conflictA.length > 0) throw new Error(`Conflito: Prof. B já tem plantão das ${conflictA[0].conflicting_start} às ${conflictA[0].conflicting_end} nesta data.`);

      const { data: conflictB } = await supabase.rpc('check_shift_conflict', {
        p_profissional_id: profA, p_data: shiftBData.data,
        p_hora_inicio: shiftBData.hora_inicio, p_hora_fim: shiftBData.hora_fim, p_exclude_id: shiftA,
      });
      if (conflictB && conflictB.length > 0) throw new Error(`Conflito: Prof. A já tem plantão das ${conflictB[0].conflicting_start} às ${conflictB[0].conflicting_end} nesta data.`);

      const { data: swap, error: swapErr } = await supabase.from('shift_swaps').insert({
        shift_id: shiftA, shift_id_destino: shiftB,
        solicitante_id: profA, destinatario_id: profB,
        motivo: `[ADMINISTRATIVA] ${motivo.trim()}`,
        tipo: 'administrativa', status: 'concluida' as any,
        observacao_gestor: `Troca administrativa direta`,
        motivo_administrativo: motivo.trim(), bypass_aprovacao: true,
      } as any).select('id').single();
      if (swapErr) throw swapErr;

      const { error: e1 } = await supabase.from('shifts').update({ profissional_id: profB }).eq('id', shiftA);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('shifts').update({ profissional_id: profA }).eq('id', shiftB);
      if (e2) throw e2;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('swap_history').insert([
        { swap_id: swap.id, acao: 'Troca administrativa criada', usuario: user?.email || 'Gestor Master', user_id: user?.id, detalhes: `Motivo: ${motivo.trim()}` },
        { swap_id: swap.id, acao: 'Aprovação automática — Gestor Master', usuario: user?.email || 'Gestor Master', user_id: user?.id },
      ]);
      await logAudit('Troca administrativa', 'trocas', { swap_id: swap.id, profA, profB });

      const profAName = professionals.find((p: any) => p.id === profA)?.nome || '';
      const profBName = professionals.find((p: any) => p.id === profB)?.nome || '';
      await dispatchNotification({ professionalId: profA, tipo: 'troca', titulo: '⚠️ Troca administrativa', mensagem: `Gestor Master trocou seu plantão com ${profBName}.` });
      await dispatchNotification({ professionalId: profB, tipo: 'troca', titulo: '⚠️ Troca administrativa', mensagem: `Gestor Master trocou seu plantão com ${profAName}.` });
    },
    onSuccess: () => {
      invalidateCrossSwaps(qc);
      qc.invalidateQueries({ queryKey: ['swap-all-shifts'] });
      toast.success('Troca administrativa confirmada!');
      setAdminModalOpen(false);
      setAdminForm({ profA: '', shiftA: '', profB: '', shiftB: '', motivo: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingStatuses = ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'];
  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all";

  const formatShiftLabel = (s: any) =>
    `${new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')} • ${s.hora_inicio?.slice(0,5)}-${s.hora_fim?.slice(0,5)} • ${(s.sectors as any)?.nome || ''}`;

  const tiposPlantao = useMemo(() => {
    const set = new Set<string>();
    swaps.forEach((s: any) => {
      const t = (s.shifts as any)?.tipo_plantao;
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [swaps]);

  const filteredSwaps = useMemo(() => {
    let list = swaps as any[];

    // Status (KPI quick filter)
    if (filterStatus === 'pendentes') list = list.filter(s => pendingStatuses.includes(s.status));
    else if (filterStatus === 'aprovadas') list = list.filter(s => ['aprovada', 'concluida'].includes(s.status));
    else if (filterStatus === 'recusadas') list = list.filter(s => ['recusada', 'rejeitada'].includes(s.status));

    if (fSolicitante) list = list.filter(s => s.solicitante_id === fSolicitante);
    if (fSubstituto) list = list.filter(s => s.destinatario_id === fSubstituto);
    if (fUnidade) list = list.filter(s => (s.shifts as any)?.unidade_id === fUnidade);
    if (fSetor) list = list.filter(s => (s.shifts as any)?.setor_id === fSetor);
    if (fTipo) list = list.filter(s => (s.shifts as any)?.tipo_plantao === fTipo);
    if (fDataIni) list = list.filter(s => ((s.shifts as any)?.data || '') >= fDataIni);
    if (fDataFim) list = list.filter(s => ((s.shifts as any)?.data || '') <= fDataFim);

    if (search.trim()) {
      const q = norm(search);
      list = list.filter(s => {
        const haystack = [
          (s.solicitante as any)?.nome,
          (s.destinatario as any)?.nome,
          (s.shifts as any)?.units?.nome,
          (s.shifts as any)?.sectors?.nome,
          (s.shifts as any)?.data,
          SWAP_STATUS_LABELS[s.status as SwapStatus] || s.status,
          s.status,
          s.motivo,
          s.observacao_gestor,
          s.observacao_rejeicao,
        ].map(norm).join(' ');
        return haystack.includes(q);
      });
    }
    return list;
  }, [swaps, filterStatus, fSolicitante, fSubstituto, fUnidade, fSetor, fTipo, fDataIni, fDataFim, search]);

  const sectorsForUnidade = useMemo(
    () => fUnidade ? sectors.filter((x: any) => x.unidade_id === fUnidade) : sectors,
    [sectors, fUnidade],
  );

  const hasAdvancedFilters = !!(search || fUnidade || fSetor || fSolicitante || fSubstituto || fTipo || fDataIni || fDataFim);

  const limparFiltros = () => {
    setSearchInput(''); setFUnidade(''); setFSetor(''); setFSolicitante('');
    setFSubstituto(''); setFTipo(''); setFDataIni(''); setFDataFim('');
    setFilterStatus('todas');
  };

  const openReview = (swap: any, action: 'aprovar' | 'rejeitar') => {
    setReviewSwap(swap); setReviewAction(action); setReviewMotivo('');
  };

  const submitReview = () => {
    if (!reviewSwap || !reviewAction) return;
    updateSwap.mutate({
      id: reviewSwap.id,
      status: reviewAction === 'aprovar' ? 'aprovada' : 'rejeitada',
      motivo: reviewMotivo.trim() || undefined,
    });
  };

  const handlePrintSolicitacao = useCallback(async (swap: any) => {
    const history = swapHistories.filter((h: any) => h.swap_id === swap.id) as any[];
    const { data: { user } } = await supabase.auth.getUser();
    const responsavel = history.find((h: any) =>
      /aprovad|rejeitad|recusad|efetivad/i.test(h.acao || '')
    )?.usuario || null;

    printSolicitacaoTroca({
      swapId: swap.id,
      solicitanteNome: (swap.solicitante as any)?.nome || '—',
      substitutoNome: (swap.destinatario as any)?.nome || 'Cobertura aberta',
      unidade: (swap.shifts as any)?.units?.nome || '—',
      setor: (swap.shifts as any)?.sectors?.nome || '—',
      data: (swap.shifts as any)?.data || '',
      horaInicio: (swap.shifts as any)?.hora_inicio || '',
      horaFim: (swap.shifts as any)?.hora_fim || '',
      motivo: swap.motivo || '',
      status: SWAP_STATUS_LABELS[swap.status as SwapStatus] || swap.status,
      criadoEm: swap.created_at,
      responsavel,
      historico: history.map(h => ({ acao: h.acao, usuario: h.usuario, detalhes: h.detalhes, created_at: h.created_at })),
      emitidoPor: user?.email || undefined,
    });
    await logAudit('Solicitação de troca impressa', 'trocas', { swap_id: swap.id });
  }, [swapHistories]);

  const exportCSV = () => {
    if (!filteredSwaps.length) { toast.info('Nada para exportar.'); return; }
    const header = ['ID','Status','Tipo','Solicitante','Substituto','Unidade','Setor','Data','Hora Início','Hora Fim','Tipo Plantão','Motivo','Criado em','Aprovado em','Rejeitado em'];
    const rows = filteredSwaps.map((s: any) => [
      s.id, SWAP_STATUS_LABELS[s.status as SwapStatus] || s.status, s.tipo,
      (s.solicitante as any)?.nome || '', (s.destinatario as any)?.nome || '',
      (s.shifts as any)?.units?.nome || '', (s.shifts as any)?.sectors?.nome || '',
      (s.shifts as any)?.data || '', (s.shifts as any)?.hora_inicio || '', (s.shifts as any)?.hora_fim || '',
      (s.shifts as any)?.tipo_plantao || '',
      (s.motivo || '').replace(/[\r\n]+/g, ' '),
      s.created_at || '', s.aprovado_em || '', s.rejeitado_em || '',
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trocas_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    logAudit('Exportação de trocas (CSV)', 'trocas', { total: filteredSwaps.length });
  };

  const handleNotificar = async (swap: any) => {
    if (notifyingId) return;
    setNotifyingId(swap.id);
    try {
      const data = (swap.shifts as any)?.data ? new Date((swap.shifts as any).data + 'T12:00:00').toLocaleDateString('pt-BR') : '';
      const titulo = '🔔 Lembrete: solicitação de troca';
      const msg = `Sua solicitação de troca${data ? ` (${data})` : ''} está com status ${SWAP_STATUS_LABELS[swap.status as SwapStatus] || swap.status}.`;
      await dispatchNotification({ professionalId: swap.solicitante_id, tipo: 'troca', titulo, mensagem: msg });
      if (swap.destinatario_id) {
        await dispatchNotification({ professionalId: swap.destinatario_id, tipo: 'troca', titulo, mensagem: msg });
      }
      await logAudit('Notificação manual de troca', 'trocas', { swap_id: swap.id });
      toast.success('Notificação enviada.');
    } catch (e: any) {
      toast.error('Falha ao notificar: ' + (e?.message || 'erro'));
    } finally {
      setNotifyingId(null);
    }
  };

  // ============== Análise de Impacto ==============
  const impactoData = useMemo(() => {
    if (!impactSwap) return null;
    const sh = (impactSwap.shifts as any);
    if (!sh) return null;
    const carga = Number(sh.carga_horaria || 0) ||
      // fallback: calcula pela diferença de horas (HH:MM)
      (() => {
        const [h1, m1] = (sh.hora_inicio || '0:0').split(':').map(Number);
        const [h2, m2] = (sh.hora_fim || '0:0').split(':').map(Number);
        let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (mins <= 0) mins += 24 * 60;
        return mins / 60;
      })();

    const solId = impactSwap.solicitante_id;
    const subId = impactSwap.destinatario_id;
    const monthPrefix = (sh.data || '').slice(0, 7) || new Date().toISOString().slice(0, 7);

    const horasSolAtual = calcularHorasMes(monthShifts as any, solId, monthPrefix);
    const horasSubAtual = subId ? calcularHorasMes(monthShifts as any, subId, monthPrefix) : 0;
    const horasSolDepois = Math.max(0, horasSolAtual - carga);
    const horasSubDepois = subId ? horasSubAtual + carga : horasSubAtual;

    // Conflitos: substituto já tem plantão sobreposto na mesma data?
    const subShiftsDia = subId
      ? (monthShifts as any[]).filter(s => s.profissional_id === subId && s.data === sh.data && s.status !== 'cancelado')
      : [];
    const conflitos = subShiftsDia.filter(s => {
      const a1 = (s.hora_inicio || '00:00').slice(0,5);
      const a2 = (s.hora_fim || '00:00').slice(0,5);
      const b1 = (sh.hora_inicio || '').slice(0,5);
      const b2 = (sh.hora_fim || '').slice(0,5);
      return a1 < b2 && b1 < a2;
    });

    // Descanso mínimo (~11h) — verifica vizinhos do mesmo dia ±1
    const targetIni = new Date(sh.data + 'T' + (sh.hora_inicio || '00:00')).getTime();
    const targetFim = new Date(sh.data + 'T' + (sh.hora_fim || '00:00')).getTime();
    const subOutros = subId ? (monthShifts as any[]).filter(s =>
      s.profissional_id === subId && s.id !== sh.id &&
      Math.abs(new Date(s.data + 'T12:00:00').getTime() - new Date(sh.data + 'T12:00:00').getTime()) <= 36 * 3600 * 1000
    ) : [];
    let descansoOk = true;
    let menorGap = Infinity;
    subOutros.forEach(s => {
      const ini = new Date(s.data + 'T' + (s.hora_inicio || '00:00')).getTime();
      const fim = new Date(s.data + 'T' + (s.hora_fim || '00:00')).getTime();
      const gap1 = Math.abs(targetIni - fim) / 3600000;
      const gap2 = Math.abs(ini - targetFim) / 3600000;
      menorGap = Math.min(menorGap, gap1, gap2);
      if (gap1 < 11 || gap2 < 11) descansoOk = false;
    });

    // Cobertura do setor: quantos profissionais distintos no mesmo setor/dia
    const cobertura = (monthShifts as any[]).filter(
      s => s.setor_id === sh.setor_id && s.data === sh.data && s.status !== 'cancelado'
    );
    const profissionaisCobertura = new Set(cobertura.map(s => s.profissional_id));
    const setorObj = sectors.find((x: any) => x.id === sh.setor_id) as any;
    const minDiurno = setorObj?.min_profissionais_diurno || 1;
    const deixaDescoberto = !subId; // sem substituto definido ⇒ vaga aberta

    return {
      carga, horasSolAtual, horasSubAtual, horasSolDepois, horasSubDepois,
      conflitos, descansoOk, menorGap: isFinite(menorGap) ? menorGap : null,
      coberturaAtual: profissionaisCobertura.size, minimoCobertura: minDiurno,
      deixaDescoberto, setorNome: setorObj?.nome || sh.sectors?.nome || '—',
    };
  }, [impactSwap, monthShifts, sectors]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Trocas de Plantão</h1>
          <p className="text-muted-foreground text-sm mt-1">{filteredSwaps.length} de {swaps.length} trocas exibidas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMaster && (
            <button onClick={() => setAdminModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
              <Plus className="h-4 w-4" /> Nova Troca Administrativa
            </button>
          )}
          <MoreActionsMenu
            triggerClassName="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            items={[
              { id: 'export-csv', label: 'Exportar CSV', icon: <Download />, onClick: exportCSV, group: 'Documentos' },
            ]}
          />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: 'todas', label: 'Total', value: swaps.length, color: 'text-primary bg-primary/10' },
          { key: 'pendentes', label: 'Aguardando', value: swaps.filter((s: any) => pendingStatuses.includes(s.status)).length, color: 'text-warning bg-warning/10' },
          { key: 'aprovadas', label: 'Aprovadas', value: swaps.filter((s: any) => ['aprovada','concluida'].includes(s.status)).length, color: 'text-success bg-success/10' },
          { key: 'recusadas', label: 'Recusadas', value: swaps.filter((s: any) => ['recusada','rejeitada'].includes(s.status)).length, color: 'text-destructive bg-destructive/10' },
        ] as const).map(k => (
          <button key={k.key} onClick={() => setFilterStatus(k.key as FilterStatus)}
            className={`kpi-card text-left transition-all ${filterStatus === k.key ? 'ring-2 ring-primary/40 shadow-[var(--shadow-elevated)]' : 'hover:shadow-[var(--shadow-elevated)]'}`}>
            <div className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${k.color} mb-2`}>
              <Filter className="h-3.5 w-3.5" />
            </div>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value mt-1">{k.value}</p>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por solicitante, substituto, unidade, setor, data, status, motivo…"
              className="w-full bg-muted border border-border rounded-lg pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-background text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Filter className="h-4 w-4" />
            Filtros{hasAdvancedFilters ? ' •' : ''}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {hasAdvancedFilters && (
            <button onClick={limparFiltros}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <X className="h-4 w-4" /> Limpar
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
                <select value={fUnidade} onChange={e => { setFUnidade(e.target.value); setFSetor(''); }} className={inputClass}>
                  <option value="">Todas as unidades</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <select value={fSetor} onChange={e => setFSetor(e.target.value)} className={inputClass}>
                  <option value="">Todos os setores</option>
                  {sectorsForUnidade.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
                <select value={fSolicitante} onChange={e => setFSolicitante(e.target.value)} className={inputClass}>
                  <option value="">Solicitante (todos)</option>
                  {professionals.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <select value={fSubstituto} onChange={e => setFSubstituto(e.target.value)} className={inputClass}>
                  <option value="">Substituto (todos)</option>
                  {professionals.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={inputClass}>
                  <option value="">Tipo de plantão (todos)</option>
                  {tiposPlantao.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="date" value={fDataIni} onChange={e => setFDataIni(e.target.value)} className={inputClass} placeholder="Data início" />
                <input type="date" value={fDataFim} onChange={e => setFDataFim(e.target.value)} className={inputClass} placeholder="Data fim" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading ? (
        <CardListSkeleton count={5} />
      ) : isError ? (
        <ErrorState
          title="Não foi possível carregar as trocas"
          description="Erro ao consultar as solicitações de troca. Tente novamente."
          onRetry={() => refetchSwaps()}
          retryLoading={isRefetching}
        />
      ) : filteredSwaps.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhuma troca de plantão encontrada"
          description={hasAdvancedFilters
            ? 'Nenhum resultado para os filtros aplicados. Ajuste os filtros e tente novamente.'
            : `Não há trocas ${filterStatus !== 'todas' ? `com status "${filterStatus}"` : 'registradas'} no momento.`}
        />
      ) : (
        <div className="space-y-3">
          {filteredSwaps.map((swap: any, i: number) => {
            const isAdmin = swap.tipo === 'administrativa';
            const style = statusStyles[swap.status as SwapStatus] || statusStyles.solicitada;
            const Icon = style.icon;
            const history = swapHistories.filter((h: any) => h.swap_id === swap.id);
            const isPending = pendingStatuses.includes(swap.status);
            const isExpanded = expandedHistory[swap.id];

            return (
              <motion.div key={swap.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={`bg-card rounded-xl border p-4 sm:p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all ${isPending ? `ring-1 ${style.ring}` : 'border-border'}`}>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-lg shrink-0 ${isAdmin ? 'bg-[hsl(var(--chart-4))]/10' : 'bg-primary/10'}`}>
                      {isAdmin ? <Zap className="h-5 w-5 text-[hsl(var(--chart-4))]" /> : <ArrowLeftRight className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && (
                          <span className="status-badge bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]">
                            <Zap className="h-3 w-3 mr-1" />Administrativa
                          </span>
                        )}
                        <span className="font-semibold text-foreground text-sm">{isAdmin ? 'Gestor Master' : (swap.solicitante as any)?.nome || '—'}</span>
                        {!isAdmin && (swap.solicitante as any)?.nome && (
                          <ContactActionButton profissional={{ nome: (swap.solicitante as any)?.nome, telefone: professionals.find((p: any) => p.id === swap.solicitante_id)?.telefone }} contexto={{ tipo: 'troca' }} />
                        )}
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold text-foreground text-sm">{(swap.destinatario as any)?.nome || 'Cobertura aberta'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5">{swap.motivo}</p>

                      {swap.shifts && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs bg-muted/50 px-2 py-1 rounded-md border border-border/50">
                          <CalIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground font-medium">
                            {new Date((swap.shifts as any).data + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground font-mono">{(swap.shifts as any).hora_inicio?.slice(0,5)}–{(swap.shifts as any).hora_fim?.slice(0,5)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{(swap.shifts as any).units?.nome || ''}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{(swap.shifts as any).sectors?.nome || ''}</span>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">Criado em {new Date(swap.created_at).toLocaleString('pt-BR')}</p>
                      {swap.observacao_rejeicao && (
                        <div className="mt-2 p-2 rounded-md bg-destructive/5 border border-destructive/20">
                          <p className="text-xs text-destructive"><strong>Motivo da recusa:</strong> {swap.observacao_rejeicao}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className={`status-badge ${style.class} border`}>
                      <Icon className="h-3.5 w-3.5 mr-1" />{SWAP_STATUS_LABELS[swap.status as SwapStatus] || swap.status}
                    </span>

                    <button onClick={() => setImpactSwap(swap)}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1"
                      title="Ver impacto da troca">
                      <Activity className="h-3 w-3" /> Impacto
                    </button>

                    <button onClick={() => handlePrintSolicitacao(swap)}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1"
                      title="Imprimir solicitação">
                      <Printer className="h-3 w-3" /> Imprimir
                    </button>

                    {isMaster && (
                      <button onClick={() => handleNotificar(swap)} disabled={notifyingId === swap.id}
                        className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        title="Notificar profissional">
                        <BellRing className="h-3 w-3" /> {notifyingId === swap.id ? 'Enviando…' : 'Notificar'}
                      </button>
                    )}

                    {['aprovada', 'concluida'].includes(swap.status) && (
                      <button onClick={() => setComprovanteId(swap.id)} className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Comprovante
                      </button>
                    )}
                    <button onClick={() => setAttachmentsSwapId(swap.id)} className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1" title="Anexos justificativos">
                      <Paperclip className="h-3 w-3" /> Anexos
                    </button>
                    <SignActionButton
                      compact
                      signLabel="Assinar"
                      document={{
                        document_type: 'troca',
                        document_id: swap.id,
                        document_title: `Troca de plantão ${swap.id.slice(0, 8)}`,
                        content: JSON.stringify({
                          id: swap.id,
                          tipo: swap.tipo,
                          status: swap.status,
                          motivo: swap.motivo,
                          solicitante: (swap.solicitante as any)?.nome,
                          destinatario: (swap.destinatario as any)?.nome,
                          shift: swap.shifts ? {
                            data: (swap.shifts as any).data,
                            hora_inicio: (swap.shifts as any).hora_inicio,
                            hora_fim: (swap.shifts as any).hora_fim,
                            setor: ((swap.shifts as any).sectors as any)?.nome,
                            unidade: ((swap.shifts as any).units as any)?.nome,
                          } : null,
                        }),
                      }}
                    />
                    {isPending && isMaster && (
                      <>
                        <button onClick={() => openReview(swap, 'aprovar')} disabled={updateSwap.isPending}
                          className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                        </button>
                        <button onClick={() => openReview(swap, 'rejeitar')} disabled={updateSwap.isPending}
                          className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Recusar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <button onClick={() => setExpandedHistory(p => ({ ...p, [swap.id]: !p[swap.id] }))}
                      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                      <History className="h-3 w-3" />
                      Histórico ({history.length})
                      <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="space-y-2 mt-2">
                            {history.map((h: any) => (
                              <div key={h.id} className="flex items-start gap-2 text-xs">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <div>
                                  <span className="text-foreground font-medium">{h.acao}</span>
                                  <span className="text-muted-foreground"> por {h.usuario}</span>
                                  {h.detalhes && <span className="text-muted-foreground"> — {h.detalhes}</span>}
                                  <span className="text-muted-foreground block">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={!!reviewSwap} onOpenChange={(o) => { if (!o) { setReviewSwap(null); setReviewAction(null); setReviewMotivo(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === 'aprovar' ? (
                <><CheckCircle2 className="h-5 w-5 text-success" /> Aprovar Troca</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" /> Recusar Troca</>
              )}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'aprovar'
                ? 'A escala será atualizada automaticamente após a aprovação.'
                : 'O motivo da recusa será registrado e enviado ao solicitante.'}
            </DialogDescription>
          </DialogHeader>

          {reviewSwap && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview da Troca</p>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-foreground">{(reviewSwap.solicitante as any)?.nome}</span>
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{(reviewSwap.destinatario as any)?.nome || 'Cobertura aberta'}</span>
                </div>
                {reviewSwap.shifts && (
                  <div className="text-xs text-muted-foreground">
                    <CalIcon className="h-3 w-3 inline mr-1" />
                    {new Date((reviewSwap.shifts as any).data + 'T12:00:00').toLocaleDateString('pt-BR')} ·{' '}
                    <span className="font-mono">{(reviewSwap.shifts as any).hora_inicio?.slice(0,5)}–{(reviewSwap.shifts as any).hora_fim?.slice(0,5)}</span> ·{' '}
                    {((reviewSwap.shifts as any).sectors as any)?.nome}
                  </div>
                )}
                <div className="text-xs">
                  <span className="text-muted-foreground">Motivo solicitante: </span>
                  <span className="text-foreground italic">"{reviewSwap.motivo}"</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  {reviewAction === 'aprovar' ? 'Observação (opcional)' : 'Motivo da recusa *'}
                </label>
                <textarea
                  value={reviewMotivo}
                  onChange={e => setReviewMotivo(e.target.value)}
                  rows={3}
                  required={reviewAction === 'rejeitar'}
                  minLength={reviewAction === 'rejeitar' ? 5 : 0}
                  placeholder={reviewAction === 'aprovar' ? 'Ex: Aprovado conforme solicitado.' : 'Ex: Profissional já trocou 3x este mês.'}
                  className={inputClass}
                />
                {reviewAction === 'rejeitar' && reviewMotivo.length > 0 && reviewMotivo.length < 5 && (
                  <p className="text-xs text-destructive mt-1">Mínimo 5 caracteres.</p>
                )}
                {reviewAction === 'rejeitar' && reviewMotivo.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">O motivo é obrigatório para recusar.</p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => { setReviewSwap(null); setReviewAction(null); setReviewMotivo(''); }}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancelar</button>
                <button onClick={submitReview}
                  disabled={updateSwap.isPending || (reviewAction === 'rejeitar' && reviewMotivo.trim().length < 5)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity ${reviewAction === 'aprovar' ? 'bg-success' : 'bg-destructive'} hover:opacity-90`}>
                  {updateSwap.isPending ? 'Processando...' : reviewAction === 'aprovar' ? '✅ Confirmar aprovação' : '❌ Confirmar recusa'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Impact Modal */}
      <Dialog open={!!impactSwap} onOpenChange={(o) => { if (!o) setImpactSwap(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Análise de Impacto
            </DialogTitle>
            <DialogDescription>Visão pré-aprovação do efeito desta troca.</DialogDescription>
          </DialogHeader>
          {impactSwap && impactoData && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Solicitante</p>
                  <p className="font-semibold text-foreground truncate">{(impactSwap.solicitante as any)?.nome}</p>
                  <p className="text-xs mt-2">Atual: <strong>{impactoData.horasSolAtual.toFixed(1)}h</strong></p>
                  <p className="text-xs">Após troca: <strong className="text-primary">{impactoData.horasSolDepois.toFixed(1)}h</strong></p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Substituto</p>
                  <p className="font-semibold text-foreground truncate">{(impactSwap.destinatario as any)?.nome || 'Cobertura aberta'}</p>
                  <p className="text-xs mt-2">Atual: <strong>{impactoData.horasSubAtual.toFixed(1)}h</strong></p>
                  <p className="text-xs">Após troca: <strong className="text-primary">{impactoData.horasSubDepois.toFixed(1)}h</strong></p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validações</p>
                <div className="flex items-center justify-between text-xs">
                  <span>Conflitos de horário (substituto)</span>
                  <span className={impactoData.conflitos.length > 0 ? 'text-destructive font-semibold' : 'text-success font-semibold'}>
                    {impactoData.conflitos.length > 0 ? `${impactoData.conflitos.length} conflito(s)` : 'OK'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Descanso mínimo (11h)</span>
                  <span className={impactoData.descansoOk ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                    {impactoData.descansoOk ? 'OK' : `Violado${impactoData.menorGap !== null ? ` (${impactoData.menorGap.toFixed(1)}h)` : ''}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Cobertura {impactoData.setorNome}</span>
                  <span className={impactoData.coberturaAtual >= impactoData.minimoCobertura ? 'text-success font-semibold' : 'text-warning font-semibold'}>
                    {impactoData.coberturaAtual}/{impactoData.minimoCobertura} mín.
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Setor descoberto após troca?</span>
                  <span className={impactoData.deixaDescoberto ? 'text-warning font-semibold' : 'text-success font-semibold'}>
                    {impactoData.deixaDescoberto ? 'SIM (sem substituto)' : 'Não'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setImpactSwap(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">Fechar</button>
                {pendingStatuses.includes(impactSwap.status) && isMaster && (
                  <button onClick={() => { const s = impactSwap; setImpactSwap(null); openReview(s, 'aprovar'); }}
                    className="px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-semibold hover:opacity-90">
                    Prosseguir para aprovação
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Swap Modal */}
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[hsl(var(--chart-4))]" /> Troca Administrativa
            </DialogTitle>
            <DialogDescription>Gestor Master · Sem necessidade de aprovação adicional</DialogDescription>
          </DialogHeader>

          <form onSubmit={e => { e.preventDefault(); adminSwapMutation.mutate(); }} className="space-y-4">
            <fieldset className="space-y-2 rounded-lg border border-border p-4">
              <legend className="text-xs font-semibold text-foreground px-2">PROFISSIONAL A</legend>
              <select required value={adminForm.profA} onChange={e => setAdminForm(f => ({ ...f, profA: e.target.value, shiftA: '' }))} className={inputClass}>
                <option value="">Selecione profissional...</option>
                {professionals.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <select required value={adminForm.shiftA} onChange={e => setAdminForm(f => ({ ...f, shiftA: e.target.value }))} className={inputClass} disabled={!adminForm.profA}>
                <option value="">Selecione plantão...</option>
                {shiftsForA.map((s: any) => <option key={s.id} value={s.id}>{formatShiftLabel(s)}</option>)}
              </select>
            </fieldset>

            <div className="flex justify-center"><ArrowLeftRight className="h-5 w-5 text-muted-foreground" /></div>

            <fieldset className="space-y-2 rounded-lg border border-border p-4">
              <legend className="text-xs font-semibold text-foreground px-2">PROFISSIONAL B</legend>
              <select required value={adminForm.profB} onChange={e => setAdminForm(f => ({ ...f, profB: e.target.value, shiftB: '' }))} className={inputClass}>
                <option value="">Selecione profissional...</option>
                {professionals.filter((p: any) => p.id !== adminForm.profA).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <select required value={adminForm.shiftB} onChange={e => setAdminForm(f => ({ ...f, shiftB: e.target.value }))} className={inputClass} disabled={!adminForm.profB}>
                <option value="">Selecione plantão...</option>
                {shiftsForB.map((s: any) => <option key={s.id} value={s.id}>{formatShiftLabel(s)}</option>)}
              </select>
            </fieldset>

            <div>
              <label className="text-sm font-medium text-foreground">Motivo administrativo *</label>
              <textarea required minLength={10} value={adminForm.motivo} onChange={e => setAdminForm(f => ({ ...f, motivo: e.target.value }))} rows={3} placeholder="Mín. 10 caracteres" className={inputClass} />
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs text-warning font-medium">⚠️ Esta troca será confirmada imediatamente. Os profissionais serão trocados no ato.</p>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setAdminModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={adminSwapMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {adminSwapMutation.isPending ? 'Processando...' : '✅ Confirmar Troca'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!comprovanteId} onOpenChange={(open) => !open && setComprovanteId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none">
          {comprovanteId && <ComprovanteTroca trocaId={comprovanteId} onClose={() => setComprovanteId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
