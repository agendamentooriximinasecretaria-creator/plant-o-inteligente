import {
  LayoutDashboard, Calendar, ArrowLeftRight, Users, Building2,
  DollarSign, FileText, Bell, Settings, Shield, LogOut, Activity,
  UserCog, Wallet, UserCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useMemo } from "react";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isMaster, isProfessional, role } = useAuth();
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
            { title: "Financeiro", url: "/meu-financeiro", icon: Wallet },
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
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Relatórios", url: "/relatorios", icon: FileText },
      { title: "Notificações", url: "/notificacoes", icon: Bell },
    ];

    const systemItems: MenuItem[] = [];
    if (isMaster) {
      systemItems.push({ title: "Usuários", url: "/usuarios", icon: UserCog });
      systemItems.push({ title: "Configurações", url: "/configuracoes", icon: Settings });
      systemItems.push({ title: "Auditoria", url: "/auditoria", icon: Shield });
    }

    const groups = [
      { label: "Principal", items: mainItems },
      { label: "Gestão", items: managementItems },
    ];

    if (systemItems.length > 0) {
      groups.push({ label: "Sistema", items: systemItems });
    }

    return groups;
  }, [isMaster, isProfessional]);

  const roleLabel = role === "gestor_master" ? "Gestor Master" : role === "coordenador" ? "Coordenador" : "Profissional";
  const initials = roleLabel.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

  const handleMenuClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderGroup = (label: string, items: MenuItem[]) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-widest font-semibold">
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                className="transition-colors duration-150"
              >
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  onClick={handleMenuClick}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="text-sm">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold text-sidebar-foreground">MedShift</span>
              <span className="text-[10px] text-sidebar-foreground/50">Gestão de Plantões</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {menuGroups.map((group) => renderGroup(group.label, group.items))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-sidebar-primary">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium text-sidebar-foreground truncate">{roleLabel}</span>
              <span className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email || ""}</span>
            </div>
          )}
          {!collapsed && (
            <button onClick={async () => { await signOut(); navigate("/login"); }} className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

