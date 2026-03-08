"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const colyseus_1 = require("colyseus");
const configureServer_1 = require("./bootstrap/configureServer");
const PORT = Number(process.env.PORT) || 2567;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const httpServer = http_1.default.createServer(app);
console.log('[BOOT] HTTP server created');
const gameServer = new colyseus_1.Server({
    server: httpServer,
    greet: false,
});
console.log('[BOOT] Colyseus Server instance created');
(0, configureServer_1.configureGameServer)(gameServer);
console.log("[BOOT] Registered room 'office_room' with shared bootstrap config");
(0, configureServer_1.configureMonitoring)(app);
app.use((err, _req, res, _next) => {
    console.error('[ERROR] Unhandled Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
gameServer.listen(PORT).then(() => {
    console.log('[BOOT] Server is running');
    console.log(`[BOOT] HTTP http://localhost:${PORT}`);
    console.log(`[BOOT] WS ws://localhost:${PORT}`);
    console.log(`[BOOT] Monitor http://localhost:${PORT}/colyseus`);
});
//# sourceMappingURL=index.js.map