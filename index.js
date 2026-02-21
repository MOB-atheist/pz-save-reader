const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { decodePzBuffer } = require("./lib/decode-pz-buffer");
const config = require("./config");

const app = express();
const port = config.port;

// Database connections
const vehiclesDb = new sqlite3.Database(config.vehiclesDbPath, (err) => {
    if (err) console.error("Error opening vehicles DB:", err.message);
    else console.log("Connected to vehicles DB:", config.vehiclesDbPath);
});

let playersDb = null;
let playersTableName = null;
let playersColumns = ["id", "data"];

function ensurePlayersDb() {
    if (playersDb) return Promise.resolve();
    return new Promise((resolve, reject) => {
        playersDb = new sqlite3.Database(config.playersDbPath, (err) => {
            if (err) {
                console.error("Error opening players DB:", err.message);
                reject(err);
                return;
            }
            console.log("Connected to players DB:", config.playersDbPath);
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

// --- API: Vehicles ---
app.get("/api/vehicles", (req, res) => {
    const sql = "SELECT id, x, y, data FROM vehicles";
    vehiclesDb.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
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
    const id = req.params.id;
    vehiclesDb.get("SELECT id, x, y, data FROM vehicles WHERE id = ?", [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: "Vehicle not found" });
            return;
        }
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
    ensurePlayersDb()
        .then(() => discoverPlayersTable())
        .then(() => {
            const hasCoord = playersColumns.some((c) => c.toLowerCase() === "x" || c.toLowerCase() === "y");
            const cols = ["id", "data"];
            if (playersColumns.includes("x")) cols.push("x");
            if (playersColumns.includes("y")) cols.push("y");
            if (playersColumns.includes("z")) cols.push("z");
            const sql = `SELECT ${cols.join(", ")} FROM ${playersTableName}`;
            playersDb.all(sql, [], (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
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
        .catch((e) => res.status(500).json({ error: e.message }));
});

app.get("/api/players/:id", (req, res) => {
    const id = req.params.id;
    ensurePlayersDb()
        .then(() => discoverPlayersTable())
        .then(() => {
            const cols = ["id", "data"];
            if (playersColumns.includes("x")) cols.push("x");
            if (playersColumns.includes("y")) cols.push("y");
            if (playersColumns.includes("z")) cols.push("z");
            const sql = `SELECT ${cols.join(", ")} FROM ${playersTableName} WHERE id = ?`;
            playersDb.get(sql, [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                if (!row) {
                    res.status(404).json({ error: "Player not found" });
                    return;
                }
                const decoded = decodePzBuffer(row.data, "player");
                const out = {
                    id: row.id,
                    x: row.x != null ? Math.round(Number(row.x)) : null,
                    y: row.y != null ? Math.round(Number(row.y)) : null,
                    z: row.z != null ? Number(row.z) : null,
                    extracted: decoded.extracted,
                    raw: decoded.raw,
                };
                res.json(out);
            });
        })
        .catch((e) => res.status(500).json({ error: e.message }));
});

// SPA fallback: serve index.html for non-API routes so / and /players work with client-side routing
app.get("/vehicles", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/players", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
    console.log(`PZ Manager running at http://localhost:${port}`);
});
