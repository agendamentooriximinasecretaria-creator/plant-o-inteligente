import { memo, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Calendar, ArrowLeftRight, Users, Building2,
  FileText, Bell, Settings, Shield, LogOut, Activity,
  UserCog, UserCircle, Ban, FolderLock, Database, LineChart
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

export const AppSidebar = memo(function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isMaster, isProfessional, role, profileName } = useAuth();
  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const menuGroups = useMemo(() => {
    if (isProfessional) {
      return [
        {
          label: "Meu Painel",
          items: [
            { title: "Dashboard", url: "/meu-painel", icon: LayoutDashboard },
            { title: "Minha Escala", url: "/minha-escala", icon: Calendar },
            { title: "Minhas Trocas", url: "/minhas-trocas", icon: ArrowLeftRight },
            { title: "Indisponibilidade", url: "/minha-indisponibilidade", icon: Ban },
            { title: "Meus Documentos", url: "/meus-documentos", icon: FolderLock },
            { title: "Meu Perfil", url: "/meu-perfil", icon: UserCircle },
          ] as MenuItem[],
        },
        {
          label: "Sistema",
          items: [
            { title: "Notificações", url: "/notificacoes", icon: Bell },
          ] as MenuItem[],
        },
      ];
    }

    const mainItems: MenuItem[] = [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Escala de Plantões", url: "/escala", icon: Calendar },
      { title: "Trocas de Plantão", url: "/trocas", icon: ArrowLeftRight },
      { title: "Profissionais", url: "/profissionais", icon: Users },
      { title: "Setores e Unidades", url: "/setores", icon: Building2 },
    ];

    const managementItems: MenuItem[] = [
      { title: "Relatórios", url: "/relatorios", icon: FileText },
      { title: "Documentos Oficiais", url: "/documentos-oficiais", icon: FileText },
      { title: "Validar Documento", url: "/validar-documento", icon: Shield },
      { title: "Notificações", url: "/notificacoes", icon: Bell },
    ];

    const systemItems: MenuItem[] = [];
    if (isMaster) {
      systemItems.push({ title: "Usuários", url: "/usuarios", icon: UserCog });
      systemItems.push({ title: "Configurações", url: "/configuracoes", icon: Settings });
      systemItems.push({ title: "Auditoria", url: "/auditoria", icon: Shield });
      systemItems.push({ title: "Migração Supabase", url: "/migracao-supabase", icon: Database });
    }

    const groups = [
      { label: "Principal", items: mainItems },
      { label: "Gestão", items: managementItems },
    ];

    if (systemItems.length > 0) {
      groups.push({ label: "Sistema", items: systemItems });
    }

    // Meu Perfil disponível para Gestor Master e Coordenador
    // (carimbo/assinatura institucional usados em aprovações e documentos)
    groups.push({
      label: "Conta",
      items: [{ title: "Meu Perfil", url: "/meu-perfil", icon: UserCircle }],
    });

    return groups;
  }, [isMaster, isProfessional]);

  const displayName = profileName || user?.email?.split('@')[0] || 'Usuário';
  const roleLabel = role === "gestor_master" ? "Gestor Master" : role === "coordenador" ? "Coordenador" : "Profissional";
  const initials = displayName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

  const handleMenuClick = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const renderGroup = (label: string, items: MenuItem[]) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-[0.1em] font-medium mb-1">
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="transition-all duration-150"
                >
                  <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    onClick={handleMenuClick}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground text-[13px]"
                    activeClassName="bg-sidebar-primary/12 text-sidebar-primary font-medium border-l-2 border-sidebar-primary"
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shrink-0 shadow-sm">
            <Activity className="h-4 w-4 text-sidebar-primary-foreground" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-[13px] font-bold text-sidebar-foreground tracking-tight">GestorPlantão</span>
              <span className="text-[10px] text-sidebar-foreground/40 font-medium">SMS Oriximiná</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {menuGroups.map((group) => renderGroup(group.label, group.items))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-sidebar-primary/15 flex items-center justify-center shrink-0 ring-1 ring-sidebar-primary/20">
            <span className="text-[10px] font-semibold text-sidebar-primary">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</span>
              <span className="text-[10px] text-sidebar-foreground/40 truncate">{roleLabel}</span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="p-1.5 rounded-md text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
});
