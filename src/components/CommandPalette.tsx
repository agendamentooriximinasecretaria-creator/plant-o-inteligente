import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, Calendar, ArrowLeftRight, Users, Building2,
  FileText, Bell, Settings, Shield, UserCog, UserCircle, Ban,
  FolderLock, Star, Moon, Sun, Plus, Search, Loader2, Stethoscope, MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { useTheme } from "@/hooks/useTheme";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";

interface NavCommand {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  group: string;
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const { isMaster, isCoordinator, isProfessional } = useAuth();
  const { favorites, toggle, isFavorite } = useFavorites();
  const { setTheme, resolvedTheme } = useTheme();

  // Resultados dinâmicos da busca global
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [results, setResults] = useState<{
    profissionais: Array<{ id: string; nome: string; profissao: string }>;
    plantoes: Array<{ id: string; data: string; profissional: string; setor: string }>;
    trocas: Array<{ id: string; status: string; solicitante: string; motivo: string }>;
    setores: Array<{ id: string; nome: string; unidade: string }>;
    unidades: Array<{ id: string; nome: string; tipo: string }>;
    notificacoes: Array<{ id: string; titulo: string; tipo: string }>;
  }>({ profissionais: [], plantoes: [], trocas: [], setores: [], unidades: [], notificacoes: [] });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Busca dinâmica em dados (RLS garante permissões no servidor)
  useEffect(() => {
    const term = debouncedQuery.trim();
    if (!open || term.length < 2) {
      setResults({ profissionais: [], plantoes: [], trocas: [], setores: [], unidades: [], notificacoes: [] });
      return;
    }
    let cancelled = false;
    setLoadingSearch(true);
    (async () => {
      const like = `%${term}%`;
      try {
        const [profsRes, setoresRes, unidadesRes, plantoesRes, trocasRes, notifRes] = await Promise.all([
          // PII-safe view
          (supabase as any)
            .from("professionals_safe")
            .select("id, nome, profissao")
            .or(`nome.ilike.${like},profissao.ilike.${like}`)
            .limit(6),
          supabase
            .from("sectors")
            .select("id, nome, unidade_id, units!inner(nome)")
            .ilike("nome", like)
            .limit(5),
          supabase
            .from("units")
            .select("id, nome, tipo")
            .or(`nome.ilike.${like},tipo.ilike.${like}`)
            .limit(5),
          // Plantões: buscar por data (ISO) ou observações
          /^\d{4}-\d{2}-\d{2}$/.test(term)
            ? supabase
                .from("shifts")
                .select("id, data, profissional_id, setor_id, professionals(nome), sectors(nome)")
                .eq("data", term)
                .limit(6)
            : supabase
                .from("shifts")
                .select("id, data, profissional_id, setor_id, professionals(nome), sectors(nome)")
                .ilike("observacoes", like)
                .limit(6),
          supabase
            .from("shift_swaps")
            .select("id, status, motivo, solicitante_id, professionals!shift_swaps_solicitante_id_fkey(nome)")
            .or(`motivo.ilike.${like},status.ilike.${like}`)
            .limit(5),
          supabase
            .from("notifications")
            .select("id, titulo, tipo")
            .or(`titulo.ilike.${like},mensagem.ilike.${like}`)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        if (cancelled) return;
        setResults({
          profissionais: (profsRes.data || []).map((p: any) => ({ id: p.id, nome: p.nome, profissao: p.profissao })),
          plantoes: (plantoesRes.data || []).map((s: any) => ({
            id: s.id,
            data: s.data,
            profissional: s.professionals?.nome || "—",
            setor: s.sectors?.nome || "—",
          })),
          trocas: (trocasRes.data || []).map((t: any) => ({
            id: t.id,
            status: t.status,
            solicitante: t.professionals?.nome || "—",
            motivo: t.motivo || "",
          })),
          setores: (setoresRes.data || []).map((s: any) => ({
            id: s.id,
            nome: s.nome,
            unidade: s.units?.nome || "—",
          })),
          unidades: (unidadesRes.data || []).map((u: any) => ({ id: u.id, nome: u.nome, tipo: u.tipo })),
          notificacoes: (notifRes.data || []).map((n: any) => ({ id: n.id, titulo: n.titulo, tipo: n.tipo })),
        });
      } catch {
        if (!cancelled) {
          setResults({ profissionais: [], plantoes: [], trocas: [], setores: [], unidades: [], notificacoes: [] });
        }
      } finally {
        if (!cancelled) setLoadingSearch(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery, open]);

  const allCommands: NavCommand[] = useMemo(() => {
    if (isProfessional) {
      return [
        { id: "p-dash", label: "Meu Painel", path: "/meu-painel", icon: LayoutDashboard, group: "Navegação" },
        { id: "p-esc", label: "Minha Escala", path: "/minha-escala", icon: Calendar, group: "Navegação" },
        { id: "p-tro", label: "Minhas Trocas", path: "/minhas-trocas", icon: ArrowLeftRight, group: "Navegação" },
        { id: "p-ind", label: "Indisponibilidade", path: "/minha-indisponibilidade", icon: Ban, group: "Navegação" },
        { id: "p-doc", label: "Meus Documentos", path: "/meus-documentos", icon: FolderLock, group: "Navegação" },
        { id: "p-per", label: "Meu Perfil", path: "/meu-perfil", icon: UserCircle, group: "Navegação" },
        { id: "p-not", label: "Notificações", path: "/notificacoes", icon: Bell, group: "Sistema" },
      ];
    }
    const base: NavCommand[] = [
      { id: "m-dash", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, group: "Navegação" },
      { id: "m-esc", label: "Escala de Plantões", path: "/escala", icon: Calendar, group: "Navegação", keywords: "plantoes calendario" },
      { id: "m-tro", label: "Trocas de Plantão", path: "/trocas", icon: ArrowLeftRight, group: "Navegação" },
      { id: "m-pro", label: "Profissionais", path: "/profissionais", icon: Users, group: "Navegação", keywords: "equipe medicos enfermeiros" },
      { id: "m-set", label: "Setores e Unidades", path: "/setores", icon: Building2, group: "Navegação" },
      { id: "m-rel", label: "Relatórios", path: "/relatorios", icon: FileText, group: "Gestão" },
      { id: "m-not", label: "Notificações", path: "/notificacoes", icon: Bell, group: "Gestão" },
    ];
    if (isMaster) {
      base.push(
        { id: "m-usr", label: "Usuários", path: "/usuarios", icon: UserCog, group: "Sistema" },
        { id: "m-cfg", label: "Configurações", path: "/configuracoes", icon: Settings, group: "Sistema" },
        { id: "m-aud", label: "Auditoria", path: "/auditoria", icon: Shield, group: "Sistema" },
      );
    }
    return base;
  }, [isMaster, isProfessional]);

  const favoriteCommands = allCommands.filter((c) => favorites.includes(c.path));

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium min-w-[200px]"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border border-border/60 text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Buscar"
      >
        <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar páginas, ações ou atalhos..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          {favoriteCommands.length > 0 && (
            <>
              <CommandGroup heading="Favoritos">
                {favoriteCommands.map((cmd) => (
                  <CommandItem key={`fav-${cmd.id}`} onSelect={() => run(() => navigate(cmd.path))}>
                    <Star className="h-4 w-4 mr-2 fill-warning text-warning" />
                    {cmd.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {(isMaster || isCoordinator) && (
            <>
              <CommandGroup heading="Ações rápidas">
                <CommandItem onSelect={() => run(() => navigate("/escala?new=1"))}>
                  <Plus className="h-4 w-4 mr-2" /> Novo plantão
                  <CommandShortcut>N</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => run(() => navigate("/profissionais?new=1"))}>
                  <Plus className="h-4 w-4 mr-2" /> Novo profissional
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {["Navegação", "Gestão", "Sistema"].map((group) => {
            const items = allCommands.filter((c) => c.group === group);
            if (items.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords ?? ""}`}
                    onSelect={() => run(() => navigate(cmd.path))}
                  >
                    <cmd.icon className="h-4 w-4 mr-2" />
                    <span className="flex-1">{cmd.label}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(cmd.path);
                      }}
                      className="opacity-50 hover:opacity-100"
                      aria-label="Favoritar"
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${isFavorite(cmd.path) ? "fill-warning text-warning" : ""}`}
                      />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          <CommandSeparator />
          <CommandGroup heading="Tema">
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              {resolvedTheme === "dark" ? (
                <><Sun className="h-4 w-4 mr-2" /> Mudar para claro</>
              ) : (
                <><Moon className="h-4 w-4 mr-2" /> Mudar para escuro</>
              )}
              <CommandShortcut>⇧⌘T</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
