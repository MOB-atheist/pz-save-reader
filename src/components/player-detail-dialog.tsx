import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPlayerById, type PlayerRow } from "@/lib/api-client";

// Known PZ stat/skill names — don't show as "Username (from buffer)" when decoder misclassifies
const KNOWN_STAT_SKILL_NAMES = new Set([
    "Strength",
    "Fitness",
    "Sneak",
    "Nimble",
    "Sprinting",
    "Lightfoot",
    "Voice",
    "Aiming",
    "Reloading",
    "Blade",
    "Blunt",
    "SmallBlade",
    "LongBlade",
    "Axe",
    "SmallBlunt",
    "Spear",
    "Maintenance",
    "Carpentry",
    "Cooking",
    "Farming",
    "Fishing",
    "Trapping",
    "Doctor",
    "Electricity",
    "Metalworking",
    "Melting",
    "Tailoring",
    "Woodwork",
    "FirstAid",
    "Foraging",
]);

function isLikelyUsername(value: string): boolean {
    return (
        value.length >= 3 &&
        value.length <= 20 &&
        !KNOWN_STAT_SKILL_NAMES.has(value)
    );
}

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
    const [xpOpen, setXpOpen] = useState(false);

    useEffect(() => {
        if (!open || id == null) {
            setData(null);
            setError(null);
            setRawOpen(false);
            setXpOpen(false);
            return;
        }
        setLoading(true);
        setError(null);
        getPlayerById(id)
            .then(setData)
            .catch((e) =>
                setError(e instanceof Error ? e.message : "Failed to load"),
            )
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
                    {loading && (
                        <p className="text-muted-foreground">Loading…</p>
                    )}
                    {error && (
                        <p className="text-destructive">
                            Failed to load: {error}
                        </p>
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
                                    {data.username && (
                                        <li>
                                            <strong>Username</strong>:{" "}
                                            {data.username}
                                        </li>
                                    )}
                                    {e.usernameFromBuffer &&
                                        e.usernameFromBuffer !==
                                            data.username &&
                                        isLikelyUsername(
                                            e.usernameFromBuffer,
                                        ) && (
                                            <li>
                                                <strong>
                                                    Username (from buffer)
                                                </strong>
                                                : {e.usernameFromBuffer}
                                            </li>
                                        )}
                                    <li>
                                        <strong>Position</strong>:{" "}
                                        {data.x ?? "—"}, {data.y ?? "—"}
                                        {data.z != null ? `, ${data.z}` : ""}
                                    </li>
                                    {e.characterNames?.length ? (
                                        <li>
                                            <strong>Names</strong>:{" "}
                                            {e.characterNames.join(", ")}
                                        </li>
                                    ) : null}
                                    {e.professionIds?.length ? (
                                        <li>
                                            <strong>Profession(s)</strong>:{" "}
                                            {e.professionIds.join(", ")}
                                        </li>
                                    ) : null}
                                    {e.traitOrSkillIds?.length ? (
                                        <li>
                                            <strong>Traits</strong>:{" "}
                                            {e.traitOrSkillIds
                                                .slice(0, 20)
                                                .join(", ")}
                                            {e.traitOrSkillIds.length > 20
                                                ? " …"
                                                : ""}
                                        </li>
                                    ) : null}
                                    {e.statNames?.length &&
                                    !(
                                        e.skillLevels &&
                                        Object.keys(e.skillLevels).length
                                    ) ? (
                                        <li>
                                            <strong>Stats</strong>:{" "}
                                            {e.statNames.join(", ")}
                                        </li>
                                    ) : null}
                                </ul>
                            </section>
                            {(e.skillLevels &&
                                Object.keys(e.skillLevels).length > 0) ||
                            (e.statNames && e.statNames.length > 0) ? (
                                <section className="mb-5 pl-3 border-l-4 border-primary/30">
                                    <h3 className="text-sm font-medium text-foreground mb-2">
                                        Skill levels
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        From save data. Level 0–10.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {e.skillLevels &&
                                        Object.keys(e.skillLevels).length > 0
                                            ? Object.entries(e.skillLevels)
                                                  .sort(([a], [b]) =>
                                                      a.localeCompare(b),
                                                  )
                                                  .map(([skill, level]) => (
                                                      <Badge
                                                          key={skill}
                                                          variant="secondary"
                                                          className="font-normal"
                                                      >
                                                          {skill} {level}
                                                      </Badge>
                                                  ))
                                            : (e.statNames || []).map(
                                                  (skill) => (
                                                      <Badge
                                                          key={skill}
                                                          variant="outline"
                                                          className="font-normal"
                                                      >
                                                          {skill} —
                                                      </Badge>
                                                  ),
                                              )}
                                    </div>
                                </section>
                            ) : null}
                            {e.appearance?.length ? (
                                <section className="mb-5 pl-3 border-l-4 border-primary/30">
                                    <h3 className="text-sm font-medium text-foreground mb-2">
                                        Appearance
                                    </h3>
                                    <ul className="list-none text-sm bg-muted/50 rounded-md p-3">
                                        <li>{e.appearance.join(", ")}</li>
                                    </ul>
                                </section>
                            ) : null}
                            {e.clothingTypes?.length ? (
                                <section className="mb-5 pl-3 border-l-4 border-primary/30">
                                    <h3 className="text-sm font-medium text-foreground mb-2">
                                        Clothing / equipment
                                    </h3>
                                    <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                                        <li>
                                            <strong>Types</strong>:{" "}
                                            {e.clothingTypes.join(", ")}
                                        </li>
                                        {e.clothingCustomNames?.length ? (
                                            <li>
                                                <strong>Custom names</strong>:{" "}
                                                {e.clothingCustomNames.join(
                                                    ", ",
                                                )}
                                            </li>
                                        ) : null}
                                    </ul>
                                </section>
                            ) : null}
                            {e.inventoryStrings?.length ? (
                                <section className="mb-5 pl-3 border-l-4 border-primary/30">
                                    <h3 className="text-sm font-medium text-foreground mb-2">
                                        Inventory
                                    </h3>
                                    <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                                        {e.inventoryStrings
                                            .slice(0, 20)
                                            .map((s, i) => (
                                                <li key={i}>{s}</li>
                                            ))}
                                        {e.inventoryStrings.length > 20 ? (
                                            <li>
                                                … and{" "}
                                                {e.inventoryStrings.length - 20}{" "}
                                                more
                                            </li>
                                        ) : null}
                                    </ul>
                                </section>
                            ) : null}
                            {e.recipeIds?.length ? (
                                <section className="mb-5 pl-3 border-l-4 border-primary/30">
                                    <h3 className="text-sm font-medium text-foreground mb-2">
                                        Recipes
                                    </h3>
                                    <ul className="list-none text-sm bg-muted/50 rounded-md p-3">
                                        <li>
                                            {e.recipeIds
                                                .slice(0, 15)
                                                .join(", ")}
                                            {e.recipeIds.length > 15
                                                ? ` … and ${e.recipeIds.length - 15} more`
                                                : ""}
                                        </li>
                                    </ul>
                                </section>
                            ) : null}
                            {e.skillXp && Object.keys(e.skillXp).length > 0 ? (
                                <section className="mb-5 pl-3 border-l-4 border-primary/30">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 text-sm font-medium text-foreground hover:bg-transparent"
                                        onClick={() => setXpOpen((o) => !o)}
                                    >
                                        {xpOpen
                                            ? "Hide raw XP values"
                                            : "Show raw XP values"}
                                    </Button>
                                    {xpOpen && (
                                        <>
                                            <p className="text-xs text-muted-foreground mt-1 mb-2">
                                                Numeric values per skill from
                                                buffer.
                                            </p>
                                            <ul className="list-none space-y-1 text-sm bg-muted/50 rounded-md p-3">
                                                {Object.entries(e.skillXp).map(
                                                    ([skill, values]) => {
                                                        const arr =
                                                            Array.isArray(
                                                                values,
                                                            )
                                                                ? values
                                                                : [values];
                                                        const sensible =
                                                            arr.filter(
                                                                (v) =>
                                                                    typeof v ===
                                                                        "number" &&
                                                                    Number.isFinite(
                                                                        v,
                                                                    ) &&
                                                                    v >= 0 &&
                                                                    v < 1e15 &&
                                                                    (v >=
                                                                        1e-100 ||
                                                                        v ===
                                                                            0),
                                                            );
                                                        return (
                                                            <li key={skill}>
                                                                <strong>
                                                                    {skill}
                                                                </strong>
                                                                :{" "}
                                                                {sensible.length
                                                                    ? sensible.join(
                                                                          ", ",
                                                                      )
                                                                    : arr.join(
                                                                          ", ",
                                                                      )}
                                                                {sensible.length !==
                                                                    arr.length && (
                                                                    <span className="text-muted-foreground text-xs ml-1">
                                                                        (some
                                                                        values
                                                                        omitted)
                                                                    </span>
                                                                )}
                                                            </li>
                                                        );
                                                    },
                                                )}
                                            </ul>
                                        </>
                                    )}
                                </section>
                            ) : null}
                            <section className="mb-5 pl-3 border-l-4 border-primary/30">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRawOpen((o) => !o)}
                                >
                                    {rawOpen
                                        ? "Hide raw buffer"
                                        : "Show raw buffer"}
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
