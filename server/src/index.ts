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
const gameServer = new Server({
    server: httpServer,
    greet: false,
});

// ─────────────────────────────────────────────────────────
//  Register Rooms
// ─────────────────────────────────────────────────────────
gameServer.define("office_room", OfficeRoom)
    .enableRealtimeListing();

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
//  Boot
// ─────────────────────────────────────────────────────────
gameServer.listen(PORT).then(() => {
    console.log(`\n🏢 ══════════════════════════════════════════════`);
    console.log(`   LUCrAre: SEMPRE — Server is running`);
    console.log(`   🌐 HTTP ···· http://localhost:${PORT}`);
    console.log(`   🎮 WS ······ ws://localhost:${PORT}`);
    console.log(`   📊 Monitor · http://localhost:${PORT}/colyseus`);
    console.log(`══════════════════════════════════════════════════\n`);
});
