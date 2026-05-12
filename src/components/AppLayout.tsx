import { memo, useEffect, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";

export const AppLayout = memo(function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, professionalId } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();

  // Atalho global ⇧⌘T para alternar tema
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTheme, resolvedTheme]);



  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications-count", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("lida", false);
      if (error) return 0;
      return count || 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notif-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
      }, (payload) => {
        const n = payload.new as any;
        if (n.user_id === user.id || n.professional_id === professionalId) {
          toast.info(n.titulo, { description: n.mensagem });
        }
        qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
        qc.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, professionalId, qc]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4 md:px-6 shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
              <CommandPalette />
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={useCallback(() => navigate("/notificacoes"), [navigate])}
                className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Notificações"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-card">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
