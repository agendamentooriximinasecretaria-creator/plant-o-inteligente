import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Save, Loader2, Moon, Info, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export interface AdnConfig {
  enabled: boolean;
  label: string;
  start_time: string;
  end_time: string;
  calculation_type: 'hours' | 'shifts' | 'fixed_per_shift' | 'fixed_total';
  fixed_value: number;
  eligibility: {
    by_role: boolean;
    roles: string[];
    by_profession: boolean;
    professions: string[];
    by_sector: boolean;
    sectors: string[];
    by_bond: boolean;
    bonds: string[];
    by_flag: boolean;
  };
  shift_types: string[];
  display: {
    monthly_scale: boolean;
    print: boolean;
    pdf: boolean;
    format: 'hours' | 'quantity' | 'value';
    decimals: number;
  };
}

const DEFAULT_CONFIG: AdnConfig = {
  enabled: true,
  label: "ADN",
  start_time: "23:00",
  end_time: "07:00",
  calculation_type: 'hours',
  fixed_value: 0,
  eligibility: {
    by_role: true,
    roles: ["Plantonista", "Enfermeiro(a) Plantonista"],
    by_profession: false,
    professions: [],
    by_sector: false,
    sectors: [],
    by_bond: false,
    bonds: [],
    by_flag: true,
  },
  shift_types: [],
  display: {
    monthly_scale: true,
    print: true,
    pdf: true,
    format: 'hours',
    decimals: 1,
  },
};

