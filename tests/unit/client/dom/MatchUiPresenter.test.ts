import { t } from 'client/src/i18n';
import {
    buildActionPanelModel,
    buildHudModel,
    buildOpponentsSummary,
    compactPlayerName,
} from 'client/src/ui/match/MatchUiPresenter';
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
    } as any;
}

describe('MatchUiPresenter', () => {
    test('compactPlayerName tronca correttamente', () => {
        expect(compactPlayerName('Marco', 8)).toBe('Marco');
        expect(compactPlayerName('CorporateDragon', 8)).toBe('Corpora.');
        expect(compactPlayerName('  CorporateDragon  ', 8)).toBe('Corpora.');
    });

    test('buildOpponentsSummary compatta nickname lunghi nello stress QA', () => {
        const summary = buildOpponentsSummary([
            makePlayer({ username: 'SuperCorporateDragonAlpha', score: 9 }),
            makePlayer({ username: 'AnotherVeryLongOpponentName', score: 4 }),
        ], trIt);
        expect(summary).toContain('SuperC.:9');
        expect(summary).toContain('Anothe.:4');
    });

    test('buildOpponentsSummary ordina per score e limita output', () => {
        const summary = buildOpponentsSummary([
            makePlayer({ username: 'A', score: 1 }),
            makePlayer({ username: 'B', score: 7 }),
            makePlayer({ username: 'C', score: 3 }),
            makePlayer({ username: 'D', score: 2 }),
        ], trIt);
        expect(summary).toContain('B:7');
        expect(summary).toContain('C:3');
        expect(summary).toContain('D:2');
        expect(summary).not.toContain('A:1');
    });

    test('buildHudModel espone label turno e stats coerenti', () => {
        const me = makePlayer({ sessionId: 'me', username: 'Io', actionPoints: 2, score: 3, hand: [{ id: 'h1' }] });
        const opp = makePlayer({ sessionId: 'opp', username: 'Luca', score: 4 });
        const hud = buildHudModel({
            me,
            opponents: [opp],
            activePlayer: me,
            myId: 'me',
            deckCount: 10,
            discardCount: 5,
            reactionActive: false,
            phase: 'PLAYER TURN',
            tr: trIt,
        });
        expect(hud.turnLabel).toBe('IL TUO TURNO');
        expect(hud.statsLabel).toContain('AP 2');
        expect(hud.statsLabel).toContain('VP 3');
        expect(hud.phaseLabel).toContain('PLAYER TURN');
        expect(hud.reactionLabel).toBe('Reazione inattiva');
    });

    test('buildActionPanelModel mostra motivi blocco localizzati', () => {
        const actionState: MatchActionState = {
            isMyTurn: false,
            canDraw: false,
            canEndTurn: false,
            canAttackMonster: false,
            drawReasonKey: 'game_reason_not_your_turn',
            endReasonKey: 'game_reason_not_your_turn',
            attackReasonKey: 'game_reason_not_your_turn',
            drawCost: 1,
            attackCost: 2,
            ap: 0,
        };
        const panel = buildActionPanelModel(
            actionState,
            'Luca',
            trIt,
            (reasonKey) => trIt(reasonKey ?? 'game_action_denied'),
        );
        expect(panel.hint).toContain('non e il tuo turno');
        expect(panel.detail).toContain('Turno: Luca');
    });
});

