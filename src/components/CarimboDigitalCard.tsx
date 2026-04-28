import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Stamp, Upload, X, Lock, Unlock, AlertTriangle, Image as ImageIcon } from "lucide-react";

interface Props {
  /** ID do profissional cujo carimbo será editado */
  profissionalId: string;
  /** Role do usuário logado para mostrar opções de bloqueio */
  isMaster?: boolean;
  /** Modo compacto (uso dentro de outras dialogs) */
  compact?: boolean;
}

interface StampRow {
  id?: string;
  profissional_id: string;
  cargo: string | null;
  cbo: string | null;
  cns: string | null;
  texto_personalizado: string | null;
  assinatura_path: string | null;
  carimbo_path: string | null;
  assinatura_posicao: 'esquerda' | 'centro' | 'direita';
  assinatura_tamanho: number;
  carimbo_tamanho: number;
  cor_texto: string;
  mostrar_conselho: boolean;
  mostrar_cbo: boolean;
  mostrar_cns: boolean;
  mostrar_unidade: boolean;
  bloqueado: boolean;
  bloqueado_motivo: string | null;
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

const emptyStamp = (profId: string): StampRow => ({
  profissional_id: profId,
  cargo: '', cbo: '', cns: '', texto_personalizado: '',
  assinatura_path: null, carimbo_path: null,
  assinatura_posicao: 'centro', assinatura_tamanho: 180, carimbo_tamanho: 140,
  cor_texto: '#000000',
  mostrar_conselho: true, mostrar_cbo: false, mostrar_cns: false, mostrar_unidade: true,
  bloqueado: false, bloqueado_motivo: '',
});

async function getSignedUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('professional-documents').createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export default function CarimboDigitalCard({ profissionalId, isMaster, compact }: Props) {
  const sb = supabase as any;
  const qc = useQueryClient();
  const [stamp, setStamp] = useState<StampRow>(emptyStamp(profissionalId));
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [carimboUrl, setCarimboUrl] = useState<string | null>(null);
  const assRef = useRef<HTMLInputElement>(null);
  const carRef = useRef<HTMLInputElement>(null);

  const { data: professional } = useQuery({
    queryKey: ["prof-for-stamp", profissionalId],
    queryFn: async () => {
      const { data } = await supabase.from('professionals')
        .select('nome,profissao,especialidade,conselho,registro,documento_conselho,documento_numero,unidade_principal_id,setor_principal_id')
        .eq('id', profissionalId).maybeSingle();
      return data as any;
    },
    enabled: !!profissionalId,
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ["stamp", profissionalId],
    queryFn: async () => {
      const { data } = await sb.from('professional_stamps').select('*').eq('profissional_id', profissionalId).maybeSingle();
      return data as StampRow | null;
    },
    enabled: !!profissionalId,
  });

  useEffect(() => {
    if (existing) setStamp({ ...emptyStamp(profissionalId), ...existing });
    else setStamp(emptyStamp(profissionalId));
  }, [existing, profissionalId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const a = await getSignedUrl(stamp.assinatura_path);
      const c = await getSignedUrl(stamp.carimbo_path);
      if (!active) return;
      setAssinaturaUrl(a); setCarimboUrl(c);
    })();
    return () => { active = false; };
  }, [stamp.assinatura_path, stamp.carimbo_path]);

  const conselho = professional?.conselho || professional?.documento_conselho || '';
  const registro = professional?.registro || professional?.documento_numero || '';

  const upload = async (file: File, kind: 'assinatura' | 'carimbo') => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Apenas arquivos PNG ou JPG.'); return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Arquivo acima de ${(MAX_BYTES / 1024 / 1024).toFixed(1)}MB.`); return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `signatures/${profissionalId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('professional-documents').upload(path, file, {
      upsert: true, contentType: file.type, cacheControl: '3600',
    });
    if (error) { toast.error('Falha no upload: ' + error.message); return; }
    // Remover arquivo antigo (best-effort)
    const oldPath = kind === 'assinatura' ? stamp.assinatura_path : stamp.carimbo_path;
    if (oldPath && oldPath !== path) {
      await supabase.storage.from('professional-documents').remove([oldPath]).catch(() => {});
    }
    setStamp(s => ({ ...s, [kind === 'assinatura' ? 'assinatura_path' : 'carimbo_path']: path }));
    toast.success(`${kind === 'assinatura' ? 'Assinatura' : 'Carimbo'} carregado. Lembre-se de salvar.`);
  };

  const removeImage = async (kind: 'assinatura' | 'carimbo') => {
    const path = kind === 'assinatura' ? stamp.assinatura_path : stamp.carimbo_path;
    if (path) await supabase.storage.from('professional-documents').remove([path]).catch(() => {});
    setStamp(s => ({ ...s, [kind === 'assinatura' ? 'assinatura_path' : 'carimbo_path']: null }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...stamp, profissional_id: profissionalId };
      if (existing?.id) {
        const { error } = await sb.from('professional_stamps').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('professional_stamps').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Carimbo digital salvo.');
      qc.invalidateQueries({ queryKey: ['stamp', profissionalId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar carimbo.'),
  });

  const linhasCarimbo = useMemo(() => {
    const linhas: string[] = [];
    if (professional?.nome) linhas.push(professional.nome);
    if (stamp.cargo) linhas.push(stamp.cargo);
    else if (professional?.profissao) linhas.push(professional.profissao);
    if (stamp.mostrar_conselho && (conselho || registro)) linhas.push(`${conselho} ${registro}`.trim());
    if (stamp.mostrar_cbo && stamp.cbo) linhas.push(`CBO: ${stamp.cbo}`);
    if (stamp.mostrar_cns && stamp.cns) linhas.push(`CNS: ${stamp.cns}`);
    if (stamp.mostrar_unidade && professional?.unidade_principal_id) linhas.push('Unidade vinculada');
    if (stamp.texto_personalizado) linhas.push(stamp.texto_personalizado);
    return linhas;
  }, [stamp, professional, conselho, registro]);

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelCls = "text-xs font-medium text-muted-foreground";
  const disabledByLock = stamp.bloqueado && !isMaster;

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className={`space-y-5 ${compact ? '' : 'rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]'}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Stamp className="h-4 w-4 text-primary" /> Carimbo Digital
        </h2>
        {stamp.bloqueado && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-destructive/10 text-destructive">
            <Lock className="h-3 w-3" /> Bloqueado
          </span>
        )}
      </div>

      {stamp.bloqueado && (
        <div className="flex items-start gap-2 text-xs p-3 rounded bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Carimbo bloqueado pelo Gestor Master.</strong>
            {stamp.bloqueado_motivo && <div className="mt-1">{stamp.bloqueado_motivo}</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Cargo / Função</label>
          <input value={stamp.cargo || ''} onChange={e => setStamp(s => ({ ...s, cargo: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Ex.: Médico Plantonista" />
        </div>
        <div>
          <label className={labelCls}>CBO (opcional)</label>
          <input value={stamp.cbo || ''} onChange={e => setStamp(s => ({ ...s, cbo: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Ex.: 2251-25" />
        </div>
        <div>
          <label className={labelCls}>CNS Profissional (opcional)</label>
          <input value={stamp.cns || ''} onChange={e => setStamp(s => ({ ...s, cns: e.target.value }))} disabled={disabledByLock} className={inputCls} placeholder="Cartão Nacional de Saúde" />
        </div>
        <div>
          <label className={labelCls}>Cor do texto</label>
          <input type="color" value={stamp.cor_texto} onChange={e => setStamp(s => ({ ...s, cor_texto: e.target.value }))} disabled={disabledByLock} className="h-10 w-full rounded-lg border border-border bg-background" />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Texto personalizado (até 200 caracteres)</label>
          <textarea value={stamp.texto_personalizado || ''} onChange={e => setStamp(s => ({ ...s, texto_personalizado: e.target.value.slice(0, 200) }))} disabled={disabledByLock} rows={2} className={inputCls} placeholder="Linha extra do carimbo (opcional)" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
        {[
          ['mostrar_conselho', 'Conselho'],
          ['mostrar_cbo', 'CBO'],
          ['mostrar_cns', 'CNS'],
          ['mostrar_unidade', 'Unidade'],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-xs">
            <input type="checkbox" disabled={disabledByLock} checked={(stamp as any)[k]} onChange={e => setStamp(s => ({ ...s, [k]: e.target.checked }))} />
            Mostrar {label}
          </label>
        ))}
      </div>

      {/* Uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
        {/* Assinatura */}
        <div className="space-y-2">
          <label className={labelCls}>Assinatura (PNG/JPG, fundo transparente recomendado)</label>
          <div className="rounded-lg border border-dashed border-border p-3 flex flex-col items-center justify-center min-h-[120px] bg-muted/30">
            {assinaturaUrl ? (
              <img src={assinaturaUrl} alt="Assinatura" style={{ maxHeight: 100, maxWidth: '100%' }} />
            ) : (
              <div className="text-xs text-muted-foreground flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Sem assinatura enviada</div>
            )}
          </div>
          <div className="flex gap-2">
            <input ref={assRef} type="file" accept="image/png,image/jpeg" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'assinatura')} />
            <button type="button" disabled={disabledByLock} onClick={() => assRef.current?.click()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50">
              <Upload className="h-3.5 w-3.5" /> Enviar
            </button>
            {stamp.assinatura_path && (
              <button type="button" disabled={disabledByLock} onClick={() => removeImage('assinatura')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div>
            <label className={labelCls}>Tamanho ({stamp.assinatura_tamanho}px)</label>
            <input type="range" min={60} max={480} step={10} value={stamp.assinatura_tamanho} disabled={disabledByLock} onChange={e => setStamp(s => ({ ...s, assinatura_tamanho: Number(e.target.value) }))} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Posição</label>
            <select value={stamp.assinatura_posicao} disabled={disabledByLock} onChange={e => setStamp(s => ({ ...s, assinatura_posicao: e.target.value as any }))} className={inputCls}>
              <option value="esquerda">Esquerda</option>
              <option value="centro">Centro</option>
              <option value="direita">Direita</option>
            </select>
          </div>
        </div>

        {/* Carimbo imagem */}
        <div className="space-y-2">
          <label className={labelCls}>Carimbo em imagem (opcional)</label>
          <div className="rounded-lg border border-dashed border-border p-3 flex flex-col items-center justify-center min-h-[120px] bg-muted/30">
            {carimboUrl ? (
              <img src={carimboUrl} alt="Carimbo" style={{ maxHeight: 100, maxWidth: '100%' }} />
            ) : (
              <div className="text-xs text-muted-foreground flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Sem carimbo enviado</div>
            )}
          </div>
          <div className="flex gap-2">
            <input ref={carRef} type="file" accept="image/png,image/jpeg" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'carimbo')} />
            <button type="button" disabled={disabledByLock} onClick={() => carRef.current?.click()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50">
              <Upload className="h-3.5 w-3.5" /> Enviar
            </button>
            {stamp.carimbo_path && (
              <button type="button" disabled={disabledByLock} onClick={() => removeImage('carimbo')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div>
            <label className={labelCls}>Tamanho ({stamp.carimbo_tamanho}px)</label>
            <input type="range" min={60} max={480} step={10} value={stamp.carimbo_tamanho} disabled={disabledByLock} onChange={e => setStamp(s => ({ ...s, carimbo_tamanho: Number(e.target.value) }))} className="w-full" />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="pt-2 border-t border-border">
        <label className={labelCls}>Pré-visualização</label>
        <div className="mt-2 p-4 rounded-lg border border-border bg-white" style={{ textAlign: stamp.assinatura_posicao as any }}>
          {assinaturaUrl && (
            <img src={assinaturaUrl} alt="Assinatura" style={{ width: stamp.assinatura_tamanho, maxWidth: '100%', display: 'inline-block' }} />
          )}
          <div style={{ borderTop: '1px solid #000', width: 280, margin: stamp.assinatura_posicao === 'centro' ? '4px auto' : (stamp.assinatura_posicao === 'esquerda' ? '4px 0' : '4px 0 4px auto') }} />
          <div style={{ color: stamp.cor_texto, fontFamily: 'Times, serif', fontSize: 13, lineHeight: 1.4 }}>
            {linhasCarimbo.map((l, i) => (
              <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{l}</div>
            ))}
          </div>
          {carimboUrl && (
            <div style={{ marginTop: 8 }}>
              <img src={carimboUrl} alt="Carimbo" style={{ width: stamp.carimbo_tamanho, maxWidth: '100%' }} />
            </div>
          )}
        </div>
      </div>

      {/* Bloqueio (apenas master) */}
      {isMaster && (
        <div className="pt-2 border-t border-border space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={stamp.bloqueado} onChange={e => setStamp(s => ({ ...s, bloqueado: e.target.checked }))} />
            Bloquear este carimbo (impede edição pelo profissional)
          </label>
          {stamp.bloqueado && (
            <input value={stamp.bloqueado_motivo || ''} onChange={e => setStamp(s => ({ ...s, bloqueado_motivo: e.target.value }))} placeholder="Motivo do bloqueio" className={inputCls} />
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={() => save.mutate()} disabled={save.isPending || disabledByLock}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
          {stamp.bloqueado && isMaster ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          {save.isPending ? 'Salvando...' : 'Salvar carimbo'}
        </button>
      </div>
    </div>
  );
}
