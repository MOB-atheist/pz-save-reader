const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { decodePzBuffer } = require("./lib/decode-pz-buffer");
const config = require("./config");
const runtimeConfig = require("./lib/runtime-config");

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
    if (paths) vehiclesDb = openVehiclesDb();
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
        res.json(runtimeConfig.getConfigForApi());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- API: Vehicles ---
app.get("/api/vehicles", (req, res) => {
    if (!getPaths()) return res.json([]);
    if (!vehiclesDb) vehiclesDb = openVehiclesDb();
    if (!vehiclesDb) return res.json([]);
    const sql = "SELECT id, x, y, data FROM vehicles";
    vehiclesDb.all(sql, [], (err, rows) => {
        if (err) {
            res.json([]);
            return;
        }
        const list = (rows || []).map((row) => {
            const decoded = decodePzBuffer(row.data, "vehicle");
            return {
                id: row.id,
                x: row.x != null ? Math.round(Number(row.x)) : null,
                y: row.y != null ? Math.round(Number(row.y)) : null,
                type: decoded.extracted.vehicleType || "Unknown",
                partCount: (decoded.extracted.partNames || []).length,
            };
        });
        res.json(list);
    });
});

app.get("/api/vehicles/:id", (req, res) => {
    if (!getPaths() || !vehiclesDb) {
        if (!vehiclesDb && getPaths()) vehiclesDb = openVehiclesDb();
        if (!vehiclesDb) return res.status(404).json({ error: "Vehicle not found" });
    }
    const id = req.params.id;
    vehiclesDb.get("SELECT id, x, y, data FROM vehicles WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(404).json({ error: "Vehicle not found" });
        if (!row) return res.status(404).json({ error: "Vehicle not found" });
        const decoded = decodePzBuffer(row.data, "vehicle");
        res.json({
            id: row.id,
            x: row.x != null ? Math.round(Number(row.x)) : null,
            y: row.y != null ? Math.round(Number(row.y)) : null,
            extracted: decoded.extracted,
            raw: decoded.raw,
        });
    });
});

// --- API: Players ---
app.get("/api/players", (req, res) => {
    if (!getPaths()) return res.json([]);
    ensurePlayersDb()
        .then(() => discoverPlayersTable())
        .then(() => {
            const cols = ["id", "data"];
            if (playersColumns.includes("x")) cols.push("x");
            if (playersColumns.includes("y")) cols.push("y");
            if (playersColumns.includes("z")) cols.push("z");
            const sql = `SELECT ${cols.join(", ")} FROM ${playersTableName}`;
            playersDb.all(sql, [], (err, rows) => {
                if (err) {
                    res.json([]);
                    return;
                }
                const list = (rows || []).map((row) => {
                    const decoded = decodePzBuffer(row.data, "player");
                    const names = decoded.extracted.characterNames || [];
                    const professions = decoded.extracted.professionIds || [];
                    const x = row.x != null ? Math.round(Number(row.x)) : null;
                    const y = row.y != null ? Math.round(Number(row.y)) : null;
                    return {
                        id: row.id,
                        name: names[0] || `Player ${row.id}`,
                        profession: professions[0] || null,
                        x,
                        y,
                        z: row.z != null ? Number(row.z) : null,
                    };
                });
                res.json(list);
            });
        })
        .catch(() => res.json([]));
});

app.get("/api/players/:id", (req, res) => {
    if (!getPaths()) return res.status(404).json({ error: "Player not found" });
    ensurePlayersDb()
        .then(() => discoverPlayersTable())
        .then(() => {
            const id = req.params.id;
            const cols = ["id", "data"];
            if (playersColumns.includes("x")) cols.push("x");
            if (playersColumns.includes("y")) cols.push("y");
            if (playersColumns.includes("z")) cols.push("z");
            const sql = `SELECT ${cols.join(", ")} FROM ${playersTableName} WHERE id = ?`;
            playersDb.get(sql, [id], (err, row) => {
                if (err) return res.status(404).json({ error: "Player not found" });
                if (!row) return res.status(404).json({ error: "Player not found" });
                const decoded = decodePzBuffer(row.data, "player");
                res.json({
                    id: row.id,
                    x: row.x != null ? Math.round(Number(row.x)) : null,
                    y: row.y != null ? Math.round(Number(row.y)) : null,
                    z: row.z != null ? Number(row.z) : null,
                    extracted: decoded.extracted,
                    raw: decoded.raw,
                });
            });
        })
        .catch(() => res.status(404).json({ error: "Player not found" }));
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
