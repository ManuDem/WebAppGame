import { GamePhase, ICardData, IGameState, IPlayer } from '../shared/SharedTypes';
import { evaluateMatchActionState, evaluateSingleMonsterAttack } from '../client/src/ui/match/MatchActionState';

function makeState(overrides: Partial<IGameState> = {}): IGameState {
    return {
        phase: GamePhase.PLAYER_TURN,
        players: new Map<string, IPlayer>(),
        hostSessionId: 'p1',
        playerOrder: ['p1', 'p2'],
        currentTurnPlayerId: 'p1',
        turnIndex: 0,
        centralCrises: [] as unknown as ICardData[],
        deckCount: 10,
        actionStack: [],
        pendingAction: null,
        reactionEndTime: 0,
        turnNumber: 1,
        ...overrides,
    } as IGameState;
}

function makePlayer(overrides: Partial<IPlayer> = {}): IPlayer {
    return {
        sessionId: 'p1',
        username: 'CEO',
        isReady: true,
        isConnected: true,
        actionPoints: 3,
        hand: [],
        company: [],
        score: 0,
        victories: 0,
        activeEffects: [],
        ...overrides,
    } as IPlayer;
}

describe('MatchActionState', () => {
    test('draw disponibile nel turno giocatore con AP e deck', () => {
        const state = makeState({ deckCount: 7 });
        const me = makePlayer({ actionPoints: 2 });
        const result = evaluateMatchActionState({ state, me, myId: 'p1' });
        expect(result.canDraw).toBe(true);
        expect(result.drawReasonKey).toBeUndefined();
    });

    test('draw bloccata quando non e il tuo turno', () => {
        const state = makeState({ currentTurnPlayerId: 'p2' });
        const me = makePlayer({ actionPoints: 3 });
        const result = evaluateMatchActionState({ state, me, myId: 'p1' });
        expect(result.canDraw).toBe(false);
        expect(result.drawReasonKey).toBe('game_reason_not_your_turn');
        expect(result.canEndTurn).toBe(false);
    });

    test('attacco monster bloccato senza AP sufficienti', () => {
        const crisis = [{ id: 'c1', costPA: 2 } as ICardData] as unknown as ICardData[];
        const state = makeState({ centralCrises: crisis });
        const me = makePlayer({ actionPoints: 1 });
        const result = evaluateMatchActionState({ state, me, myId: 'p1' });
        expect(result.canAttackMonster).toBe(false);
        expect(result.attackReasonKey).toBe('game_reason_no_pa');
    });

    test('single monster attack usa costo crisis specifica', () => {
        const crisis = { id: 'c1', costPA: 3 } as ICardData;
        const state = makeState({ centralCrises: [crisis] as unknown as ICardData[] });
        const me = makePlayer({ actionPoints: 2 });
        const result = evaluateSingleMonsterAttack({ state, me, myId: 'p1' }, crisis);
        expect(result.canAttack).toBe(false);
        expect(result.cost).toBe(3);
        expect(result.reasonKey).toBe('game_reason_no_pa');
    });
});
