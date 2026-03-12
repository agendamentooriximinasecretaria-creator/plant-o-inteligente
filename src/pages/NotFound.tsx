import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-elevated)]">
        <h1 className="mb-2 font-display text-4xl font-bold text-foreground">404</h1>
        <p className="mb-5 text-sm text-muted-foreground">Página não encontrada. Vamos voltar ao início.</p>
        <Link to="/" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

