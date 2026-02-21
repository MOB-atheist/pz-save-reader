const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const os = require("os");
const { decodePzBuffer } = require("./lib/decode-pz-buffer");
const config = require("./config");
const runtimeConfig = require("./lib/runtime-config");
const cacheDb = require("./lib/cache-db");

const app = express();
const port = config.port;

app.use(express.json());

const SNAPSHOT_DIR = path.join(__dirname, "data", "snapshots");

function getPaths() {
    const raw = runtimeConfig.load();
    return runtimeConfig.getResolvedPaths(raw);
}

/**
 * Discover players table name and columns from an open SQLite DB (e.g. snapshot copy).
 * @param {object} db - Open sqlite3 Database instance
 * @returns {Promise<{ tableName: string, columns: string[] }>}
 */
function discoverPlayersTableFromDb(db) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND (name='networkPlayers' OR name='localPlayers') ORDER BY name",
            [],
            (err, rows) => {
                if (err) return reject(err);
                const tableName = rows.length ? rows[0].name : "networkPlayers";
                db.all(`PRAGMA table_info(${tableName})`, [], (e, cols) => {
                    if (e) return reject(e);
                    resolve({
                        tableName,
                        columns: (cols || []).map((c) => c.name),
                    });
                });
            }
        );
    });
}

/**
 * Copy game DBs to snapshot dir, open copies, sync into cache, then close and remove copies.
 * Avoids locking the game's files.
 * @param {Function} callback - (err) => void
 */
function syncFromSnapshots(callback) {
    const paths = getPaths();
    if (!paths) return callback(null);

    const vehiclesSnapshotPath = path.join(SNAPSHOT_DIR, "vehicles.db");
    const playersSnapshotPath = path.join(SNAPSHOT_DIR, "players.db");

    try {
        if (!fs.existsSync(path.dirname(SNAPSHOT_DIR))) {
            fs.mkdirSync(path.dirname(SNAPSHOT_DIR), { recursive: true });
        }
        if (!fs.existsSync(SNAPSHOT_DIR)) {
            fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
        }
        if (!fs.existsSync(paths.vehiclesDbPath)) {
            return callback(new Error("Vehicles DB not found: " + paths.vehiclesDbPath));
        }
        if (!fs.existsSync(paths.playersDbPath)) {
            return callback(new Error("Players DB not found: " + paths.playersDbPath));
        }
        fs.copyFileSync(paths.vehiclesDbPath, vehiclesSnapshotPath);
        fs.copyFileSync(paths.playersDbPath, playersSnapshotPath);
    } catch (e) {
        return callback(e);
    }

    let opened = 0;
    let openErr = null;

    function maybeRunSync() {
        if (openErr) return;
        opened++;
        if (opened !== 2) return;
        discoverPlayersTableFromDb(snapshotPlayersDb)
            .then(({ tableName, columns }) => {
                const cols = columns.length ? columns : ["id", "data"];
                cacheDb.syncVehicles(snapshotVehiclesDb, decodePzBuffer, (err) => {
                    if (err) return done(err);
                    cacheDb.syncPlayers(snapshotPlayersDb, tableName, cols, decodePzBuffer, (err2) => {
                        done(err2);
                    });
                });
            })
            .catch((e) => done(e));
    }

    function cleanupAndCallback(err) {
        try { fs.unlinkSync(vehiclesSnapshotPath); } catch (_) {}
        try { fs.unlinkSync(playersSnapshotPath); } catch (_) {}
        callback(err);
    }

    function done(syncErr) {
        snapshotVehiclesDb.close(() => {
            snapshotPlayersDb.close(() => cleanupAndCallback(syncErr));
        });
    }

    const snapshotVehiclesDb = new sqlite3.Database(vehiclesSnapshotPath, (err) => {
        if (err) {
            openErr = err;
            try { fs.unlinkSync(vehiclesSnapshotPath); } catch (_) {}
            try { fs.unlinkSync(playersSnapshotPath); } catch (_) {}
            return callback(err);
        }
        maybeRunSync();
    });
    const snapshotPlayersDb = new sqlite3.Database(playersSnapshotPath, (err) => {
        if (err) {
            openErr = err;
            snapshotVehiclesDb.close(() => {});
            try { fs.unlinkSync(vehiclesSnapshotPath); } catch (_) {}
            try { fs.unlinkSync(playersSnapshotPath); } catch (_) {}
            return callback(err);
        }
        maybeRunSync();
    });
}

// Static files (must be before catch-all so / and /players.html are served)
app.use(express.static(path.join(__dirname, "public")));

// --- API: Browse filesystem (for Settings path picker) ---
app.get("/api/browse", (req, res) => {
    try {
        let reqPath = (typeof req.query.path === "string" ? req.query.path : "").trim();
        const isWin = os.platform() === "win32";
        if (!reqPath) {
            if (isWin) {
                const drives = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                    .split("")
                    .map((d) => d + ":\\")
                    .filter((d) => {
                        try {
                            return fs.existsSync(d);
                        } catch {
                            return false;
                        }
                    });
                if (drives.length === 0) drives.push("C:\\");
                return res.json({
                    path: "",
                    entries: drives.map((d) => ({ name: d, isDirectory: true })),
                });
            }
            reqPath = "/";
        }
        const resolved = path.resolve(reqPath);
        if (!fs.existsSync(resolved)) {
            return res.status(404).json({ error: "Path not found" });
        }
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: "Not a directory" });
        }
        const entries = fs.readdirSync(resolved, { withFileTypes: true }).map((d) => ({
            name: d.name,
            isDirectory: d.isDirectory(),
        }));
        entries.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
        const parent = path.dirname(resolved);
        if (parent !== resolved) {
            entries.unshift({ name: "..", isDirectory: true });
        }
        res.json({ path: resolved, entries });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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
        const paths = getPaths();
        if (!paths) {
            cacheDb.clearCache(() => res.json(runtimeConfig.getConfigForApi()));
            return;
        }
        syncFromSnapshots((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(runtimeConfig.getConfigForApi());
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

// Ensure cache DB and tables exist before accepting requests
cacheDb.ensureReady((err) => {
    if (err) {
        console.error("Failed to initialize cache database:", err.message);
        process.exit(1);
    }
    app.listen(port, () => {
        console.log(`PZ Manager running at http://localhost:${port}`);
    });
});
