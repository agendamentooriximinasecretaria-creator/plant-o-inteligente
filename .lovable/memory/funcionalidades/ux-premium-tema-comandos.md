---
name: UX premium tema/comandos/feedback
description: Sistema com ThemeProvider (light/dark/system), CommandPalette ⌘K com favoritos e ações rápidas, ConfirmProvider, EmptyState e PageSkeleton reutilizáveis. Atalho ⇧⌘T alterna tema.
type: feature
---
- ThemeProvider em src/hooks/useTheme.tsx; persiste em localStorage chave `gestorplantao-theme`. Aplica classe `light|dark` no <html>.
- ThemeToggle (src/components/ThemeToggle.tsx) usa DropdownMenu com 3 opções.
- CommandPalette (src/components/CommandPalette.tsx): atalho ⌘K/Ctrl+K, gera comandos por role, secção "Favoritos" e "Ações rápidas". Aparece no header (botão com placeholder + atalho).
- useFavorites (src/hooks/useFavorites.tsx): persistido em `gestorplantao-favorites`.
- useConfirm (src/hooks/useConfirm.tsx): hook + Provider; substitui window.confirm por AlertDialog estilizado com ícone (default/destructive/info/success).
- EmptyState (src/components/EmptyState.tsx): padrão tracejado, ícone em card, ação opcional.
- PageSkeleton/CardListSkeleton/KpiCardSkeleton/TableRowSkeleton (src/components/PageSkeleton.tsx).
- Providers ordem em App.tsx: ThemeProvider > TooltipProvider > ConfirmProvider > BrowserRouter > AuthProvider.
- index.css: classes .status-* atualizadas para dark mode (/10 + dark:/15).
