import { CardType, GamePhase, ServerEvents } from 'shared/SharedTypes';
import { createCard, createMockClient, createTestRoom, disposeRoom, getBroadcasts } from 'tests/helpers/server/roomHarness';
import { OfficeRoom } from 'server/src/rooms/OfficeRoom';
import { CardState } from 'server/src/State';

describe('Gameplay foundation', () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = createTestRoom({
            phase: GamePhase.PLAYER_TURN,
            trackBroadcasts: true,
            players: [
                { sessionId: 'player_1', username: 'CEO_1', actionPoints: 3 },
                { sessionId: 'player_2', username: 'CEO_2', actionPoints: 3 },
            ],
            currentTurnPlayerId: 'player_1',
        });
        room['monsterTemplateIds'] = ['crs_01', 'crs_02', 'crs_03'];
        room['monsterBag'] = ['crs_01', 'crs_02', 'crs_03'];
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test('consumes action points when draw is valid', () => {
        const client = createMockClient('player_1');
        room['serverDeck'] = [{ id: 'draw_1', templateId: 'emp_01', type: CardType.HERO }];
        room.state.deckCount = 1;

        room['handleDrawCard'](client);

        expect(room.state.players.get('player_1')!.actionPoints).toBe(2);
        expect(room.state.deckCount).toBe(0);
    });

    test('challenge and modifier remain reaction-only outside the reaction window', () => {
        const client = createMockClient('player_1');
        const player = room.state.players.get('player_1')!;

        player.hand.push(createCard('mod_card', 'mod_01', CardType.MODIFIER));
        room['handlePlayMagic'](client, { cardId: 'mod_card' });
        expect(client.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((client.getLastPacket()?.data as any)?.code).toBe('REACTION_ONLY_WINDOW');

        client.clearLastPacket();
        player.hand.push(createCard('challenge_card', 'rea_01', CardType.CHALLENGE));
        room['handlePlayMagic'](client, { cardId: 'challenge_card' });
        expect(client.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((client.getLastPacket()?.data as any)?.code).toBe('REACTION_ONLY_WINDOW');
    });

    test('item equips on the targeted hero after resolution', () => {
        const client = createMockClient('player_1');
        const player = room.state.players.get('player_1')!;
        const hero = createCard('hero_1', 'emp_01', CardType.HERO);
        hero.isFaceUp = true;
        hero.name = 'Hero One';
        player.company.push(hero);
        player.hand.push(createCard('item_1', 'itm_01', CardType.ITEM));

        room['handlePlayMagic'](client, {
            cardId: 'item_1',
            targetHeroCardId: 'hero_1',
        });
        (room.clock as any).tick(5100);

        const equippedItems = (hero.equippedItems ?? []) as CardState[];
        expect(equippedItems.length).toBe(1);
        expect(equippedItems[0]?.templateId).toBe('itm_01');
    });

    test('monster board refills back to three after a successful resolution', () => {
        const player = room.state.players.get('player_1')!;
        player.company.push(createCard('hero_attacker', 'emp_01', CardType.HERO));

        const c1 = createCard('crs_inst_1', 'crs_01', CardType.MONSTER);
        c1.targetRoll = 2;
        const c2 = createCard('crs_inst_2', 'crs_02', CardType.MONSTER);
        c2.targetRoll = 2;
        const c3 = createCard('crs_inst_3', 'crs_03', CardType.MONSTER);
        c3.targetRoll = 2;
        room.state.centralCrises.push(c1, c2, c3);

        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const result = room['applyCrisisResolution']('player_1', 'crs_inst_1', 'hero_attacker');
            expect(result.success).toBe(true);
        } finally {
            randomSpy.mockRestore();
        }

        expect(player.score).toBeGreaterThanOrEqual(1);
        expect((room.state.centralCrises as any[]).length).toBe(3);
        expect((room.state.centralCrises as any[]).some((card) => card.id === 'crs_inst_1')).toBe(false);
        expect(getBroadcasts(room).some((entry) => entry.type === ServerEvents.DICE_ROLLED)).toBe(true);
    });
});
