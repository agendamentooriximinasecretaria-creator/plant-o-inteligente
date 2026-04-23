import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed border-border/60 bg-muted/30 animate-fade-in ${className}`}
    >
      <div className="h-14 w-14 rounded-2xl bg-card flex items-center justify-center mb-4 shadow-[var(--shadow-card)] ring-1 ring-border/40">
        <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold text-foreground font-display tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-5">
          {action.label}
        </Button>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
