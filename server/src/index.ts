import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { OfficeRoom } from "./rooms/OfficeRoom";

// ─────────────────────────────────────────────────────────
//  Server Configuration
// ─────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 2567;
const app = express();

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────
//  Create Colyseus Server
// ─────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
console.log("[BOOT] HTTP server created");

const gameServer = new Server({
    server: httpServer,
    greet: false,
});
console.log("[BOOT] Colyseus Server instance created");

// ─────────────────────────────────────────────────────────
//  Register Rooms
// ─────────────────────────────────────────────────────────
gameServer.define("office_room", OfficeRoom)
    .enableRealtimeListing();
console.log("[BOOT] Registered room 'office_room' with OfficeRoom handler");

// ─────────────────────────────────────────────────────────
//  Dev Dashboard (optional, available at /colyseus)
// ─────────────────────────────────────────────────────────
app.use("/colyseus", monitor());

// ─────────────────────────────────────────────────────────
//  Health Check Endpoint
// ─────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────
//  Basic Express error handler (logs stacktraces)
// ─────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
