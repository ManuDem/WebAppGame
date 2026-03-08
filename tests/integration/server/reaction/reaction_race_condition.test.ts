import { CardType, GamePhase, ServerEvents } from 'shared/SharedTypes';
import { createCard, createMockClient, createTestRoom, disposeRoom } from 'tests/helpers/server/roomHarness';
import { OfficeRoom } from 'server/src/rooms/OfficeRoom';

describe('Reaction window - race conditions', () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = createTestRoom({
            phase: GamePhase.PLAYER_TURN,
            players: [
                { sessionId: 'player_1', username: 'CEO_1', actionPoints: 3 },
                { sessionId: 'player_2', username: 'CEO_2', actionPoints: 3 },
                { sessionId: 'player_3', username: 'CEO_3', actionPoints: 3 },
            ],
            currentTurnPlayerId: 'player_1',
        });
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test('handles simultaneous reactions without corrupting the stack', () => {
        const client1 = createMockClient('player_1');
        const client2 = createMockClient('player_2');
        const client3 = createMockClient('player_3');

        room.state.players.get('player_1')!.hand.push(createCard('card_emp_1', 'emp_01', CardType.EMPLOYEE));
        room.state.players.get('player_2')!.hand.push(createCard('card_react_2', 'rea_01', CardType.EVENTO));
        room.state.players.get('player_3')!.hand.push(createCard('card_react_3', 'rea_02', CardType.EVENTO));

        room['handlePlayEmployee'](client1 as any, { cardId: 'card_emp_1' });
        room['handlePlayReaction'](client2 as any, { cardId: 'card_react_2' });
        room['handlePlayReaction'](client3 as any, { cardId: 'card_react_3' });
        (room.clock as any).tick(5100);

        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);
        expect(room.state.pendingAction).toBeNull();
        expect(room.state.actionStack.length).toBe(0);
        const p3Hand = room.state.players.get('player_3')!.hand as any[];
        expect(p3Hand.length).toBe(1);
        expect(p3Hand[0]?.templateId).toBe('emp_01');
        expect(p3Hand[0]?.type).toBe(CardType.HERO);
    });

    test('rejects reaction cards outside reaction window', () => {
        const client2 = createMockClient('player_2');
        room.state.players.get('player_2')!.hand.push(createCard('card_react_x', 'rea_01', CardType.EVENTO));

        room['handlePlayReaction'](client2 as any, { cardId: 'card_react_x' });

        expect(client2.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((client2.getLastPacket()?.data as any)?.code).toBe('NO_REACTION_WINDOW');
        expect(room.state.players.get('player_2')!.hand.length).toBe(1);
    });
});
