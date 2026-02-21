import config from "./config.js";
import { start } from "./lib/app-server.js";

start(config.port)
    .then((server) => {
        const addr = server.address();
        const port = addr ? addr.port : config.port;
        console.log(`PZ Manager running at http://localhost:${port}`);
    })
    .catch((err) => {
        console.error("Failed to start server:", err.message);
        process.exit(1);
    });
