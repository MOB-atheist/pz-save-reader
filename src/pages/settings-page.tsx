import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  getConfig,
  putConfig,
  postSync,
  uploadVehicles,
  uploadPlayers,
  type ConfigApi,
} from "@/lib/api-client";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const buf = r.result as ArrayBuffer;
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      resolve(btoa(binary));
    };
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

function findDbFilesInFolder(files: FileList): {
  vehiclesFile: File | null;
  playersFile: File | null;
} {
  const list = Array.from(files);
  const isRoot = (f: File) => {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name || "";
    const parts = path.split("/");
    return parts.length === 2 && (parts[1] === "vehicles.db" || parts[1] === "players.db");
  };
  const rootVehicles = list.find(
    (f) => f.name?.toLowerCase() === "vehicles.db" && isRoot(f)
  );
  const rootPlayers = list.find(
    (f) => f.name?.toLowerCase() === "players.db" && isRoot(f)
  );
  const anyVehicles = list.find((f) => f.name?.toLowerCase() === "vehicles.db");
  const anyPlayers = list.find((f) => f.name?.toLowerCase() === "players.db");
  return {
    vehiclesFile: rootVehicles || anyVehicles || null,
    playersFile: rootPlayers || anyPlayers || null,
  };
}

export function SettingsPage() {
  const [config, setConfig] = useState<ConfigApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveFolder, setSaveFolder] = useState("");
  const [vehiclesPath, setVehiclesPath] = useState("");
  const [playersPath, setPlayersPath] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "processing" | "success" | "error"
  >("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [vehiclesFileName, setVehiclesFileName] = useState("");
  const [playersFileName, setPlayersFileName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);
  const vehiclesInputRef = useRef<HTMLInputElement>(null);
  const playersInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getConfig()
      .then((cfg) => {
        setConfig(cfg);
        setSaveFolder(cfg.saveFolder ?? "");
        setVehiclesPath(cfg.vehiclesDbPathOverride ?? "");
        setPlayersPath(cfg.playersDbPathOverride ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("idle");
    try {
      const cfg = await putConfig({
        saveFolder: saveFolder.trim() || undefined,
        vehiclesDbPath: vehiclesPath.trim() || undefined,
        playersDbPath: playersPath.trim() || undefined,
      });
      setConfig(cfg);
      setSaveMessage("Configuration saved. Database connections updated.");
      setSaveStatus("success");
    } catch (err) {
      setSaveMessage("Error: " + (err instanceof Error ? err.message : "Failed to save"));
      setSaveStatus("error");
    }
  };

  const handleFolderPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length) return;
    const { vehiclesFile, playersFile } = findDbFilesInFolder(files);
    if (!vehiclesFile || !playersFile) {
      alert("Folder must contain both vehicles.db and players.db. Only these two files are used.");
      return;
    }
    setUploadStatus("uploading");
    setUploadMessage("Uploading vehicles.db and players.db…");
    setVehiclesFileName("");
    setPlayersFileName("");
    try {
      const [vB64, pB64] = await Promise.all([
        fileToBase64(vehiclesFile),
        fileToBase64(playersFile),
      ]);
      setUploadMessage("Uploading vehicles.db…");
      await uploadVehicles(vB64);
      setUploadMessage("Uploading players.db…");
      await uploadPlayers(pB64);
      setUploadMessage("Syncing tables…");
      await postSync();
      setUploadMessage("Finished.");
      setUploadStatus("success");
      setVehiclesFileName("vehicles.db ✓");
      setPlayersFileName("players.db ✓");
      const cfg = await getConfig();
      setConfig(cfg);
      setSaveFolder(cfg.saveFolder ?? "");
      setVehiclesPath(cfg.vehiclesDbPathOverride ?? "");
      setPlayersPath(cfg.playersDbPathOverride ?? "");
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
      }, 2500);
    } catch (err) {
      setUploadStatus("idle");
      setVehiclesFileName("");
      setPlayersFileName("");
      alert("Failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleVehiclesFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file?.name?.toLowerCase().endsWith(".db")) {
      alert("Please select a .db file (e.g. vehicles.db).");
      return;
    }
    setUploadStatus("uploading");
    setUploadMessage("Uploading…");
    setVehiclesFileName("");
    try {
      const b64 = await fileToBase64(file);
      await uploadVehicles(b64);
      setUploadMessage("Syncing tables…");
      await postSync();
      setUploadMessage("Finished.");
      setUploadStatus("success");
      setVehiclesFileName(file.name + " ✓");
      const cfg = await getConfig();
      setConfig(cfg);
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
      }, 2500);
    } catch (err) {
      setUploadStatus("idle");
      setVehiclesFileName("");
      alert("Failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handlePlayersFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file?.name?.toLowerCase().endsWith(".db")) {
      alert("Please select a .db file (e.g. players.db).");
      return;
    }
    setUploadStatus("uploading");
    setUploadMessage("Uploading…");
    setPlayersFileName("");
    try {
      const b64 = await fileToBase64(file);
      await uploadPlayers(b64);
      setUploadMessage("Syncing tables…");
      await postSync();
      setUploadMessage("Finished.");
      setUploadStatus("success");
      setPlayersFileName(file.name + " ✓");
      const cfg = await getConfig();
      setConfig(cfg);
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
      }, 2500);
    } catch (err) {
      setUploadStatus("idle");
      setPlayersFileName("");
      alert("Failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Global configuration</h1>
      <p className="text-muted-foreground mb-5">
        Choose your Project Zomboid save files with the file picker, or enter a
        save folder path below and save.
      </p>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Current paths</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                <strong>Vehicles</strong>: {config?.vehiclesDbPath ?? "—"}
              </p>
              <p>
                <strong>Players</strong>: {config?.playersDbPath ?? "—"}
              </p>
            </CardContent>
          </Card>
          <form onSubmit={handleSaveConfig} className="space-y-5">
            <div className="space-y-2">
              <Label>Choose files (opens your file browser) or enter paths</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Path to vehicles.db (optional)"
                  value={vehiclesPath}
                  onChange={(e) => setVehiclesPath(e.target.value)}
                  className="max-w-md"
                />
                <input
                  ref={vehiclesInputRef}
                  type="file"
                  accept=".db"
                  className="hidden"
                  onChange={handleVehiclesFilePick}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => vehiclesInputRef.current?.click()}
                >
                  Choose vehicles.db
                </Button>
                <span className="text-sm text-muted-foreground">
                  {vehiclesFileName}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Path to players.db (optional)"
                  value={playersPath}
                  onChange={(e) => setPlayersPath(e.target.value)}
                  className="max-w-md"
                />
                <input
                  ref={playersInputRef}
                  type="file"
                  accept=".db"
                  className="hidden"
                  onChange={handlePlayersFilePick}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => playersInputRef.current?.click()}
                >
                  Choose players.db
                </Button>
                <span className="text-sm text-muted-foreground">
                  {playersFileName}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Type a path or use the button to pick a file. Use Save
                configuration to apply paths.
              </p>
            </div>
            {uploadStatus !== "idle" && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 text-sm">
                {(uploadStatus === "uploading" || uploadStatus === "processing") && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span>{uploadMessage}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="config-save-folder">Or: Save folder path (alternative)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="config-save-folder"
                  placeholder="e.g. C:\Users\You\Zomboid\Saves\Multiplayer\servertest"
                  value={saveFolder}
                  onChange={(e) => setSaveFolder(e.target.value)}
                  className="max-w-md"
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFolderPick}
                  {...({
                    webkitDirectory: true,
                  } as React.InputHTMLAttributes<HTMLInputElement>)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => folderInputRef.current?.click()}
                  title="Choose folder (opens file browser)"
                >
                  Choose folder
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pick a folder with the button (uploads vehicles.db and
                players.db, then syncs) or type a path and click Save
                configuration.
              </p>
            </div>
            <Button type="submit">Save configuration</Button>
          </form>
          {saveStatus === "success" && (
            <div className="mt-4 p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
              {saveMessage}
            </div>
          )}
          {saveStatus === "error" && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {saveMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
