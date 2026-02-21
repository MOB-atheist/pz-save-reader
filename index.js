const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { decodePzBuffer } = require("./lib/decode-pz-buffer");
const config = require("./config");
const runtimeConfig = require("./lib/runtime-config");
const cacheDb = require("./lib/cache-db");

const app = express();
const port = config.port;

app.use(express.json());

// Database connections (reopened when config changes)
let vehiclesDb = null;
let playersDb = null;
let playersTableName = null;
let playersColumns = ["id", "data"];

function getPaths() {
    const raw = runtimeConfig.load();
    return runtimeConfig.getResolvedPaths(raw);
}

function openVehiclesDb() {
    const paths = getPaths();
    if (!paths) return null;
    return new sqlite3.Database(paths.vehiclesDbPath, (err) => {
        if (err) console.error("Error opening vehicles DB:", err.message);
        else console.log("Connected to vehicles DB:", paths.vehiclesDbPath);
    });
}

function openPlayersDb() {
    const paths = getPaths();
    if (!paths) return null;
    return new sqlite3.Database(paths.playersDbPath, (err) => {
        if (err) {
            console.error("Error opening players DB:", err.message);
            return;
        }
        console.log("Connected to players DB:", paths.playersDbPath);
    });
}

function closeVehiclesDb() {
    if (vehiclesDb) {
        try {
            vehiclesDb.close();
        } catch (e) {
            // ignore
        }
        vehiclesDb = null;
    }
}

function closePlayersDb() {
    if (playersDb) {
        try {
            playersDb.close();
        } catch (e) {
            // ignore
        }
        playersDb = null;
        playersTableName = null;
    }
}

function reconnectDbs() {
    closeVehiclesDb();
    closePlayersDb();
    const paths = getPaths();
    if (paths) {
        vehiclesDb = openVehiclesDb();
        playersDb = openPlayersDb();
    }
}

// No DB at startup; connections are opened when config exists and API is used

function ensurePlayersDb() {
    if (playersDb) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
        playersDb = openPlayersDb();
        if (!playersDb) {
            reject(new Error("Could not open players DB"));
            return;
        }
        playersDb.get("SELECT 1", [], (err) => {
            if (err) {
                playersDb = null;
                reject(err);
                return;
            }
            resolve(undefined);
        });
    });
}

function discoverPlayersTable() {
    if (playersTableName) return Promise.resolve(playersTableName);
    return new Promise((resolve, reject) => {
        playersDb.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND (name='networkPlayers' OR name='localPlayers') ORDER BY name",
            [],
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (rows.length) {
                    playersTableName = rows[0].name;
                    playersDb.all(
                        `PRAGMA table_info(${playersTableName})`,
                        [],
                        (e, cols) => {
                            if (!e && cols.length) {
                                playersColumns = cols.map((c) => c.name);
                            }
                            resolve(playersTableName);
                        }
                    );
                } else {
                    playersTableName = "networkPlayers";
                    resolve(playersTableName);
                }
            }
        );
    });
}

// Static files (must be before catch-all so / and /players.html are served)
app.use(express.static(path.join(__dirname, "public")));

// --- API: Config (global settings) ---
app.get("/api/config", (req, res) => {
    try {
        res.json(runtimeConfig.getConfigForApi());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put("/api/config", (req, res) => {
    try {
        const body = req.body || {};
        runtimeConfig.save({
            saveFolder: body.saveFolder,
            vehiclesDbPath: body.vehiclesDbPath,
            playersDbPath: body.playersDbPath,
        });
        reconnectDbs();
        const paths = getPaths();
        if (!paths || !vehiclesDb) {
            cacheDb.clearCache(() => res.json(runtimeConfig.getConfigForApi()));
            return;
        }
        cacheDb.syncVehicles(vehiclesDb, decodePzBuffer, (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!playersDb) {
                return res.json(runtimeConfig.getConfigForApi());
            }
            discoverPlayersTable()
                .then(() => {
                    cacheDb.syncPlayers(playersDb, playersTableName, playersColumns, decodePzBuffer, (err2) => {
                        if (err2) return res.status(500).json({ error: err2.message });
                        res.json(runtimeConfig.getConfigForApi());
                    });
                })
                .catch((e) => res.status(500).json({ error: e.message }));
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- API: Vehicles (from cache; no decode on request) ---
app.get("/api/vehicles", (req, res) => {
    cacheDb.getVehicles((err, list) => {
        if (err) return res.json([]);
        res.json(list || []);
    });
});

app.get("/api/vehicles/:id", (req, res) => {
    const id = req.params.id;
    cacheDb.getVehicleById(id, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Vehicle not found" });
        res.json(row);
    });
});

// --- API: Players (from cache; no decode on request) ---
app.get("/api/players", (req, res) => {
    cacheDb.getPlayers((err, list) => {
        if (err) return res.json([]);
        res.json(list || []);
    });
});

app.get("/api/players/:id", (req, res) => {
    const id = req.params.id;
    cacheDb.getPlayerById(id, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Player not found" });
        res.json(row);
    });
});

// SPA fallback: serve index.html for non-API routes
app.get("/vehicles", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/players", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/settings", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
    console.log(`PZ Manager running at http://localhost:${port}`);
});
