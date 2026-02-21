import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 3000;

/** @type {import("electron").BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    mainWindow.loadURL(`http://localhost:${PORT}`);
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
    process.exit(0);
}

app.on("second-instance", () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(async () => {
    process.env.PZ_MANAGER_USER_DATA = app.getPath("userData");

    const { start } = await import("./lib/app-server.js");
    await start(PORT);

    createWindow();

    app.on("window-all-closed", () => {
        app.quit();
    });
});
