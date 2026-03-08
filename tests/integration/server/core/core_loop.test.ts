import { GamePhase, ServerEvents } from 'shared/SharedTypes';
import { createMockClient, createTestRoom, disposeRoom } from 'tests/helpers/server/roomHarness';
import { OfficeRoom } from 'server/src/rooms/OfficeRoom';

describe('Core loop - turn validation and cheat prevention', () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = createTestRoom({
            phase: GamePhase.PLAYER_TURN,
            players: [
                { sessionId: 'client_A', username: 'CEO_A', actionPoints: 3 },
                { sessionId: 'client_B', username: 'CEO_B', actionPoints: 0 },
                { sessionId: 'client_C', username: 'CEO_C', actionPoints: 1 },
            ],
            currentTurnPlayerId: 'client_A',
        });
        room.state.turnIndex = 0;
        room['serverDeck'] = [{ id: 'c1', templateId: 'emp_01', type: 'hero' as any }];
        room.state.deckCount = 1;
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test('rejects draw if it is not the player turn', () => {
        const clientB = createMockClient('client_B');

        room['handleDrawCard'](clientB);

        expect(clientB.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((clientB.getLastPacket()?.data as any)?.code).toBe('NOT_YOUR_TURN');
        expect(room.state.deckCount).toBe(1);
    });

    test('rejects draw if player has no action points', () => {
        const clientA = createMockClient('client_A');
        room.state.players.get('client_A')!.actionPoints = 0;

        room['handleDrawCard'](clientA);

        expect(clientA.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((clientA.getLastPacket()?.data as any)?.code).toBe('NO_PA');
        expect(room.state.deckCount).toBe(1);
    });

    test('allows draw and consumes action points', () => {
        const clientA = createMockClient('client_A');

        room['handleDrawCard'](clientA);

        expect(room.state.players.get('client_A')!.actionPoints).toBe(2);
        expect(room.state.deckCount).toBe(0);
        expect(clientA.getLastPacket()?.event).toBe(ServerEvents.CARD_DRAWN);
    });

    test('end turn advances to next player and restores action points', () => {
        const clientA = createMockClient('client_A');

        room['handleEndTurn'](clientA);

        expect(room.state.currentTurnPlayerId).toBe('client_B');
        expect(room.state.turnIndex).toBe(1);
        expect(room.state.players.get('client_B')!.actionPoints).toBe(3);
        expect(room.broadcast).toHaveBeenCalledWith(ServerEvents.TURN_STARTED, expect.any(Object));
    });
});
