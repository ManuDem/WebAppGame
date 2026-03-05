import { GamePhase } from '../../../../shared/SharedTypes';
import { ActionBlockReasonKey, MatchActionState } from './MatchActionState';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface MatchHelpSection {
    title: string;
    body: string;
}

export interface MatchHelpContent {
    title: string;
    sections: MatchHelpSection[];
    closeHint: string;
}

export interface MatchContextHintInput {
    phase: GamePhase;
    actionState: MatchActionState;
    pendingAction: boolean;
    tr: TranslateFn;
    localizeReason: (reasonKey?: ActionBlockReasonKey) => string;
}

export function buildMatchHelpContent(tr: TranslateFn): MatchHelpContent {
    return {
        title: tr('game_help_title'),
        sections: [
            {
                title: tr('game_help_turn_ap_title'),
                body: tr('game_help_turn_ap_body'),
            },
            {
                title: tr('game_help_draw_title'),
                body: tr('game_help_draw_body'),
            },
            {
                title: tr('game_help_monster_title'),
                body: tr('game_help_monster_body'),
            },
            {
                title: tr('game_help_reaction_title'),
                body: tr('game_help_reaction_body'),
            },
            {
                title: tr('game_help_target_title'),
                body: tr('game_help_target_body'),
            },
        ],
        closeHint: tr('game_help_close_hint'),
    };
}

export function buildMatchContextHint(input: MatchContextHintInput): string {
    const { phase, actionState, pendingAction, tr, localizeReason } = input;

    if (pendingAction) return tr('game_hint_pending_action');
    if (phase === GamePhase.REACTION_WINDOW) return tr('game_hint_reaction_window');
    if (!actionState.isMyTurn) return tr('game_hint_wait_turn');
    if (phase !== GamePhase.PLAYER_TURN) return tr('game_hint_wait_phase');

    if (actionState.canAttackMonster) {
        return tr('game_hint_attack_available', { cost: actionState.attackCost });
    }
    if (actionState.canDraw) {
        return tr('game_hint_draw_available', { cost: actionState.drawCost });
    }

    if (actionState.attackReasonKey === 'game_reason_no_monsters') {
        return tr('game_hint_no_monsters');
    }
    if (actionState.drawReasonKey === 'game_reason_deck_empty') {
        return tr('game_hint_deck_empty');
    }

    const reason = localizeReason(actionState.attackReasonKey ?? actionState.drawReasonKey);
    return tr('game_hint_blocked_reason', { reason });
}
