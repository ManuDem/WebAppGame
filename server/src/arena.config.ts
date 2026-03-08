import { configureGameServer, configureMonitoring } from './bootstrap/configureServer';

export default {
    initializeGameServer: (gameServer: any) => {
        configureGameServer(gameServer);
    },

    initializeExpress: (app: any) => {
        configureMonitoring(app);
    },

    beforeListen: () => {
        // Shared bootstrap keeps all runtime wiring in one place.
    },
};
