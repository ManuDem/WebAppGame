import { monitor } from "@colyseus/monitor";
import { OfficeRoom } from "./rooms/OfficeRoom";

export default {
    initializeGameServer: (gameServer: any) => {
        gameServer.define("office_room", OfficeRoom);
    },

    initializeExpress: (app: any) => {
        app.get("/health", (req: any, res: any) => {
            res.json({ status: "ok" });
        });

        app.use("/colyseus", monitor());
    },

    beforeListen: () => {
        /**
         * Before starting the HTTP listener, 
         * we can do some super-fast initialization.
         */
    }
};
