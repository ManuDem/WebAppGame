import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/arena.config";
import { ClientMessages, GamePhase, ServerEvents, IErrorEvent } from "../shared/SharedTypes";

describe("Core Loop - Turn Validation & Cheat Prevention", () => {
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

    test("1. Deve rifiutare DRAW_CARD se non è il turno del giocatore", async () => {
        // Connettiamo 3 giocatori per far avviare la partita
        const clientA = await colyseus.sdk.joinOrCreate("office_room", { ceoName: "CEO_A" });
        const clientB = await colyseus.sdk.joinOrCreate("office_room", { ceoName: "CEO_B" });
        const clientC = await colyseus.sdk.joinOrCreate("office_room", { ceoName: "CEO_C" });

        // Aspettiamo che il server cambi fase a PLAYER_TURN
        await new Promise((resolve) => setTimeout(resolve, 200));

        const state = clientA.state;
        expect(state.phase).toBe(GamePhase.PLAYER_TURN);

        const currentTurnId = state.currentTurnPlayerId;

        // Troviamo un client che NON è di turno
        let notMyTurnClient;
        if (clientA.sessionId !== currentTurnId) notMyTurnClient = clientA;
        else if (clientB.sessionId !== currentTurnId) notMyTurnClient = clientB;
        else notMyTurnClient = clientC;

        // Ascoltiamo l'evento di errore in entrata
        let errorReceived = false;
        notMyTurnClient.onMessage(ServerEvents.ERROR, (message: IErrorEvent) => {
            expect(message.code).toBe("NOT_YOUR_TURN");
            errorReceived = true;
        });

        // Il giocatore non di turno tenta di pescare
        notMyTurnClient.send(ClientMessages.DRAW_CARD, {});

        // Aspettiamo la risposta del server
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verifichiamo di aver ricevuto l'errore e che i PA non siano stati toccati
        expect(errorReceived).toBe(true);
        expect(state.players.get(notMyTurnClient.sessionId).actionPoints).toBe(0); // I PA sono assegnati solo a chi è di turno (o 3 se il test lo imposta subito per tutti, ma colui che non è di turno non deve aver speso PA che non aveva). Se sono stati assegnati 3 a tutti o no, comunque non devono ridursi. Il design indica che vengono assegnati a chi è di turno.
    });

    test("2. Deve rifiutare DRAW_CARD se il giocatore di turno ha 0 Punti Azione", async () => {
        const client1 = await colyseus.sdk.joinOrCreate("office_room", { ceoName: "P1" });
        const client2 = await colyseus.sdk.joinOrCreate("office_room", { ceoName: "P2" });
        const client3 = await colyseus.sdk.joinOrCreate("office_room", { ceoName: "P3" });

        await new Promise((resolve) => setTimeout(resolve, 200));

        const state = client1.state;
        const currentTurnId = state.currentTurnPlayerId;

        // Identifichiamo il client di turno
        let activeClient;
        if (client1.sessionId === currentTurnId) activeClient = client1;
        else if (client2.sessionId === currentTurnId) activeClient = client2;
        else activeClient = client3;

        // Assicuriamoci che abbia 3 PA all'inizio
        let pa = state.players.get(activeClient.sessionId).actionPoints;
        expect(pa).toBe(3);

        // Spendiamo tutti i 3 PA
        activeClient.send(ClientMessages.DRAW_CARD, {});
        await new Promise((resolve) => setTimeout(resolve, 50));
        activeClient.send(ClientMessages.DRAW_CARD, {});
        await new Promise((resolve) => setTimeout(resolve, 50));
        activeClient.send(ClientMessages.DRAW_CARD, {});
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Ora i PA dovrebbero essere 0
        pa = state.players.get(activeClient.sessionId).actionPoints;
        expect(pa).toBe(0);

        let errorReceived = false;
        activeClient.onMessage(ServerEvents.ERROR, (message: IErrorEvent) => {
            expect(message.code).toBe("NO_PA");
            errorReceived = true;
        });

        // Il giocatore tenta di pescare una quarta volta con 0 PA
        activeClient.send(ClientMessages.DRAW_CARD, {});
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verifichiamo che il tentativo sia stato bloccato
        expect(errorReceived).toBe(true);
        // I PA non possono andare in negativo
        expect(state.players.get(activeClient.sessionId).actionPoints).toBe(0);
    });
});
