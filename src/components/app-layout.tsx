import { Link, useLocation, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRefresh } from "@/contexts/refresh-context";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/vehicles", label: "Vehicles" },
  { to: "/players", label: "Players" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppLayout(_props: { children?: React.ReactNode }) {
  const location = useLocation();
  const { doRefresh, isRefreshing } = useRefresh();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card px-5 py-3 flex items-center gap-4">
        {nav.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "font-medium text-primary hover:underline",
              location.pathname === to && "text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="ml-auto"
          disabled={isRefreshing}
          onClick={() => doRefresh()}
          title="Resync data from game files"
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
      </nav>
      <main className="max-w-6xl mx-auto p-5">
        <Outlet />
      </main>
    </div>
  );
}
