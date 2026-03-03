import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/arena.config";

describe("Room Connection and Validation Directives (Feature 01)", () => {
    let colyseus: ColyseusTestServer;

    beforeAll(async () => {
        colyseus = await boot(appConfig);
    });

    afterAll(async () => {
        await colyseus.shutdown();
    });

    beforeEach(async () => {
        await colyseus.cleanup();
    });

    test("Deve rifiutare la connessione se ceoName manca", async () => {
        await expect(
            colyseus.sdk.joinOrCreate("office_room", {}) // No ceoName provided
        ).rejects.toThrow();
    });

    test("Deve rifiutare la connessione se ceoName è una stringa vuota", async () => {
        await expect(
            colyseus.sdk.joinOrCreate("office_room", { ceoName: "" })
        ).rejects.toThrow();
    });

    test("Deve rifiutare la connessione se ceoName è troppo corto (< 3)", async () => {
        await expect(
            colyseus.sdk.joinOrCreate("office_room", { ceoName: "Ab" })
        ).rejects.toThrow();
    });

    test("Deve rifiutare la connessione se ceoName è troppo lungo (> 15)", async () => {
        await expect(
            colyseus.sdk.joinOrCreate("office_room", { ceoName: "QuestoNomeEVeramenteTroppoLungo" })
        ).rejects.toThrow();
    });

    test("Deve accettare la connessione se ceoName è valido", async () => {
        const client = await colyseus.sdk.joinOrCreate("office_room", { ceoName: "ValidCEO" });
        expect(client.sessionId).toBeDefined();

        // Verifichiamo anche che il nome sia stato salvato nello stato (opzionale ma consigliato)
        const player = client.state.players.get(client.sessionId);
        expect(player).toBeDefined();
        expect(player.username).toBe("ValidCEO");
    });

    test("Deve rifiutare l'undicesima connessione (limite 10 giocatori)", async () => {
        // Connettiamo 10 client validi
        const clients = [];
        for (let i = 0; i < 10; i++) {
            const client = await colyseus.sdk.joinOrCreate("office_room", { ceoName: `CEO_${i}` });
            clients.push(client);
        }

        expect(clients.length).toBe(10); // Abbiamo 10 giocatori

        // Il 11esimo tentativo deve fallire
        await expect(
            colyseus.sdk.joinOrCreate("office_room", { ceoName: "Undicesimo" })
        ).rejects.toThrow();
    });
});
