import { GamePhase } from 'shared/SharedTypes';
import { t } from 'client/src/i18n';
import { buildMatchContextHint, buildMatchHelpContent } from 'client/src/ui/match/MatchHelpContent';
import { MatchActionState } from 'client/src/ui/match/MatchActionState';

const trIt = (key: string, vars?: Record<string, string | number>) => t('it', key, vars);

function makeActionState(partial: Partial<MatchActionState>): MatchActionState {
    return {
        isMyTurn: true,
        canDraw: false,
        canEndTurn: true,
        canAttackMonster: false,
        drawReasonKey: 'game_reason_no_pa',
        endReasonKey: undefined,
        attackReasonKey: 'game_reason_no_monsters',
        drawCost: 1,
        attackCost: 2,
        ap: 0,
        ...partial,
    };
}

describe('MatchHelpContent', () => {
    test('buildMatchHelpContent include sezioni principali', () => {
        const help = buildMatchHelpContent(trIt);
        expect(help.title).toBe('COME SI GIOCA');
        expect(help.sections.length).toBeGreaterThanOrEqual(5);
        expect(help.sections.map((s) => s.title).join(' | ')).toContain('Turno e PA');
        expect(help.sections.map((s) => s.title).join(' | ')).toContain('Mostri');
    });

    test('context hint in reaction window', () => {
        const hint = buildMatchContextHint({
            phase: GamePhase.REACTION_WINDOW,
            actionState: makeActionState({ isMyTurn: false }),
            pendingAction: false,
            tr: trIt,
            localizeReason: (key) => trIt(key ?? 'game_action_denied'),
        });
        expect(hint).toContain('Finestra reazione attiva');
    });

    test('context hint when monster attack available', () => {
        const hint = buildMatchContextHint({
            phase: GamePhase.PLAYER_TURN,
            actionState: makeActionState({
                canAttackMonster: true,
                canDraw: true,
                attackReasonKey: undefined,
                drawReasonKey: undefined,
            }),
            pendingAction: false,
            tr: trIt,
            localizeReason: (key) => trIt(key ?? 'game_action_denied'),
        });
        expect(hint).toContain('ATTACCA');
    });

    test('context hint with blocked no-monsters reason', () => {
        const hint = buildMatchContextHint({
            phase: GamePhase.PLAYER_TURN,
            actionState: makeActionState({
                canAttackMonster: false,
                canDraw: false,
                drawReasonKey: 'game_reason_no_pa',
            }),
            pendingAction: false,
            tr: trIt,
            localizeReason: (key) => trIt(key ?? 'game_action_denied'),
        });
        expect(hint).toContain('Nessun Mostro disponibile');
    });

    test('context hint with blocked reason generic fallback', () => {
        const hint = buildMatchContextHint({
            phase: GamePhase.PLAYER_TURN,
            actionState: makeActionState({
                canAttackMonster: false,
                canDraw: false,
                attackReasonKey: undefined,
                drawReasonKey: 'game_reason_no_pa',
            }),
            pendingAction: false,
            tr: trIt,
            localizeReason: (key) => trIt(key ?? 'game_action_denied'),
        });
        expect(hint).toContain('Azione bloccata');
        expect(hint).toContain('PA insufficienti');
    });

    test('context hint in game over non degrada a wait turn', () => {
        const hint = buildMatchContextHint({
            phase: GamePhase.GAME_OVER,
            actionState: makeActionState({
                isMyTurn: false,
                attackReasonKey: 'game_reason_game_over',
                drawReasonKey: 'game_reason_game_over',
            }),
            pendingAction: false,
            tr: trIt,
            localizeReason: (key) => trIt(key ?? 'game_action_denied'),
        });
        expect(hint).toBe('La fase corrente blocca questa azione.');
    });
});
