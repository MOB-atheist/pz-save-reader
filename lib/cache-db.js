const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const cacheDbPath = path.join(__dirname, "..", "pz-manager-cache.db");
let db = null;

/**
 * Ensure the cache DB file and directory exist so SQLite can create the DB.
 */
function ensureCacheDir() {
    const dir = path.dirname(cacheDbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function getDb(callback) {
    if (db) return callback(null, db);
    ensureCacheDir();
    db = new sqlite3.Database(cacheDbPath, (err) => {
        if (err) return callback(err);
        initTables(db, callback);
    });
}

/**
 * Call at startup so the cache DB and tables exist before any request.
 * @param {Function} callback - (err) => void
 */
function ensureReady(callback) {
    getDb((err) => (callback ? callback(err) : null));
}

function initTables(database, callback) {
    database.run(
        `CREATE TABLE IF NOT EXISTS cache_vehicles (
            id INTEGER PRIMARY KEY,
            x REAL,
            y REAL,
            type TEXT,
            part_count INTEGER,
            extracted_json TEXT,
            raw_json TEXT
        )`,
        [],
        (err) => {
            if (err) return callback(err);
            database.run(
                `CREATE TABLE IF NOT EXISTS cache_players (
                    id INTEGER PRIMARY KEY,
                    x REAL,
                    y REAL,
                    z REAL,
                    name TEXT,
                    profession TEXT,
                    extracted_json TEXT,
                    raw_json TEXT
                )`,
                [],
                callback
            );
        }
    );
}

/**
 * Sync vehicles from PZ DB into cache. Decodes each row once and stores.
 * @param {sqlite3.Database} vehiclesDb - Open PZ vehicles DB
 * @param {Function} decodePzBuffer - (buf, 'vehicle') => { extracted, raw }
 * @param {Function} callback - (err) => void
 */
function syncVehicles(vehiclesDb, decodePzBuffer, callback) {
    getDb((err, database) => {
        if (err) return callback(err);
        vehiclesDb.all("SELECT id, x, y, data FROM vehicles", [], (err, rows) => {
            if (err) return callback(err);
            database.run("DELETE FROM cache_vehicles", [], (err) => {
                if (err) return callback(err);
                if (!rows || rows.length === 0) return callback(null);
                const stmt = database.prepare(
                    "INSERT INTO cache_vehicles (id, x, y, type, part_count, extracted_json, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
                );
                let done = 0;
                const total = rows.length;
                function next() {
                    if (done === total) {
                        stmt.finalize(() => callback(null));
                        return;
                    }
                    const row = rows[done];
                    const decoded = decodePzBuffer(row.data, "vehicle");
                    const type = (decoded.extracted && decoded.extracted.vehicleType) || "Unknown";
                    const partCount = (decoded.extracted && decoded.extracted.partNames && decoded.extracted.partNames.length) || 0;
                    const extractedJson = JSON.stringify(decoded.extracted || {});
                    const rawJson = JSON.stringify(decoded.raw || []);
                    stmt.run(
                        [row.id, row.x, row.y, type, partCount, extractedJson, rawJson],
                        () => {
                            done++;
                            next();
                        }
                    );
                }
                next();
            });
        });
    });
}

/**
 * Sync players from PZ DB into cache.
 * @param {sqlite3.Database} playersDb - Open PZ players DB
 * @param {string} tableName - e.g. 'networkPlayers' or 'localPlayers'
 * @param {string[]} columns - e.g. ['id','data','x','y','z']
 * @param {Function} decodePzBuffer - (buf, 'player') => { extracted, raw }
 * @param {Function} callback - (err) => void
 */
function syncPlayers(playersDb, tableName, columns, decodePzBuffer, callback) {
    getDb((err, database) => {
        if (err) return callback(err);
        const cols = ["id", "data"];
        if (columns.includes("x")) cols.push("x");
        if (columns.includes("y")) cols.push("y");
        if (columns.includes("z")) cols.push("z");
        const sql = `SELECT ${cols.join(", ")} FROM ${tableName}`;
        playersDb.all(sql, [], (err, rows) => {
            if (err) return callback(err);
            database.run("DELETE FROM cache_players", [], (err) => {
                if (err) return callback(err);
                if (!rows || rows.length === 0) return callback(null);
                const stmt = database.prepare(
                    "INSERT INTO cache_players (id, x, y, z, name, profession, extracted_json, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                );
                let done = 0;
                const total = rows.length;
                function next() {
                    if (done === total) {
                        stmt.finalize(() => callback(null));
                        return;
                    }
                    const row = rows[done];
                    const decoded = decodePzBuffer(row.data, "player");
                    const names = (decoded.extracted && decoded.extracted.characterNames) || [];
                    const professions = (decoded.extracted && decoded.extracted.professionIds) || [];
                    const name = names[0] || `Player ${row.id}`;
                    const profession = professions[0] || null;
                    const x = row.x != null ? Number(row.x) : null;
                    const y = row.y != null ? Number(row.y) : null;
                    const z = row.z != null ? Number(row.z) : null;
                    const extractedJson = JSON.stringify(decoded.extracted || {});
                    const rawJson = JSON.stringify(decoded.raw || []);
                    stmt.run(
                        [row.id, x, y, z, name, profession, extractedJson, rawJson],
                        () => {
                            done++;
                            next();
                        }
                    );
                }
                next();
            });
        });
    });
}

function getVehicles(callback) {
    getDb((err, database) => {
        if (err) return callback(err);
        database.all("SELECT id, x, y, type, part_count FROM cache_vehicles ORDER BY id", [], (err, rows) => {
            if (err) return callback(err);
            const list = (rows || []).map((r) => ({
                id: r.id,
                x: r.x != null ? Math.round(Number(r.x)) : null,
                y: r.y != null ? Math.round(Number(r.y)) : null,
                type: r.type || "Unknown",
                partCount: r.part_count != null ? r.part_count : 0,
            }));
            callback(null, list);
        });
    });
}

function getVehicleById(id, callback) {
    getDb((err, database) => {
        if (err) return callback(err);
        database.get("SELECT id, x, y, extracted_json, raw_json FROM cache_vehicles WHERE id = ?", [id], (err, row) => {
            if (err) return callback(err);
            if (!row) return callback(null, null);
            let extracted = {};
            let raw = [];
            try {
                if (row.extracted_json) extracted = JSON.parse(row.extracted_json);
                if (row.raw_json) raw = JSON.parse(row.raw_json);
            } catch (_) {}
            callback(null, {
                id: row.id,
                x: row.x != null ? Math.round(Number(row.x)) : null,
                y: row.y != null ? Math.round(Number(row.y)) : null,
                extracted,
                raw,
            });
        });
    });
}

function getPlayers(callback) {
    getDb((err, database) => {
        if (err) return callback(err);
        database.all("SELECT id, x, y, z, name, profession FROM cache_players ORDER BY id", [], (err, rows) => {
            if (err) return callback(err);
            const list = (rows || []).map((r) => ({
                id: r.id,
                name: r.name || `Player ${r.id}`,
                profession: r.profession || null,
                x: r.x != null ? Math.round(Number(r.x)) : null,
                y: r.y != null ? Math.round(Number(r.y)) : null,
                z: r.z != null ? Number(r.z) : null,
            }));
            callback(null, list);
        });
    });
}

function getPlayerById(id, callback) {
    getDb((err, database) => {
        if (err) return callback(err);
        database.get("SELECT id, x, y, z, extracted_json, raw_json FROM cache_players WHERE id = ?", [id], (err, row) => {
            if (err) return callback(err);
            if (!row) return callback(null, null);
            let extracted = {};
            let raw = [];
            try {
                if (row.extracted_json) extracted = JSON.parse(row.extracted_json);
                if (row.raw_json) raw = JSON.parse(row.raw_json);
            } catch (_) {}
            callback(null, {
                id: row.id,
                x: row.x != null ? Math.round(Number(row.x)) : null,
                y: row.y != null ? Math.round(Number(row.y)) : null,
                z: row.z != null ? Number(row.z) : null,
                extracted,
                raw,
            });
        });
    });
}

function clearCache(callback) {
    getDb((err, database) => {
        if (err) return callback(err);
        database.run("DELETE FROM cache_vehicles", [], (err) => {
            if (err) return callback(err);
            database.run("DELETE FROM cache_players", [], callback);
        });
    });
}

module.exports = {
    cacheDbPath,
    ensureReady,
    syncVehicles,
    syncPlayers,
    clearCache,
    getVehicles,
    getVehicleById,
    getPlayers,
    getPlayerById,
};
