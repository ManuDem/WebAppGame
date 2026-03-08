import { GamePhase } from 'shared/SharedTypes';
import { t } from 'client/src/i18n';
import { buildCompactHudStats, buildMatchUiDomModel } from 'client/src/ui/match/MatchUiDomModel';
import { MatchActionState } from 'client/src/ui/match/MatchActionState';

const trIt = (key: string, vars?: Record<string, string | number>) => t('it', key, vars);

function makePlayer(partial: Record<string, any>) {
    return {
        sessionId: partial.sessionId ?? 'p1',
        username: partial.username ?? 'CEO',
        score: partial.score ?? 0,
        actionPoints: partial.actionPoints ?? 3,
        hand: partial.hand ?? [],
        company: partial.company ?? [],
        isReady: true,
        isConnected: true,
        victories: partial.victories ?? 0,
        activeEffects: partial.activeEffects ?? [],
    } as any;
}

function makeActionState(partial: Partial<MatchActionState>): MatchActionState {
    return {
        isMyTurn: true,
        canDraw: true,
        canEndTurn: true,
        canAttackMonster: true,
        drawCost: 1,
        attackCost: 2,
        ap: 3,
        ...partial,
    };
}

describe('MatchUiDomModel', () => {
    test('portrait comprime stats e nasconde testo secondario', () => {
        const me = makePlayer({ sessionId: 'p1', username: 'Me', score: 5, actionPoints: 2 });
        const opp = makePlayer({ sessionId: 'p2', username: 'Opponent', score: 3 });
        const model = buildMatchUiDomModel({
            state: {
                phase: GamePhase.PLAYER_TURN,
                players: new Map([['p1', me], ['p2', opp]]),
                hostSessionId: 'p1',
                playerOrder: ['p1', 'p2'],
                currentTurnPlayerId: 'p1',
                turnIndex: 0,
                centralCrises: [],
                deckCount: 8,
                actionStack: [],
                pendingAction: null,
                reactionEndTime: 0,
                turnNumber: 1,
            } as any,
            me,
            opponents: [opp],
            activePlayer: me,
            myId: 'p1',
            actionState: makeActionState({}),
            roomCode: '1234',
            reconnectActive: false,
            gameLogExpanded: false,
            gameLogEntries: ['uno', 'due'],
            controlsWidth: 240,
            layoutTier: 'A',
            compactLandscape: false,
            compactHud: true,
            discardCount: 2,
            tr: trIt,
            localizeReason: (reasonKey) => trIt(reasonKey ?? 'game_action_denied'),
            pendingAction: false,
        });

        expect(model.stats).toBe(buildCompactHudStats(me, trIt));
        expect(model.phase).toBe('');
        expect(model.reaction).toBe('');
        expect(model.actionDetail).toBe('');
        expect(model.endLabel).toBe('FINE');
    });

    test('desktop mantiene dettagli e blocca azioni durante reconnect', () => {
        const me = makePlayer({ sessionId: 'p1', username: 'Me', score: 1, actionPoints: 1, hand: [{ id: 'h1' }] });
        const opp = makePlayer({ sessionId: 'p2', username: 'Opponent', score: 3 });
        const actionState = makeActionState({
            canDraw: false,
            canEndTurn: false,
            canAttackMonster: false,
            drawReasonKey: 'game_reason_no_pa',
            attackReasonKey: 'game_reason_no_monsters',
        });
        const model = buildMatchUiDomModel({
            state: {
                phase: GamePhase.PLAYER_TURN,
                players: new Map([['p1', me], ['p2', opp]]),
                hostSessionId: 'p1',
                playerOrder: ['p1', 'p2'],
                currentTurnPlayerId: 'p1',
                turnIndex: 0,
                centralCrises: [],
                deckCount: 8,
                actionStack: [],
                pendingAction: null,
                reactionEndTime: 0,
                turnNumber: 1,
            } as any,
            me,
            opponents: [opp],
            activePlayer: me,
            myId: 'p1',
            actionState,
            roomCode: '1234',
            reconnectActive: true,
            gameLogExpanded: true,
            gameLogEntries: ['uno', 'due'],
            controlsWidth: 360,
            layoutTier: 'E',
            compactLandscape: false,
            compactHud: false,
            discardCount: 2,
            tr: trIt,
            localizeReason: (reasonKey) => trIt(reasonKey ?? 'game_action_denied'),
            pendingAction: true,
        });

        expect(model.canDraw).toBe(false);
        expect(model.canEndTurn).toBe(false);
        expect(model.actionHint).toContain('nessun Imprevisto');
        expect(model.actionDetail).toContain('Pesca bloccata');
        expect(model.logEntries).toEqual(['uno', 'due']);
        expect(model.logExpanded).toBe(true);
    });
});