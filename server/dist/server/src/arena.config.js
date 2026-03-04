"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const monitor_1 = require("@colyseus/monitor");
const OfficeRoom_1 = require("./rooms/OfficeRoom");
exports.default = {
    initializeGameServer: (gameServer) => {
        gameServer.define("office_room", OfficeRoom_1.OfficeRoom);
    },
    initializeExpress: (app) => {
        app.get("/health", (req, res) => {
            res.json({ status: "ok" });
        });
        app.use("/colyseus", (0, monitor_1.monitor)());
    },
    beforeListen: () => {
        /**
         * Before starting the HTTP listener,
         * we can do some super-fast initialization.
         */
    }
};
//# sourceMappingURL=arena.config.js.map