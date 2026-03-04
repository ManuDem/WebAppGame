import { Client } from "colyseus";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { OfficeRoomState, PlayerState } from "../src/State";
import { GamePhase, ClientMessages, ServerEvents } from "../../shared/SharedTypes";

// Utility per creare Client mockati
const createMockClient = (sessionId: string) => {
    return {
        sessionId,
        send: jest.fn(),
        error: jest.fn(),
    } as unknown as Client;
};

const disposeRoom = (room: OfficeRoom) => {
    clearInterval((room as any)._patchInterval);
    clearTimeout((room as any)._autoDisposeTimeout);
    room.clock?.clear?.();
};

describe("Feature 02: Core Loop and Turn Validations", () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = new OfficeRoom();
        room.state = new OfficeRoomState();

        // Simulo l'avvio della partita
        room.state.phase = GamePhase.PLAYER_TURN;

        // Aggiungo tre giocatori allo state
        const p1 = new PlayerState(); p1.sessionId = "client_A"; p1.isConnected = true; p1.actionPoints = 3;
        const p2 = new PlayerState(); p2.sessionId = "client_B"; p2.isConnected = true; p2.actionPoints = 0;
        const p3 = new PlayerState(); p3.sessionId = "client_C"; p3.isConnected = true; p3.actionPoints = 1;

        room.state.players.set("client_A", p1);
        room.state.players.set("client_B", p2);
        room.state.players.set("client_C", p3);

        room.state.playerOrder = ["client_A", "client_B", "client_C"];
        room.state.currentTurnPlayerId = "client_A";
        room.state.turnIndex = 0;

        // Inizializza il deck
        room["serverDeck"] = [{ id: "c1", templateId: "x", type: "EMPLOYEE" as any }];
        room.state.deckCount = 1;
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test("Non deve permettere DRAW_CARD se non è il proprio turno", () => {
        const clientB = createMockClient("client_B");

        // Client_B prova a pescare durante il turno di Client_A
        room["handleDrawCard"](clientB);

        // Deve aver inviato l'evento di Errore al ClientB
        expect(clientB.send).toHaveBeenCalledWith(ServerEvents.ERROR, expect.objectContaining({
            code: "NOT_YOUR_TURN"
        }));

        // La carta deve essere ancora nel mazzo
        expect(room.state.deckCount).toBe(1);
    });

    test("Non deve permettere DRAW_CARD se il giocatore ha 0 PA", () => {
        const clientA = createMockClient("client_A");

        // Diamo 0 PA a Client A (di turno)
        room.state.players.get("client_A")!.actionPoints = 0;

        room["handleDrawCard"](clientA);

        expect(clientA.send).toHaveBeenCalledWith(ServerEvents.ERROR, expect.objectContaining({
            code: "NO_PA"
        }));
        expect(room.state.deckCount).toBe(1);
    });

    test("Deve permettere DRAW_CARD, ridurre i PA e diminuire deckCount al giocatore giusto", () => {
        const clientA = createMockClient("client_A");

        room["handleDrawCard"](clientA);

        // Il client A ha speso 1 PA
        expect(room.state.players.get("client_A")!.actionPoints).toBe(2);

        // La carta è andata via dal mazzo
        expect(room.state.deckCount).toBe(0);

        // Ricevuto payload successo
        expect(clientA.send).toHaveBeenCalledWith(ServerEvents.CARD_DRAWN, expect.any(Object));
    });

    test("Deve passare il turno correttamente", () => {
        const clientA = createMockClient("client_A");
        room.broadcast = jest.fn();

        room["handleEndTurn"](clientA);

        // Ora è il turno del client_B
        expect(room.state.currentTurnPlayerId).toBe("client_B");
        expect(room.state.turnIndex).toBe(1);
        expect(room.broadcast).toHaveBeenCalledWith(ServerEvents.TURN_STARTED, expect.any(Object));

        // Il nuovo arrivato ha recuperato 3 PA
        expect(room.state.players.get("client_B")!.actionPoints).toBe(3);
    });
});
