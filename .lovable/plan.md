

# Plan: Database Migration, RLS Fix, Realtime, Enhanced Reports & Auditoria

## Problem Summary

The admin swap flow fails because `shift_swaps` only has a single `shift_id` column — administrative swaps need two. Additionally, the `swap_history` INSERT policy is overly restrictive for managers, and the system lacks realtime updates, expanded reports with charts, and a proper auditoria panel.

## Phase 1 — Database Migration (Critical Fix)

**Single SQL migration** to:

1. Add columns to `shift_swaps`:
   - `shift_id_destino UUID REFERENCES shifts(id)` — second shift for admin swaps
   - `motivo_administrativo TEXT` — admin justification
   - `bypass_aprovacao BOOLEAN DEFAULT false`

2. Drop and recreate `swap_history` INSERT policy to allow any authenticated user (current policy blocks managers who aren't linked to a professional):
   ```sql
   DROP POLICY "Authenticated can insert own swap history" ON swap_history;
   CREATE POLICY "Authenticated can insert swap history" ON swap_history
     FOR INSERT TO authenticated WITH CHECK (true);
   ```

3. Enable realtime on key tables:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
   ALTER PUBLICATION supabase_realtime ADD TABLE shift_swaps;
   ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
   ```

## Phase 2 — TrocasPage Admin Swap Fix

Update `TrocasPage.tsx` admin swap mutation to:
- Insert `shift_id_destino`, `motivo_administrativo`, `bypass_aprovacao` into the swap record
- Display the destination shift info in swap cards for admin swaps
- The existing conflict check and shift update logic is correct and stays

## Phase 3 — Realtime Subscriptions

Add `useEffect` realtime channels to:
- **`EscalaPage`**: Subscribe to `shifts` changes → auto-refetch
- **`TrocasPage`**: Subscribe to `shift_swaps` changes → auto-refetch
- **`AppLayout`** (notification bell): Subscribe to `notifications` INSERT → increment counter + show toast
- **`NotificacoesPage`**: Subscribe to `notifications` changes → auto-refetch

## Phase 4 — Enhanced Auditoria Page

Expand `AuditoriaPage.tsx` with:
- Text search filter across `acao` and `detalhes`
- Date range filter (from/to)
- Color-coded action badges (green=creation, yellow=edit, red=deletion, blue=approval, purple=admin)
- Expandable details column (click to see full JSON)
- Export filtered logs as CSV
- Increase limit from 100 to 500

## Phase 5 — Expanded Reports with Charts

Add 3 new reports to `RelatoriosPage.tsx` and add inline charts:
- **Escala Mensal Consolidada**: Grid of professional × day showing sector
- **Análise de Trocas**: Swap stats with approval rate, top requesters
- **Cobertura por Setor**: Shifts per sector with bar chart

Add Recharts visualizations (already installed):
- Bar chart: cost by professional (top 10)
- Pie chart: cost distribution by sector
- These render inline above the export buttons for financial and sector reports

## Phase 6 — Notification Bell Realtime Counter

Update `AppLayout.tsx`:
- Add Supabase realtime channel for notifications INSERT
- Show toast with notification title when new notification arrives
- Auto-increment badge counter without waiting for poll

## Files to Modify

| File | Changes |
|------|---------|
| Migration SQL | Add columns, fix swap_history policy, enable realtime |
| `src/pages/TrocasPage.tsx` | Use new columns in admin swap, add realtime subscription |
| `src/pages/EscalaPage.tsx` | Add realtime subscription for shifts |
| `src/pages/AuditoriaPage.tsx` | Text search, date filters, color badges, expandable details, CSV export |
| `src/pages/RelatoriosPage.tsx` | 3 new reports, inline Recharts charts |
| `src/pages/NotificacoesPage.tsx` | Add realtime subscription |
| `src/components/AppLayout.tsx` | Realtime notification counter + toast |

## Technical Notes

- RLS policies use `has_role()` and `is_manager()` security definer functions (correct pattern, avoids infinite recursion)
- The user's suggestion to query `profiles` directly in policies would cause infinite recursion — we use the existing security definer functions instead
- The `swap_history` INSERT policy is the likely blocker for admin swaps (requires professional link OR manager check via subquery on `shift_swaps` which fails for new records)
- Recharts is already installed — no new dependencies needed
- `exportToCSV` already exists in `src/lib/exportUtils.ts`

