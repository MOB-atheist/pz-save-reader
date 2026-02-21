const path = require("path");

const defaultSavePath =
    process.platform === "win32"
        ? path.join(process.env.USERPROFILE || "", "Zomboid", "Saves", "Multiplayer", "servertest")
        : path.join(process.env.HOME || "", "Zomboid", "Saves", "Multiplayer", "servertest");

const savePath = process.env.PZ_SAVE_PATH || defaultSavePath;

module.exports = {
    vehiclesDbPath: process.env.PZ_VEHICLES_DB || path.join(savePath, "vehicles.db"),
    playersDbPath: process.env.PZ_PLAYERS_DB || path.join(savePath, "players.db"),
    port: parseInt(process.env.PORT || "3000", 10),
};
