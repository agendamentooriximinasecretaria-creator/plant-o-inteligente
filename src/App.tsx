import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import EscalaPage from "@/pages/EscalaPage";
import TrocasPage from "@/pages/TrocasPage";
import ProfissionaisPage from "@/pages/ProfissionaisPage";
import SetoresPage from "@/pages/SetoresPage";
import FinanceiroPage from "@/pages/FinanceiroPage";
import RelatoriosPage from "@/pages/RelatoriosPage";
import NotificacoesPage from "@/pages/NotificacoesPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import AuditoriaPage from "@/pages/AuditoriaPage";
import UsuariosPage from "@/pages/UsuariosPage";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";
import ProfissionalDashboardPage from "@/pages/ProfissionalDashboardPage";
import MinhaEscalaPage from "@/pages/MinhaEscalaPage";
import MinhasTrocasPage from "@/pages/MinhasTrocasPage";
import MeuFinanceiroPage from "@/pages/MeuFinanceiroPage";
import MeuPerfilPage from "@/pages/MeuPerfilPage";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, isReady } = useAuth();
  if (!isReady) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function ManagerOnly({ children }: { children: React.ReactNode }) {
  const { isMaster, isCoordinator, isReady } = useAuth();
  if (!isReady) return null;
  if (!isMaster && !isCoordinator) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function MasterOnly({ children }: { children: React.ReactNode }) {
  const { isMaster, isReady } = useAuth();
  if (!isReady) return null;
  if (!isMaster) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user, isReady } = useAuth();
  if (!isReady) return null;
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

function RoleBasedDashboard() {
  const { isProfessional } = useAuth();
  if (isProfessional) return <ProfissionalDashboardPage />;
  return <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<RoleBasedDashboard />} />
              {/* Professional-only routes */}
              <Route path="/minha-escala" element={<MinhaEscalaPage />} />
              <Route path="/minhas-trocas" element={<MinhasTrocasPage />} />
              <Route path="/meu-financeiro" element={<MeuFinanceiroPage />} />
              <Route path="/meu-perfil" element={<MeuPerfilPage />} />
              {/* Manager routes */}
              <Route path="/escala" element={<ManagerOnly><EscalaPage /></ManagerOnly>} />
              <Route path="/trocas" element={<ManagerOnly><TrocasPage /></ManagerOnly>} />
              <Route path="/profissionais" element={<ManagerOnly><ProfissionaisPage /></ManagerOnly>} />
              <Route path="/setores" element={<ManagerOnly><SetoresPage /></ManagerOnly>} />
              <Route path="/financeiro" element={<ManagerOnly><FinanceiroPage /></ManagerOnly>} />
              <Route path="/relatorios" element={<ManagerOnly><RelatoriosPage /></ManagerOnly>} />
              <Route path="/notificacoes" element={<NotificacoesPage />} />
              {/* Master-only routes */}
              <Route path="/usuarios" element={<MasterOnly><UsuariosPage /></MasterOnly>} />
              <Route path="/configuracoes" element={<MasterOnly><ConfiguracoesPage /></MasterOnly>} />
              <Route path="/auditoria" element={<MasterOnly><AuditoriaPage /></MasterOnly>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
