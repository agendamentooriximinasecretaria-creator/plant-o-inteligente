import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ThemeProvider } from "@/hooks/useTheme";
import { ConfirmProvider } from "@/hooks/useConfirm";

// Lazy loading for pages to improve initial load time
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const EscalaPage = lazy(() => import("@/pages/EscalaPage"));
const TrocasPage = lazy(() => import("@/pages/TrocasPage"));
const ProfissionaisPage = lazy(() => import("@/pages/ProfissionaisPage"));
const SetoresPage = lazy(() => import("@/pages/SetoresPage"));
const RelatoriosPage = lazy(() => import("@/pages/RelatoriosPage"));
const NotificacoesPage = lazy(() => import("@/pages/NotificacoesPage"));
const ConfiguracoesPage = lazy(() => import("@/pages/ConfiguracoesPage"));
const AuditoriaPage = lazy(() => import("@/pages/AuditoriaPage"));
const UsuariosPage = lazy(() => import("@/pages/UsuariosPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ProfissionalDashboardPage = lazy(() => import("@/pages/ProfissionalDashboardPage"));
const MinhaEscalaPage = lazy(() => import("@/pages/MinhaEscalaPage"));
const MinhasTrocasPage = lazy(() => import("@/pages/MinhasTrocasPage"));
const MeuPerfilPage = lazy(() => import("@/pages/MeuPerfilPage"));
const MinhaIndisponibilidadePage = lazy(() => import("@/pages/MinhaIndisponibilidadePage"));
const MeusDocumentosPage = lazy(() => import("@/pages/MeusDocumentosPage"));
const ValidarAssinaturaPage = lazy(() => import("@/pages/ValidarAssinaturaPage"));
const ValidarDocumentoPage = lazy(() => import("@/pages/ValidarDocumentoPage"));
const DocumentosOficiaisPage = lazy(() => import("@/pages/DocumentosOficiaisPage"));
const MigrationSupabasePage = lazy(() => import("@/pages/MigrationSupabasePage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes by default
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

const getHomePath = (isProfessional: boolean) => (isProfessional ? "/meu-painel" : "/dashboard");

function ProtectedRoutes() {
  const { user, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function ManagerOnly({ children }: { children: React.ReactNode }) {
  const { isMaster, isCoordinator, isProfessional, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  if (!isMaster && !isCoordinator) return <Navigate to={getHomePath(isProfessional)} replace />;
  return <>{children}</>;
}

function MasterOnly({ children }: { children: React.ReactNode }) {
  const { isMaster, isProfessional, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  if (!isMaster) return <Navigate to={getHomePath(isProfessional)} replace />;
  return <>{children}</>;
}

function ProfessionalOnly({ children }: { children: React.ReactNode }) {
  const { isProfessional, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  if (!isProfessional) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user, isProfessional, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  if (user) return <Navigate to={getHomePath(isProfessional)} replace />;
  return <LoginPage />;
}

function HomeRedirect() {
  const { isProfessional, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  return <Navigate to={getHomePath(isProfessional)} replace />;
}

function ManagerDashboardRoute() {
  const { isProfessional, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  if (isProfessional) return <Navigate to="/meu-painel" replace />;
  return <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <ConfirmProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppErrorBoundary>
            <Suspense fallback={<AuthLoadingScreen />}>
              <Routes>
                <Route path="/login" element={<LoginRoute />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/validar/:codigo" element={<ValidarAssinaturaPage />} />
                <Route path="/validar-documento" element={<ValidarDocumentoPage />} />
                <Route path="/validar-documento/:codigo" element={<ValidarDocumentoPage />} />
                <Route element={<ProtectedRoutes />}>
                  <Route path="/" element={<HomeRedirect />} />
                  <Route path="/index" element={<HomeRedirect />} />

                  {/* Manager routes */}
                  <Route path="/dashboard" element={<ManagerDashboardRoute />} />
                  <Route path="/escala" element={<ManagerOnly><EscalaPage /></ManagerOnly>} />
                  <Route path="/trocas" element={<ManagerOnly><TrocasPage /></ManagerOnly>} />
                  <Route path="/profissionais" element={<ManagerOnly><ProfissionaisPage /></ManagerOnly>} />
                  <Route path="/medicos" element={<Navigate to="/profissionais" replace />} />
                  <Route path="/setores" element={<ManagerOnly><SetoresPage /></ManagerOnly>} />
                  <Route path="/relatorios" element={<ManagerOnly><RelatoriosPage /></ManagerOnly>} />
                  <Route path="/documentos-oficiais" element={<ManagerOnly><DocumentosOficiaisPage /></ManagerOnly>} />
                  {/* Legacy financial routes redirect */}
                  <Route path="/financeiro" element={<Navigate to="/dashboard" replace />} />

                  {/* Professional routes */}
                  <Route path="/meu-painel" element={<ProfessionalOnly><ProfissionalDashboardPage /></ProfessionalOnly>} />
                  <Route path="/minha-escala" element={<ProfessionalOnly><MinhaEscalaPage /></ProfessionalOnly>} />
                  <Route path="/meus-plantoes" element={<ProfessionalOnly><Navigate to="/minha-escala" replace /></ProfessionalOnly>} />
                  <Route path="/minhas-trocas" element={<ProfessionalOnly><MinhasTrocasPage /></ProfessionalOnly>} />
                  <Route path="/meu-financeiro" element={<ProfessionalOnly><Navigate to="/meu-painel" replace /></ProfessionalOnly>} />
                  <Route path="/meu-perfil" element={<MeuPerfilPage />} />
                  <Route path="/minha-indisponibilidade" element={<ProfessionalOnly><MinhaIndisponibilidadePage /></ProfessionalOnly>} />
                  <Route path="/meus-documentos" element={<ProfessionalOnly><MeusDocumentosPage /></ProfessionalOnly>} />

                  <Route path="/notificacoes" element={<NotificacoesPage />} />

                  {/* Master-only routes */}
                  <Route path="/usuarios" element={<MasterOnly><UsuariosPage /></MasterOnly>} />
                  <Route path="/configuracoes" element={<MasterOnly><ConfiguracoesPage /></MasterOnly>} />
                  <Route path="/auditoria" element={<MasterOnly><AuditoriaPage /></MasterOnly>} />
                  <Route path="/migracao-supabase" element={<MasterOnly><MigrationSupabasePage /></MasterOnly>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
              </AppErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </ConfirmProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
