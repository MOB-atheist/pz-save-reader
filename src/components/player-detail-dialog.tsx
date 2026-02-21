import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getPlayerById, type PlayerRow } from "@/lib/api-client";

type Props = {
  id: number | string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PlayerDetailDialog({ id, open, onOpenChange }: Props) {
  const [data, setData] = useState<PlayerRow | null>(null);
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
    getPlayerById(id)
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
          <DialogTitle>Player {id}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-2">
          {loading && <p className="text-muted-foreground">Loading…</p>}
          {error && (
            <p className="text-destructive">Failed to load: {error}</p>
          )}
          {data && !loading && !error && (
            <>
              <section className="mb-5">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Summary
                </h3>
                <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                  <li>
                    <strong>ID</strong>: {data.id}
                  </li>
                  {data.username && (
                    <li>
                      <strong>Username</strong>: {data.username}
                    </li>
                  )}
                  {e.usernameFromBuffer && e.usernameFromBuffer !== data.username && (
                    <li>
                      <strong>Username (from buffer)</strong>: {e.usernameFromBuffer}
                    </li>
                  )}
                  <li>
                    <strong>Position</strong>: {data.x ?? "—"}, {data.y ?? "—"}
                    {data.z != null ? `, ${data.z}` : ""}
                  </li>
                  {e.characterNames?.length ? (
                    <li>
                      <strong>Names</strong>: {e.characterNames.join(", ")}
                    </li>
                  ) : null}
                  {e.professionIds?.length ? (
                    <li>
                      <strong>Profession(s)</strong>: {e.professionIds.join(", ")}
                    </li>
                  ) : null}
                  {e.traitOrSkillIds?.length ? (
                    <li>
                      <strong>Traits / skills</strong>:{" "}
                      {e.traitOrSkillIds.slice(0, 15).join(", ")}
                      {e.traitOrSkillIds.length > 15 ? " …" : ""}
                    </li>
                  ) : null}
                  {e.statNames?.length ? (
                    <li>
                      <strong>Stats</strong>: {e.statNames.join(", ")}
                    </li>
                  ) : null}
                </ul>
              </section>
              {e.appearance?.length ? (
                <section className="mb-5">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Appearance
                  </h3>
                  <ul className="list-none text-sm bg-muted/50 rounded-md p-3">
                    <li>{e.appearance.join(", ")}</li>
                  </ul>
                </section>
              ) : null}
              {e.clothingTypes?.length ? (
                <section className="mb-5">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Clothing / equipment
                  </h3>
                  <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                    <li>
                      <strong>Types</strong>: {e.clothingTypes.join(", ")}
                    </li>
                    {e.clothingCustomNames?.length ? (
                      <li>
                        <strong>Custom names</strong>:{" "}
                        {e.clothingCustomNames.join(", ")}
                      </li>
                    ) : null}
                  </ul>
                </section>
              ) : null}
              {e.inventoryStrings?.length ? (
                <section className="mb-5">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Inventory
                  </h3>
                  <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                    {e.inventoryStrings.slice(0, 20).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                    {e.inventoryStrings.length > 20 ? (
                      <li>… and {e.inventoryStrings.length - 20} more</li>
                    ) : null}
                  </ul>
                </section>
              ) : null}
              {e.recipeIds?.length ? (
                <section className="mb-5">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Recipes
                  </h3>
                  <ul className="list-none text-sm bg-muted/50 rounded-md p-3">
                    <li>
                      {e.recipeIds.slice(0, 15).join(", ")}
                      {e.recipeIds.length > 15
                        ? ` … and ${e.recipeIds.length - 15} more`
                        : ""}
                    </li>
                  </ul>
                </section>
              ) : null}
              {e.skillXp && Object.keys(e.skillXp).length > 0 ? (
                <section className="mb-5">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Skill XP (raw)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Numeric values per skill; levels will be interpreted in the
                    frontend later.
                  </p>
                  <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                    {Object.entries(e.skillXp).map(([skill, values]) => (
                      <li key={skill}>
                        <strong>{skill}</strong>:{" "}
                        {Array.isArray(values)
                          ? values.join(", ")
                          : String(values)}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="mb-5">
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
