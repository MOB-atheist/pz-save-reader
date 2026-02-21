import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getVehicleById, type VehicleRow } from "@/lib/api-client";

const MAP_BASE = "https://map.projectzomboid.com/#";

type Props = {
  id: number | string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VehicleDetailDialog({ id, open, onOpenChange }: Props) {
  const [data, setData] = useState<VehicleRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    if (!open || id == null) {
      setData(null);
      setError(null);
      setRawOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    getVehicleById(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, id]);

  const e = data?.extracted ?? {};
  const raw = data?.raw ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClose={() => onOpenChange(false)}
        className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Vehicle {id}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-2">
          {loading && <p className="text-muted-foreground">Loading…</p>}
          {error && (
            <p className="text-destructive">Failed to load: {error}</p>
          )}
          {data && !loading && !error && (
            <>
              <section className="mb-5 pl-3 border-l-4 border-primary/30">
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Summary
                </h3>
                <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                  <li>
                    <strong>ID</strong>: {data.id}
                  </li>
                  <li>
                    <strong>Position</strong>: {data.x ?? "—"}, {data.y ?? "—"}
                  </li>
                  <li>
                    <strong>Vehicle type</strong>: {e.vehicleType ?? "—"}
                  </li>
                  {e.partNames?.length ? (
                    <li>
                      <strong>Parts</strong>: {e.partNames.join(", ")}
                    </li>
                  ) : null}
                  {e.customNames?.length ? (
                    <li>
                      <strong>Custom names</strong>: {e.customNames.join(", ")}
                    </li>
                  ) : null}
                </ul>
              </section>
              <section className="mb-5 pl-3 border-l-4 border-primary/30">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRawOpen((o) => !o)}
                >
                  {rawOpen ? "Hide raw buffer" : "Show raw buffer"}
                </Button>
                {rawOpen && (
                  <pre className="mt-2 text-xs break-all max-h-[200px] overflow-y-auto bg-muted/50 p-3 rounded-md">
                    {raw.join(", ")}
                  </pre>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { MAP_BASE };
