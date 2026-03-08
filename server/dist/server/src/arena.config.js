"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configureServer_1 = require("./bootstrap/configureServer");
exports.default = {
    initializeGameServer: (gameServer) => {
        (0, configureServer_1.configureGameServer)(gameServer);
    },
    initializeExpress: (app) => {
        (0, configureServer_1.configureMonitoring)(app);
    },
    beforeListen: () => {
        // Shared bootstrap keeps all runtime wiring in one place.
    },
};
//# sourceMappingURL=arena.config.js.map