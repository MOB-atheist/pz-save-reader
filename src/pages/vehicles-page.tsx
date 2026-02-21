import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VehicleDetailDialog } from "@/components/vehicle-detail-dialog";
import { useRefresh } from "@/contexts/refresh-context";
import { getVehicles, type VehicleRow } from "@/lib/api-client";
import { exportCsv, exportJson, exportExcel } from "@/lib/export-helpers";
import { MAP_BASE } from "@/components/vehicle-detail-dialog";
import { useQuery } from "@/hooks/use-query";

function useFilteredVehicles(vehicles: VehicleRow[], searchTerm: string) {
  return useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter((v) =>
      (v.type ?? "").toLowerCase().includes(term)
    );
  }, [vehicles, searchTerm]);
}

export function VehiclesPage() {
  const { refreshKey } = useRefresh();
  const { data: allVehicles = [], loading, error } = useQuery(
    refreshKey,
    getVehicles
  );
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useFilteredVehicles(allVehicles, search);
  const isEmpty = filtered.length === 0;

  const openDetail = useCallback((id: number | string) => {
    setDetailId(id);
    setDetailOpen(true);
  }, []);

  const exportRows = useMemo(
    () =>
      filtered.map((v) => ({
        id: v.id,
        type: v.type,
        x: v.x,
        y: v.y,
        mapUrl:
          v.x != null && v.y != null
            ? `${MAP_BASE}${v.x}x${v.y}`
            : "",
      })),
    [filtered]
  );

  return (
    <div>
      <header className="border-b border-border pb-4 mb-4">
        <h1 className="text-2xl font-semibold">Vehicles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and export vehicle data from your save.
        </p>
      </header>
      <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filter by type (e.g. Trailer, Ambulance)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Export filtered:</span>
          <Button
            variant="outline"
            size="sm"
            disabled={isEmpty}
            onClick={() =>
              exportCsv(exportRows, ["id", "type", "x", "y", "mapUrl"], "vehicles.csv")
            }
          >
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isEmpty}
            onClick={() => exportExcel(exportRows, "Vehicles", "vehicles.xlsx")}
          >
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isEmpty}
            onClick={() => exportJson(exportRows, "vehicles.json")}
          >
            JSON
          </Button>
          {isEmpty && (
            <span className="text-sm text-muted-foreground">No rows to export.</span>
          )}
        </div>
      </div>
      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-destructive">Failed to load: {error}</p>
      )}
      {!loading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Vehicle Type</TableHead>
              <TableHead>X</TableHead>
              <TableHead>Y</TableHead>
              <TableHead>Map</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v, index) => (
              <TableRow
                key={v.id}
                className={cn(
                  "cursor-pointer",
                  index % 2 === 0 ? "bg-muted/20" : undefined
                )}
                onClick={() => openDetail(v.id)}
              >
                <TableCell>{v.id}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{v.type}</Badge>
                </TableCell>
                <TableCell>{v.x ?? "—"}</TableCell>
                <TableCell>{v.y ?? "—"}</TableCell>
                <TableCell>
                  {v.x != null && v.y != null ? (
                    <a
                      href={`${MAP_BASE}${v.x}x${v.y}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open Map
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(v.id);
                    }}
                  >
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <VehicleDetailDialog
        id={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
