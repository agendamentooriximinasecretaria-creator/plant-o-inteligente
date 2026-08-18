import { lazy, Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";

const EscalaSchedule = lazy(() => 
  import("@/components/schedule/EscalaSchedule").catch(() => ({
    default: () => (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-8">
          <h2 className="text-lg font-semibold mb-4">Escala de Plantões</h2>
          <p className="text-muted-foreground">
            O componente de escala está sendo carregado...
          </p>
        </div>
      </div>
    ),
  }))
);

export default function EscalaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EscalaSchedule />
    </Suspense>
  );
}
