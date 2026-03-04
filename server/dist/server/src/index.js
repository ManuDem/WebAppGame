"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const colyseus_1 = require("colyseus");
const monitor_1 = require("@colyseus/monitor");
const OfficeRoom_1 = require("./rooms/OfficeRoom");
// ─────────────────────────────────────────────────────────
//  Server Configuration
// ─────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 2567;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ─────────────────────────────────────────────────────────
//  Create Colyseus Server
// ─────────────────────────────────────────────────────────
const httpServer = http_1.default.createServer(app);
console.log("[BOOT] HTTP server created");
const gameServer = new colyseus_1.Server({
    server: httpServer,
    greet: false,
});
console.log("[BOOT] Colyseus Server instance created");
// ─────────────────────────────────────────────────────────
//  Register Rooms
// ─────────────────────────────────────────────────────────
gameServer.define("office_room", OfficeRoom_1.OfficeRoom)
    .filterBy(["roomCode"])
    .enableRealtimeListing();
console.log("[BOOT] Registered room 'office_room' with OfficeRoom handler");
// ─────────────────────────────────────────────────────────
//  Dev Dashboard (optional, available at /colyseus)
// ─────────────────────────────────────────────────────────
app.use("/colyseus", (0, monitor_1.monitor)());
// ─────────────────────────────────────────────────────────
//  Health Check Endpoint
// ─────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// ─────────────────────────────────────────────────────────
//  Basic Express error handler (logs stacktraces)
// ─────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("[ERROR] Unhandled Express error:", err);
    res.status(500).json({ error: "Internal server error" });
});
// ─────────────────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────────────────
gameServer.listen(PORT).then(() => {
    console.log(`\n🏢 ══════════════════════════════════════════════`);
    console.log(`   LUCrAre: SEMPRE — Server is running`);
    console.log(`   🌐 HTTP ···· http://localhost:${PORT}`);
    console.log(`   🎮 WS ······ ws://localhost:${PORT}`);
    console.log(`   📊 Monitor · http://localhost:${PORT}/colyseus`);
    console.log(`══════════════════════════════════════════════════\n`);
    console.log(`[BOOT] Listening on http://localhost:${PORT} (PORT=${PORT})`);
});
//# sourceMappingURL=index.js.map