import { ICardData, IPlayer } from '../../../../shared/SharedTypes';
import { ActionBlockReasonKey, MatchActionState } from './MatchActionState';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface MatchHudModelInput {
    me: IPlayer;
    opponents: IPlayer[];
    activePlayer?: IPlayer;
    myId: string;
    deckCount: number;
    discardCount: number;
    reactionActive: boolean;
    phase: string;
    compact?: boolean;
    tr: TranslateFn;
}

export interface MatchHudModel {
    turnLabel: string;
    statsLabel: string;
    phaseLabel: string;
    reactionLabel: string;
    opponentsLabel: string;
}

export interface ActionPanelModel {
    hint: string;
    detail: string;
}

export function compactPlayerName(value: string, maxLen = 8): string {
    const clean = String(value ?? '').trim();
    if (clean.length <= maxLen) return clean;
    return `${clean.slice(0, Math.max(1, maxLen - 1))}.`;
}

export function buildOpponentsSummary(opponents: IPlayer[], tr: TranslateFn): string {
    if (opponents.length === 0) return tr('game_waiting_opponents');
    return opponents
        .slice()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 3)
        .map((player) => `${compactPlayerName(player.username, 7)}:${player.score ?? 0}`)
        .join('  ');
}

export function countCompanyEquippedItems(companyCards: ICardData[]): number {
    return companyCards.reduce((sum, card) => {
        const eq = Number((card as any)?.equippedItems?.length ?? 0);
        return sum + (Number.isFinite(eq) ? Math.max(0, eq) : 0);
    }, 0);
}

export function buildHudModel(input: MatchHudModelInput): MatchHudModel {
    const {
        me,
        opponents,
        activePlayer,
        myId,
        deckCount,
        discardCount,
        reactionActive,
        phase,
        compact,
        tr,
    } = input;

    const handCount = Number((me.hand as unknown as ICardData[])?.length ?? 0);
    const companyCards = (me.company as unknown as ICardData[]) ?? [];
    const companyCount = companyCards.length;
    const equippedCount = countCompanyEquippedItems(companyCards);
    const opponentsSummary = buildOpponentsSummary(opponents, tr);
    const turnLabel = activePlayer
        ? (activePlayer.sessionId === myId
            ? tr('game_turn_your')
            : tr('game_turn_other', { name: activePlayer.username }))
        : tr('game_waiting');

    return {
        turnLabel,
        statsLabel: tr(compact ? 'game_hud_stats_compact' : 'game_hud_stats', {
            ap: me.actionPoints ?? 0,
            score: me.score ?? 0,
            deck: deckCount,
            discard: discardCount,
            hand: handCount,
            company: companyCount,
            equipped: equippedCount,
        }),
        phaseLabel: tr('game_hud_phase', { phase }),
        reactionLabel: reactionActive ? tr('game_hud_reaction_active') : (compact ? '' : tr('game_hud_reaction_idle')),
        opponentsLabel: tr('game_hud_opponents', { value: opponentsSummary }),
    };
}

export function buildActionPanelModel(
    actionState: MatchActionState,
    activePlayerName: string,
    tr: TranslateFn,
    localizeReason: (reasonKey?: ActionBlockReasonKey) => string,
): ActionPanelModel {
    const turnInfo = actionState.isMyTurn
        ? tr('game_action_turn_you')
        : tr('game_action_turn_other', { name: activePlayerName });
    const attackText = actionState.canAttackMonster
        ? tr('game_action_attack_ready', { cost: actionState.attackCost })
        : tr('game_action_attack_blocked', {
            reason: localizeReason(actionState.attackReasonKey),
        });
    const drawText = actionState.canDraw
        ? tr('game_action_draw_ready', { cost: actionState.drawCost })
        : tr('game_action_draw_blocked_panel', {
            reason: localizeReason(actionState.drawReasonKey),
        });
    const endText = actionState.canEndTurn
        ? tr('game_action_end_ready')
        : tr('game_action_end_blocked', {
            reason: localizeReason(actionState.endReasonKey),
        });

    return {
        hint: attackText,
        detail: `${drawText}\n${turnInfo} | ${endText}`,
    };
}
