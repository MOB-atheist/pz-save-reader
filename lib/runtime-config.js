import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import defaultConfig from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configFileName = "pz-manager-config.json";

/**
 * Base directory for writable app data (config, cache, data/snapshots, data/source).
 * When PZ_MANAGER_USER_DATA is set (e.g. by Electron), use that; otherwise project root.
 */
function getAppBaseDir() {
    return process.env.PZ_MANAGER_USER_DATA || path.join(__dirname, "..");
}

function getConfigPath() {
    return path.join(getAppBaseDir(), configFileName);
}

/**
 * Resolve effective DB paths from saved config (saveFolder and/or explicit paths).
 * Returns null when raw is null (no config file) so the app can start without DBs.
 * @param {{ saveFolder?: string, vehiclesDbPath?: string, playersDbPath?: string } | null} raw
 * @returns {{ saveFolder: string | null, vehiclesDbPath: string, playersDbPath: string } | null}
 */
function getResolvedPaths(raw) {
    if (raw == null || typeof raw !== "object") return null;
    const saveFolder =
        typeof raw.saveFolder === "string" && raw.saveFolder.trim()
            ? path.normalize(raw.saveFolder.trim())
            : null;

    const vehiclesDbPath =
        typeof raw.vehiclesDbPath === "string" && raw.vehiclesDbPath.trim()
            ? path.normalize(raw.vehiclesDbPath.trim())
            : saveFolder
              ? path.join(saveFolder, "vehicles.db")
              : defaultConfig.vehiclesDbPath;

    const playersDbPath =
        typeof raw.playersDbPath === "string" && raw.playersDbPath.trim()
            ? path.normalize(raw.playersDbPath.trim())
            : saveFolder
              ? path.join(saveFolder, "players.db")
              : defaultConfig.playersDbPath;

    return {
        saveFolder,
        vehiclesDbPath,
        playersDbPath,
    };
}

/**
 * Load config from file. Returns null if file missing or invalid.
 */
function load() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) return null;
        const data = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(data);
        return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Save config to file. Values can be saveFolder, vehiclesDbPath, playersDbPath (all optional).
 * @param {{ saveFolder?: string, vehiclesDbPath?: string, playersDbPath?: string }} obj
 */
function save(obj) {
    const toWrite = {
        saveFolder: typeof obj.saveFolder === "string" ? obj.saveFolder.trim() || undefined : undefined,
        vehiclesDbPath: typeof obj.vehiclesDbPath === "string" ? obj.vehiclesDbPath.trim() || undefined : undefined,
        playersDbPath: typeof obj.playersDbPath === "string" ? obj.playersDbPath.trim() || undefined : undefined,
    };
    fs.writeFileSync(getConfigPath(), JSON.stringify(toWrite, null, 2), "utf8");
}

/**
 * Get current config for API (raw from file + resolved paths).
 * When no config file exists, returns empty strings so Settings page can load.
 */
function getConfigForApi() {
    const raw = load();
    const resolved = getResolvedPaths(raw);
    return {
        saveFolder: (resolved && resolved.saveFolder) || "",
        vehiclesDbPath: (resolved && resolved.vehiclesDbPath) || "",
        playersDbPath: (resolved && resolved.playersDbPath) || "",
        vehiclesDbPathOverride: (raw && raw.vehiclesDbPath) || "",
        playersDbPathOverride: (raw && raw.playersDbPath) || "",
    };
}

export {
    getAppBaseDir,
    getResolvedPaths,
    load,
    save,
    getConfigForApi,
    getConfigPath,
};
