import { Client } from 'colyseus';
import { OfficeRoom } from '../server/src/rooms/OfficeRoom';
import { OfficeRoomState, PlayerState } from '../server/src/State';
import { GamePhase, ServerEvents } from '../shared/SharedTypes';

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

describe('Core Loop - Turn Validation & Cheat Prevention', () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = new OfficeRoom();
        room.state = new OfficeRoomState();
        room.state.phase = GamePhase.PLAYER_TURN;

        const p1 = new PlayerState();
        p1.sessionId = 'client_A';
        p1.isConnected = true;
        p1.actionPoints = 3;

        const p2 = new PlayerState();
        p2.sessionId = 'client_B';
        p2.isConnected = true;
        p2.actionPoints = 0;

        const p3 = new PlayerState();
        p3.sessionId = 'client_C';
        p3.isConnected = true;
        p3.actionPoints = 1;

        room.state.players.set('client_A', p1);
        room.state.players.set('client_B', p2);
        room.state.players.set('client_C', p3);

        room.state.playerOrder = ['client_A', 'client_B', 'client_C'];
        room.state.currentTurnPlayerId = 'client_A';
        room.state.turnIndex = 0;

        room['serverDeck'] = [{ id: 'c1', templateId: 'emp_01', type: 'hero' as any }];
        room.state.deckCount = 1;
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test('Deve rifiutare DRAW_CARD se non e il turno del giocatore', () => {
        const clientB = createMockClient('client_B');

        room['handleDrawCard'](clientB);

        expect(clientB.send).toHaveBeenCalledWith(
            ServerEvents.ERROR,
            expect.objectContaining({ code: 'NOT_YOUR_TURN' }),
        );
        expect(room.state.deckCount).toBe(1);
    });

    test('Deve rifiutare DRAW_CARD se il giocatore ha 0 PA', () => {
        const clientA = createMockClient('client_A');
        room.state.players.get('client_A')!.actionPoints = 0;

        room['handleDrawCard'](clientA);

        expect(clientA.send).toHaveBeenCalledWith(
            ServerEvents.ERROR,
            expect.objectContaining({ code: 'NO_PA' }),
        );
        expect(room.state.deckCount).toBe(1);
    });

    test('Deve permettere DRAW_CARD riducendo PA e deckCount', () => {
        const clientA = createMockClient('client_A');

        room['handleDrawCard'](clientA);

        expect(room.state.players.get('client_A')!.actionPoints).toBe(2);
        expect(room.state.deckCount).toBe(0);
        expect(clientA.send).toHaveBeenCalledWith(ServerEvents.CARD_DRAWN, expect.any(Object));
    });

    test('Deve passare il turno correttamente con END_TURN', () => {
        const clientA = createMockClient('client_A');
        room.broadcast = jest.fn();

        room['handleEndTurn'](clientA);

        expect(room.state.currentTurnPlayerId).toBe('client_B');
        expect(room.state.turnIndex).toBe(1);
        expect(room.state.players.get('client_B')!.actionPoints).toBe(3);
        expect(room.broadcast).toHaveBeenCalledWith(ServerEvents.TURN_STARTED, expect.any(Object));
    });
});
