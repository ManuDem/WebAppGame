import { CardType, GamePhase, ServerEvents } from 'shared/SharedTypes';
import { createCard, createMockClient, createTestRoom, disposeRoom, getBroadcasts } from 'tests/helpers/server/roomHarness';
import { OfficeRoom } from 'server/src/rooms/OfficeRoom';

describe('End-to-end win conditions', () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = createTestRoom({
            phase: GamePhase.PLAYER_TURN,
            trackBroadcasts: true,
            players: [
                { sessionId: 'player_1', username: 'CEO_01', actionPoints: 10 },
                { sessionId: 'player_2', username: 'CEO_02', actionPoints: 10 },
            ],
            currentTurnPlayerId: 'player_1',
        });
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test('wins by 4 hero cards in company', () => {
        const client = createMockClient('player_1');
        for (let i = 1; i <= 5; i += 1) {
            room.state.players.get('player_1')!.hand.push(createCard(`emp_${i}`, 'emp_01', CardType.EMPLOYEE));
        }

        for (let i = 1; i <= 4; i += 1) {
            room['handlePlayEmployee'](client, { cardId: `emp_${i}` });
            (room.clock as any).tick(5100);
        }

        expect(room.state.phase).toBe(GamePhase.GAME_OVER);
        expect(room.state.winnerId).toBe('player_1');
        const winBroadcast = getBroadcasts(room).find((entry) => entry.type === ServerEvents.GAME_WON);
        expect(winBroadcast).toBeTruthy();
        expect((winBroadcast?.message as any).winnerId).toBe('player_1');
    });

    test('wins by solving two monsters', () => {
        const client = createMockClient('player_1');
        room.state.players.get('player_1')!.company.push(createCard('hero_attacker', 'emp_01', CardType.HERO));
        room.state.centralCrises.push(createCard('crs_inst_1', 'crs_01', CardType.IMPREVISTO));
        room.state.centralCrises.push(createCard('crs_inst_2', 'crs_02', CardType.IMPREVISTO));
        room.state.centralCrises.push(createCard('crs_inst_3', 'crs_03', CardType.IMPREVISTO));

        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            room['handleSolveCrisis'](client, { crisisId: 'crs_inst_1', heroCardId: 'hero_attacker' });
            (room.clock as any).tick(5100);
            room['handleSolveCrisis'](client, { crisisId: 'crs_inst_2', heroCardId: 'hero_attacker' });
            (room.clock as any).tick(5100);
        } finally {
            randomSpy.mockRestore();
        }

        expect(room.state.phase).toBe(GamePhase.GAME_OVER);
        expect(room.state.winnerId).toBe('player_1');
    });

    test('applies monster penalties on failed rolls', () => {
        const client = createMockClient('player_1');
        const victim = room.state.players.get('player_2')!;
        room.state.players.get('player_1')!.company.push(createCard('hero_attacker_fail', 'emp_01', CardType.HERO));
        room.state.centralCrises.push(createCard('c1', 'crs_01', CardType.IMPREVISTO));
        victim.hand.push(createCard('h1', 'emp_01', CardType.EMPLOYEE));
        victim.hand.push(createCard('h2', 'emp_01', CardType.EMPLOYEE));
        victim.hand.push(createCard('h3', 'emp_01', CardType.EMPLOYEE));

        let randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            room['handleSolveCrisis'](client, { crisisId: 'c1', heroCardId: 'hero_attacker_fail' });
            (room.clock as any).tick(5100);
        } finally {
            randomSpy.mockRestore();
        }
        expect(victim.hand.length).toBe(1);

        room.state.centralCrises.push(createCard('c2', 'crs_02', CardType.IMPREVISTO));
        victim.company.push(createCard('comp1', 'emp_01', CardType.EMPLOYEE));
        victim.company.push(createCard('comp2', 'emp_01', CardType.EMPLOYEE));
        randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            room['handleSolveCrisis'](client, { crisisId: 'c2', heroCardId: 'hero_attacker_fail' });
            (room.clock as any).tick(5100);
        } finally {
            randomSpy.mockRestore();
        }
        expect(victim.company.length).toBe(1);
    });

    test('rejects targeted magic without target player id', () => {
        const client = createMockClient('player_1');
        const source = room.state.players.get('player_1')!;
        const target = room.state.players.get('player_2')!;
        source.hand.push(createCard('trk1', 'trk_01', CardType.EVENTO));
        source.hand.push(createCard('trk2', 'trk_01', CardType.EVENTO));
        target.actionPoints = 3;

        room['handlePlayMagic'](client, { cardId: 'trk1', targetPlayerId: 'player_2' });
        (room.clock as any).tick(5100);
        expect(target.actionPoints).toBe(1);

        room['handlePlayMagic'](client, { cardId: 'trk2' });
        expect(client.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((client.getLastPacket()?.data as any).code).toBe('MISSING_TARGET');
    });
});