export function AdnSettingsManager() {
  const qc = useQueryClient();
  const [config, setConfig] = useState<AdnConfig>(DEFAULT_CONFIG);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings', 'adn_config'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'adn_config').maybeSingle();
      return (data?.value as unknown as AdnConfig) || DEFAULT_CONFIG;
    },
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ['professionals-cargos'],
    queryFn: async () => {
      const { data } = await supabase.from('professionals').select('cargo').not('cargo', 'is', null);
      const unique = Array.from(new Set(data?.map(p => p.cargo).filter(Boolean) as string[]));
      return unique.sort();
    }
  });

  const { data: shiftTypes = [] } = useQuery({
    queryKey: ['shift_types'],
    queryFn: async () => {
      const { data } = await supabase.from('shift_types').select('id, nome').eq('ativo', true);
      return data || [];
    }
  });

  useEffect(() => {
    if (settings) {
      // Merge with default to ensure all fields exist
      setConfig({
        ...DEFAULT_CONFIG,
        ...settings,
        eligibility: { ...DEFAULT_CONFIG.eligibility, ...settings.eligibility },
        display: { ...DEFAULT_CONFIG.display, ...settings.display },
      });
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: async (newConfig: AdnConfig) => {
      const { data: existing } = await supabase.from('system_settings').select('id').eq('key', 'adn_config').maybeSingle();
      if (existing) {
        await supabase.from('system_settings').update({ value: newConfig as any }).eq('key', 'adn_config');
      } else {
        await supabase.from('system_settings').insert({ key: 'adn_config', value: newConfig as any });
      }
      await logAudit('Configuração de ADN salva', 'configuracoes', newConfig as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Configurações de ADN salvas com sucesso!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar: ' + e.message),
  });

  const toggleRole = (role: string) => {
    setConfig(prev => ({
      ...prev,
      eligibility: {
        ...prev.eligibility,
        roles: prev.eligibility.roles.includes(role)
          ? prev.eligibility.roles.filter(r => r !== role)
          : [...prev.eligibility.roles, role]
      }
    }));
  };

  const toggleShiftType = (id: string) => {
    setConfig(prev => ({
      ...prev,
      shift_types: prev.shift_types.includes(id)
        ? prev.shift_types.filter(s => s !== id)
        : [...prev.shift_types, id]
    }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10"><Moon className="h-5 w-5 text-indigo-600" /></div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Adicional Noturno (ADN)</h3>
            <p className="text-sm text-muted-foreground text-balance">Configure as regras de cálculo e exibição do adicional noturno nas escalas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch 
            checked={config.enabled} 
            onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))} 
          />
          <Label className="text-sm font-medium">{config.enabled ? 'Habilitado' : 'Desabilitado'}</Label>
        </div>
      </div>

      {!config.enabled && (
        <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-border flex items-center gap-3 text-muted-foreground text-sm">
          <Info className="h-4 w-4" />
          O Adicional Noturno está desativado. Nenhuma coluna será exibida e nenhum cálculo será realizado.
        </div>
      )}

      {config.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Coluna 1: Geral e Horários */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Info className="h-3.5 w-3.5" /> Geral e Visualização
              </h4>
              
              <div className="space-y-2">
                <Label>Nome da Coluna</Label>
                <Input 
                  value={config.label} 
                  onChange={e => setConfig(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Ex: ADN, Adicional Noturno..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início do Adicional</Label>
                  <Input 
                    type="time" 
                    value={config.start_time} 
                    onChange={e => setConfig(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim do Adicional</Label>
                  <Input 
                    type="time" 
                    value={config.end_time} 
                    onChange={e => setConfig(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label>Onde exibir?</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="disp_scale" 
                      checked={config.display.monthly_scale} 
                      onCheckedChange={(v) => setConfig(prev => ({ ...prev, display: { ...prev.display, monthly_scale: !!v } }))} 
                    />
                    <Label htmlFor="disp_scale" className="text-sm cursor-pointer">Escala Consolidada</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="disp_print" 
                      checked={config.display.print} 
                      onCheckedChange={(v) => setConfig(prev => ({ ...prev, display: { ...prev.display, print: !!v } }))} 
                    />
                    <Label htmlFor="disp_print" className="text-sm cursor-pointer">Impressão</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="disp_pdf" 
                      checked={config.display.pdf} 
                      onCheckedChange={(v) => setConfig(prev => ({ ...prev, display: { ...prev.display, pdf: !!v } }))} 
                    />
                    <Label htmlFor="disp_pdf" className="text-sm cursor-pointer">PDF</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Check className="h-3.5 w-3.5" /> Cálculo e Formato
              </h4>
              
              <div className="space-y-2">
                <Label>Tipo de Cálculo</Label>
                <Select 
                  value={config.calculation_type} 
                  onValueChange={(v: any) => setConfig(prev => ({ ...prev, calculation_type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Por horas noturnas reais</SelectItem>
                    <SelectItem value="shifts">Por quantidade de plantões noturnos</SelectItem>
                    <SelectItem value="fixed_per_shift">Valor fixo por plantão</SelectItem>
                    <SelectItem value="fixed_total">Valor fixo total (independe de horas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Formato de Exibição</Label>
                  <Select 
                    value={config.display.format} 
                    onValueChange={(v: any) => setConfig(prev => ({ ...prev, display: { ...prev.display, format: v } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Horas (ex: 12.5h)</SelectItem>
                      <SelectItem value="quantity">Quantidade (ex: 10)</SelectItem>
                      <SelectItem value="value">Valor (ex: R$ 500,00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Casas Decimais</Label>
                  <Input 
                    type="number" 
                    min={0} 
                    max={2} 
                    value={config.display.decimals} 
                    onChange={e => setConfig(prev => ({ ...prev, display: { ...prev.display, decimals: parseInt(e.target.value) || 0 } }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 2: Elegibilidade */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5" /> Elegibilidade (Quem recebe?)
              </h4>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="elig_flag" 
                    checked={config.eligibility.by_flag} 
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, eligibility: { ...prev.eligibility, by_flag: !!v } }))} 
                  />
                  <Label htmlFor="elig_flag" className="text-sm cursor-pointer">Pelo campo "Recebe ADN" no cadastro do profissional</Label>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="elig_role" 
                      checked={config.eligibility.by_role} 
                      onCheckedChange={(v) => setConfig(prev => ({ ...prev, eligibility: { ...prev.eligibility, by_role: !!v } }))} 
                    />
                    <Label htmlFor="elig_role" className="text-sm cursor-pointer font-semibold text-foreground">Por Cargo / Função</Label>
                  </div>
                  
                  {config.eligibility.by_role && (
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/50 space-y-3">
                      <p className="text-[11px] text-muted-foreground">Selecione os cargos que são elegíveis automaticamente:</p>
                      <div className="flex flex-wrap gap-2">
                        {cargos.map(cargo => (
                          <Badge 
                            key={cargo} 
                            variant={config.eligibility.roles.includes(cargo) ? "default" : "outline"}
                            className="cursor-pointer transition-colors"
                            onClick={() => toggleRole(cargo)}
                          >
                            {cargo}
                          </Badge>
                        ))}
                        {cargos.length === 0 && <span className="text-xs text-muted-foreground italic">Nenhum cargo encontrado no sistema.</span>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-sm font-semibold text-foreground">Tipos de Plantão que geram ADN</Label>
                  <p className="text-[11px] text-muted-foreground">Selecione quais turnos contam para o cálculo. Se vazio, todos os turnos com horário noturno serão considerados.</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {shiftTypes.map(st => (
                      <Badge 
                        key={st.id} 
                        variant={config.shift_types.includes(st.id) ? "secondary" : "outline"}
                        className={`cursor-pointer transition-colors ${config.shift_types.includes(st.id) ? 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30' : ''}`}
                        onClick={() => toggleShiftType(st.id)}
                      >
                        {st.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo/Preview */}
            <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-3">
              <h5 className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                <Info className="h-3 w-3" /> RESUMO DA REGRA
              </h5>
              <p className="text-xs text-indigo-900 leading-relaxed">
                Adicional Noturno <strong>{config.enabled ? 'ATIVO' : 'INATIVO'}</strong> com rótulo <strong>"{config.label}"</strong>. 
                Calculado entre <strong>{config.start_time}</strong> e <strong>{config.end_time}</strong>.
                {config.eligibility.by_role && config.eligibility.roles.length > 0 && (
                  <> Elegível para cargos: <em>{config.eligibility.roles.join(', ')}</em>.</>
                )}
                {config.eligibility.by_flag && (
                  <> Considera também a flag individual do profissional.</>
                )}
                {config.calculation_type === 'hours' ? ' Baseado em horas reais.' : ' Baseado em quantidade/valor.'}
                {config.display.monthly_scale ? ' Visível na escala.' : ' Oculto na escala.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-border/50">
        <button 
          onClick={() => saveMut.mutate(config)} 
          disabled={saveMut.isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações de ADN
        </button>
      </div>
    </div>
  );
}
