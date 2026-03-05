import {
    DRAW_CARD_COST,
    GamePhase,
    ICardData,
    IGameState,
    IPlayer,
} from '../../../../shared/SharedTypes';

export type ActionBlockReasonKey =
    | 'game_reason_not_your_turn'
    | 'game_reason_wrong_phase'
    | 'game_reason_no_pa'
    | 'game_reason_deck_empty'
    | 'game_reason_no_monsters'
    | 'game_reason_game_over'
    | 'game_reason_waiting_players'
    | 'game_reason_action_pending';

export interface MatchActionState {
    isMyTurn: boolean;
    canDraw: boolean;
    canEndTurn: boolean;
    canAttackMonster: boolean;
    drawReasonKey?: ActionBlockReasonKey;
    endReasonKey?: ActionBlockReasonKey;
    attackReasonKey?: ActionBlockReasonKey;
    drawCost: number;
    attackCost: number;
    ap: number;
}

export interface MatchActionStateInput {
    state: IGameState;
    me: IPlayer;
    myId: string;
}

const DEFAULT_MONSTER_COST = 2;

function getPhaseBlockReason(phase: GamePhase): ActionBlockReasonKey {
    if (phase === GamePhase.GAME_OVER) return 'game_reason_game_over';
    if (phase === GamePhase.PRE_LOBBY || phase === GamePhase.WAITING_FOR_PLAYERS) return 'game_reason_waiting_players';
    return 'game_reason_wrong_phase';
}

function computeMonsterAttackCost(crises: ICardData[]): number {
    if (!Array.isArray(crises) || crises.length === 0) return DEFAULT_MONSTER_COST;
    const validCosts = crises
        .map((card) => Number(card?.costPA))
        .filter((value) => Number.isFinite(value) && value > 0);
    if (validCosts.length === 0) return DEFAULT_MONSTER_COST;
    return Math.max(1, Math.min(...validCosts));
}

export function evaluateMatchActionState(input: MatchActionStateInput): MatchActionState {
    const { state, me, myId } = input;
    const ap = Math.max(0, Number(me?.actionPoints ?? 0));
    const isMyTurn = state.currentTurnPlayerId === myId;
    const drawCost = DRAW_CARD_COST;
    const attackCost = computeMonsterAttackCost((state.centralCrises as unknown as ICardData[]) ?? []);
    const phase = state.phase;

    const result: MatchActionState = {
        isMyTurn,
        canDraw: false,
        canEndTurn: false,
        canAttackMonster: false,
        drawCost,
        attackCost,
        ap,
    };

    if (!isMyTurn) {
        result.drawReasonKey = 'game_reason_not_your_turn';
        result.endReasonKey = 'game_reason_not_your_turn';
        result.attackReasonKey = 'game_reason_not_your_turn';
        return result;
    }

    if (phase !== GamePhase.PLAYER_TURN) {
        const reason = getPhaseBlockReason(phase);
        result.drawReasonKey = reason;
        result.endReasonKey = reason;
        result.attackReasonKey = reason;
        return result;
    }

    result.canEndTurn = true;

    if (Number(state.deckCount ?? 0) <= 0) {
        result.drawReasonKey = 'game_reason_deck_empty';
    } else if (ap < drawCost) {
        result.drawReasonKey = 'game_reason_no_pa';
    } else {
        result.canDraw = true;
    }

    const crisisCount = Number((state.centralCrises as unknown as ICardData[])?.length ?? 0);
    if (crisisCount <= 0) {
        result.attackReasonKey = 'game_reason_no_monsters';
    } else if (ap < attackCost) {
        result.attackReasonKey = 'game_reason_no_pa';
    } else {
        result.canAttackMonster = true;
    }

    return result;
}

export function evaluateSingleMonsterAttack(
    input: MatchActionStateInput,
    crisis?: ICardData,
): { canAttack: boolean; reasonKey?: ActionBlockReasonKey; cost: number } {
    const overall = evaluateMatchActionState(input);
    const cost = Math.max(1, Number(crisis?.costPA ?? overall.attackCost ?? DEFAULT_MONSTER_COST));

    if (!overall.isMyTurn) {
        return { canAttack: false, reasonKey: 'game_reason_not_your_turn', cost };
    }
    if (input.state.phase !== GamePhase.PLAYER_TURN) {
        return { canAttack: false, reasonKey: getPhaseBlockReason(input.state.phase), cost };
    }
    if (!crisis) {
        return { canAttack: false, reasonKey: 'game_reason_no_monsters', cost };
    }
    if (overall.ap < cost) {
        return { canAttack: false, reasonKey: 'game_reason_no_pa', cost };
    }
    return { canAttack: true, cost };
}
