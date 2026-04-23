import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "info" | "success";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolver?: (value: boolean) => void;
  }>({ open: false, options: { title: "" } });

  const confirm: ConfirmFn = useCallback((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolver: resolve });
    });
  }, []);

  const handleClose = (value: boolean) => {
    state.resolver?.(value);
    setState((s) => ({ ...s, open: false }));
  };

  const variant = state.options.variant ?? "default";
  const Icon =
    variant === "destructive" ? AlertTriangle : variant === "success" ? CheckCircle2 : Info;
  const iconColor =
    variant === "destructive"
      ? "text-destructive bg-destructive/10"
      : variant === "success"
        ? "text-success bg-success/10"
        : variant === "info"
          ? "text-info bg-info/10"
          : "text-primary bg-primary/10";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => !o && handleClose(false)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="flex-1 pt-0.5">
                <AlertDialogTitle className="text-base">{state.options.title}</AlertDialogTitle>
                {state.options.description && (
                  <AlertDialogDescription className="mt-1.5">
                    {state.options.description}
                  </AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel onClick={() => handleClose(false)}>
              {state.options.cancelText ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClose(true)}
              className={
                variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {state.options.confirmText ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
