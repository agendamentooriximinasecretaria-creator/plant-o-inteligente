import { Component, ErrorInfo, ReactNode, memo } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an external service or console
    console.group("Erro Crítico de Interface");
    console.error("Mensagem:", error.message);
    console.error("Stack:", errorInfo.componentStack);
    console.groupEnd();
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-elevated)] ring-1 ring-border/50">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          
          <h1 className="font-display text-2xl font-bold text-foreground">Oops! Algo deu errado</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Ocorreu um erro inesperado na interface do sistema. 
            Tente recarregar a página ou voltar ao início.
          </p>

          {this.state.error && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-[10px] font-mono text-muted-foreground text-left overflow-auto max-h-32 border border-border/40">
              {this.state.error.name}: {this.state.error.message}
            </div>
          )}
          
          <div className="mt-8 flex flex-col gap-3">
            <Button 
              onClick={this.handleReload}
              className="w-full gap-2 h-11"
            >
              <RefreshCcw className="h-4 w-4" />
              Recarregar Página
            </Button>
            
            <Button 
              variant="outline"
              onClick={this.handleGoHome}
              className="w-full gap-2 h-11"
            >
              <Home className="h-4 w-4" />
              Voltar ao Início
            </Button>
          </div>
          
          <p className="mt-6 text-[10px] text-muted-foreground/60">
            Se o problema persistir, contate o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }
}
