import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/escala" element={<EscalaPage />} />
            <Route path="/trocas" element={<TrocasPage />} />
            <Route path="/profissionais" element={<ProfissionaisPage />} />
            <Route path="/setores" element={<SetoresPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/notificacoes" element={<NotificacoesPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/auditoria" element={<AuditoriaPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
