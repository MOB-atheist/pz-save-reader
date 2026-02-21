const fs = require("fs");
const path = require("path");

const configFileName = "pz-manager-config.json";
const configPath = path.join(__dirname, "..", configFileName);

const defaultConfig = require("../config");

/**
 * Resolve effective DB paths from saved config (saveFolder and/or explicit paths).
 * @param {{ saveFolder?: string, vehiclesDbPath?: string, playersDbPath?: string } | null} raw
 * @returns {{ saveFolder: string | null, vehiclesDbPath: string, playersDbPath: string }}
 */
function getResolvedPaths(raw) {
    if (raw == null || typeof raw !== "object") raw = {};
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
    fs.writeFileSync(configPath, JSON.stringify(toWrite, null, 2), "utf8");
}

/**
 * Get current config for API (raw from file + resolved paths).
 */
function getConfigForApi() {
    const raw = load();
    const resolved = getResolvedPaths(raw);
    return {
        saveFolder: resolved.saveFolder || "",
        vehiclesDbPath: resolved.vehiclesDbPath,
        playersDbPath: resolved.playersDbPath,
        vehiclesDbPathOverride: (raw && raw.vehiclesDbPath) || "",
        playersDbPathOverride: (raw && raw.playersDbPath) || "",
    };
}

module.exports = {
    getResolvedPaths,
    load,
    save,
    getConfigForApi,
    configPath,
};
