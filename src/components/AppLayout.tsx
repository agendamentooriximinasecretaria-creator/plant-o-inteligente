import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { toast } from "sonner";

export function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, professionalId } = useAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications-count", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("lida", false);
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
  });

  // Realtime notifications
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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="bg-transparent text-sm outline-none w-48 placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/notificacoes")}
                className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
