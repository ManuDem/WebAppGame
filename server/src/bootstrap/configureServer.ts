import type express from 'express';
import type { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import { OfficeRoom } from '../rooms/OfficeRoom';

export function configureGameServer(gameServer: Server): void {
    gameServer.define('office_room', OfficeRoom)
        .filterBy(['roomCode'])
        .enableRealtimeListing();
}

export function configureMonitoring(app: express.Application): void {
    app.use('/colyseus', monitor());
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
}
