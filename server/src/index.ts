import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'colyseus';
import { configureGameServer, configureMonitoring } from './bootstrap/configureServer';

const PORT = Number(process.env.PORT) || 2567;
const app = express();

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
console.log('[BOOT] HTTP server created');

const gameServer = new Server({
    server: httpServer,
    greet: false,
});
console.log('[BOOT] Colyseus Server instance created');

configureGameServer(gameServer);
console.log("[BOOT] Registered room 'office_room' with shared bootstrap config");

configureMonitoring(app);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[ERROR] Unhandled Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

gameServer.listen(PORT).then(() => {
    console.log('[BOOT] Server is running');
    console.log(`[BOOT] HTTP http://localhost:${PORT}`);
    console.log(`[BOOT] WS ws://localhost:${PORT}`);
    console.log(`[BOOT] Monitor http://localhost:${PORT}/colyseus`);
});
