import { GamePhase, ServerEvents } from 'shared/SharedTypes';
import {
    createMockMatchBundle,
    createMockServerManager,
    isQaLongNamesEnabled,
    isQaMatchModeEnabled,
    resolveMockMatchPreset,
} from 'client/src/qa/MockMatchState';

describe('MockMatchState QA mode', () => {
    test('qaMatch query abilita modalita mock', () => {
        expect(isQaMatchModeEnabled('?qaMatch=1')).toBe(true);
        expect(isQaMatchModeEnabled('?mockMatch=1')).toBe(true);
        expect(isQaMatchModeEnabled('?qaMatch=0')).toBe(false);
    });

    test('preset parser supporta my/other/reaction', () => {
        expect(resolveMockMatchPreset('?qaState=other')).toBe('other_turn');
        expect(resolveMockMatchPreset('?qaState=reaction')).toBe('reaction_window');
        expect(resolveMockMatchPreset('?qaState=my_turn')).toBe('my_turn');
    });

    test('qaLongNames abilita stress nickname lunghi', () => {
        expect(isQaLongNamesEnabled('?qaMatch=1&qaLongNames=1')).toBe(true);
        expect(isQaLongNamesEnabled('?qaMatch=1&qaLongNames=true')).toBe(true);
        expect(isQaLongNamesEnabled('?qaMatch=1')).toBe(false);
    });

    test('bundle base contiene board completa e 3 monster', () => {
        const bundle = createMockMatchBundle('my_turn');
        expect(bundle.state.players.size).toBeGreaterThanOrEqual(3);
        expect(bundle.state.centralCrises.length).toBe(3);
        expect(bundle.state.phase).toBe(GamePhase.PLAYER_TURN);
    });

    test('bundle localizza le carte in EN quando richiesto', () => {
        const bundle = createMockMatchBundle('my_turn', 'en');
        const me = bundle.state.players.get(bundle.localSessionId)!;
        const card = me.hand.find((c) => c.templateId === 'emp_01');
        expect(card).toBeDefined();
        expect(card?.name).toBe('Overworked Intern');
        expect(String(card?.shortDesc ?? '').toLowerCase()).toContain('ap');
    });

    test('mock manager drawCard aggiorna stato locale', () => {
        const manager = createMockServerManager('?qaMatch=1&qaState=my_turn');
        const room = manager.room!;
        const meBefore = room.state.players.get(room.sessionId)!;
        const apBefore = meBefore.actionPoints;
        const deckBefore = room.state.deckCount;
        const handBefore = meBefore.hand.length;

        const events: Array<string | number> = [];
        manager.onRoomMessage = (type) => events.push(type);
        manager.drawCard();

        const meAfter = room.state.players.get(room.sessionId)!;
        expect(meAfter.actionPoints).toBe(apBefore - 1);
        expect(room.state.deckCount).toBe(deckBefore - 1);
        expect(meAfter.hand.length).toBe(handBefore + 1);
        expect(events).toContain(ServerEvents.CARD_DRAWN);
    });

    test('query lang forza la lingua mock anche con fallback diverso', () => {
        const manager = createMockServerManager('?qaMatch=1&qaState=my_turn&lang=en', 'it');
        const room = manager.room!;
        const me = room.state.players.get(room.sessionId)!;
        const card = me.hand.find((c) => c.templateId === 'emp_01');
        expect(card?.name).toBe('Overworked Intern');
    });

    test('query qaLongNames genera username mock estesi', () => {
        const manager = createMockServerManager('?qaMatch=1&qaState=my_turn&lang=en&qaLongNames=1');
        const room = manager.room!;
        const players = Array.from(room.state.players.values());
        expect(players).toHaveLength(3);
        players.forEach((player) => {
            expect(player.username.length).toBeGreaterThan(24);
        });
    });
});

