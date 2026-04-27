import { ReactNode } from "react";
import { MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MoreActionItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
  /** texto opcional para divisão lógica */
  group?: string;
  destructive?: boolean;
}

interface Props {
  items: MoreActionItem[];
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
  triggerClassName?: string;
}

/**
 * Botão "Mais ações" padronizado.
 * - Agrupa ações secundárias em um menu unificado.
 * - Suporta loading por item (bloqueia duplo clique).
 * - Itens com `hidden` são omitidos (uso para permissões).
 */
export function MoreActionsMenu({
  items,
  label = "Mais ações",
  align = "end",
  className,
  triggerClassName,
}: Props) {
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;

  // Agrupa por `group` mantendo a ordem de aparição
  const groups: Array<{ name: string | null; items: MoreActionItem[] }> = [];
  for (const it of visible) {
    const name = it.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(it);
    else groups.push({ name, items: [it] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={label}
          className={
            triggerClassName ??
            "flex items-center gap-1.5 border border-input bg-card px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-colors"
          }
        >
          <MoreHorizontal className="h-3.5 w-3.5" /> {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={className ?? "w-60"}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {g.name && <DropdownMenuLabel>{g.name}</DropdownMenuLabel>}
            {g.items.map((it) => (
              <DropdownMenuItem
                key={it.id}
                disabled={it.disabled || it.loading}
                onClick={(e) => {
                  if (it.disabled || it.loading) {
                    e.preventDefault();
                    return;
                  }
                  it.onClick();
                }}
                className={it.destructive ? "text-destructive focus:text-destructive" : undefined}
              >
                {it.loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <span className="mr-2 inline-flex items-center justify-center [&_svg]:h-4 [&_svg]:w-4">
                    {it.icon}
                  </span>
                )}
                {it.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
