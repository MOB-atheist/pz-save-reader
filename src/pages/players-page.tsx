import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerDetailDialog } from "@/components/player-detail-dialog";
import { useRefresh } from "@/contexts/refresh-context";
import { getPlayers, type PlayerRow } from "@/lib/api-client";
import { exportCsv, exportJson, exportExcel } from "@/lib/export-helpers";
import { useQuery } from "@/hooks/use-query";

const MAP_BASE = "https://map.projectzomboid.com/#";

function useFilteredPlayers(
  players: PlayerRow[],
  searchTerm: string,
  profession: string,
  selectedTraits: string[],
  selectedRecipes: string[]
) {
  return useMemo(() => {
    return players.filter((p) => {
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const match =
          (p.name && p.name.toLowerCase().includes(term)) ||
          (p.username && p.username.toLowerCase().includes(term)) ||
          (p.profession && p.profession.toLowerCase().includes(term));
        if (!match) return false;
      }
      if (profession && p.profession !== profession) return false;
      if (selectedTraits.length) {
        const hasAll = selectedTraits.every(
          (t) => Array.isArray(p.traits) && p.traits.includes(t)
        );
        if (!hasAll) return false;
      }
      if (selectedRecipes.length) {
        const hasAny =
          Array.isArray(p.recipeIds) &&
          selectedRecipes.some((r) => p.recipeIds!.includes(r));
        if (!hasAny) return false;
      }
      return true;
    });
  }, [
    players,
    searchTerm,
    profession,
    selectedTraits,
    selectedRecipes,
  ]);
}

export function PlayersPage() {
  const { refreshKey } = useRefresh();
  const { data: allPlayers = [], loading, error } = useQuery(
    refreshKey,
    getPlayers
  );
  const [search, setSearch] = useState("");
  const [profession, setProfession] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<number | string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const professions = useMemo(
    () =>
      [...new Set(allPlayers.map((p) => p.profession).filter(Boolean))].sort() as string[],
    [allPlayers]
  );
  const traits = useMemo(
    () =>
      [...new Set(allPlayers.flatMap((p) => p.traits || []).filter(Boolean))].sort(),
    [allPlayers]
  );
  const recipes = useMemo(
    () =>
      [...new Set(allPlayers.flatMap((p) => p.recipeIds || []).filter(Boolean))].sort(),
    [allPlayers]
  );

  const filtered = useFilteredPlayers(
    allPlayers,
    search,
    profession,
    selectedTraits,
    selectedRecipes
  );
  const isEmpty = filtered.length === 0;

  const openDetail = useCallback((id: number | string) => {
    setDetailId(id);
    setDetailOpen(true);
  }, []);

  const exportRows = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.id,
        name: p.name ?? "",
        username: p.username ?? "",
        profession: p.profession ?? "",
        x: p.x,
        y: p.y,
        z: p.z,
        mapUrl:
          p.x != null && p.y != null ? `${MAP_BASE}${p.x}x${p.y}` : "",
      })),
    [filtered]
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Players</h1>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Filter by name, username or profession..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[280px]"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-profession" className="text-sm text-muted-foreground">
            Profession
          </Label>
          <Select value={profession || "all"} onValueChange={(v) => setProfession(v === "all" ? "" : v)}>
            <SelectTrigger id="filter-profession" className="w-[140px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {professions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-traits" className="text-sm text-muted-foreground">
            Traits (all selected)
          </Label>
          <select
            id="filter-traits"
            multiple
            size={3}
            title="Hold Ctrl/Cmd to select multiple"
            className="flex h-auto min-h-[80px] w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedTraits}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions, (o) => o.value);
              setSelectedTraits(opts);
            }}
          >
            {traits.length
              ? traits.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))
              : ["—"].map((x) => (
                  <option key={x} value="">
                    {x}
                  </option>
                ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-recipes" className="text-sm text-muted-foreground">
            Recipes (any selected)
          </Label>
          <select
            id="filter-recipes"
            multiple
            size={3}
            title="Hold Ctrl/Cmd to select multiple"
            className="flex h-auto min-h-[80px] w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedRecipes}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions, (o) => o.value);
              setSelectedRecipes(opts);
            }}
          >
            {recipes.length
              ? recipes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))
              : ["—"].map((x) => (
                  <option key={x} value="">
                    {x}
                  </option>
                ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-muted-foreground">Export filtered:</span>
        <Button
          variant="outline"
          size="sm"
          disabled={isEmpty}
          onClick={() =>
            exportCsv(
              exportRows,
              ["id", "name", "username", "profession", "x", "y", "z", "mapUrl"],
              "players.csv"
            )
          }
        >
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isEmpty}
          onClick={() => exportExcel(exportRows, "Players", "players.xlsx")}
        >
          Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isEmpty}
          onClick={() => exportJson(exportRows, "players.json")}
        >
          JSON
        </Button>
        {isEmpty && (
          <span className="text-sm text-muted-foreground">
            No rows to export.
          </span>
        )}
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
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead>Position (X, Y)</TableHead>
              <TableHead>Map</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => openDetail(p.id)}
              >
                <TableCell>{p.id}</TableCell>
                <TableCell>{p.name ?? "—"}</TableCell>
                <TableCell>{p.username ?? "—"}</TableCell>
                <TableCell>{p.profession ?? "—"}</TableCell>
                <TableCell>
                  {p.x != null && p.y != null ? `${p.x}, ${p.y}` : "—"}
                </TableCell>
                <TableCell>
                  {p.x != null && p.y != null ? (
                    <a
                      href={`${MAP_BASE}${p.x}x${p.y}`}
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
                      openDetail(p.id);
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
      <PlayerDetailDialog
        id={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
