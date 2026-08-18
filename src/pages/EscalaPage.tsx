import { lazy, Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";

const EscalaContent = lazy(() => import("@/components/EscalaPageContent").catch(() => ({
  default: () => (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Escala</h1>
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  ),
})));

export default function EscalaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EscalaContent />
    </Suspense>
  );
}
