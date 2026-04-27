import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLoading?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Não foi possível carregar os dados",
  description = "Ocorreu um erro inesperado. Tente novamente em instantes.",
  onRetry,
  retryLoading = false,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 animate-fade-in ${className}`}
    >
      <div className="h-14 w-14 rounded-2xl bg-card flex items-center justify-center mb-4 shadow-[var(--shadow-card)] ring-1 ring-destructive/30">
        <AlertTriangle className="h-6 w-6 text-destructive" strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold text-foreground font-display tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md">{description}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          size="sm"
          variant="outline"
          className="mt-5"
          disabled={retryLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${retryLoading ? "animate-spin" : ""}`} />
          {retryLoading ? "Tentando..." : "Tentar novamente"}
        </Button>
      )}
    </div>
  );
}

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** Versão compacta para usar dentro de cards/seções já carregadas. */
export function InlineError({
  message = "Não foi possível carregar os dados. Tente novamente.",
  onRetry,
  className = "",
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm ${className}`}
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-foreground">{message}</span>
      </div>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry} className="h-7">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
