import { GamePhase, IPlayer } from "../../../shared/SharedTypes";

export interface ITurnActionValidationInput {
    phase: GamePhase;
    currentTurnPlayerId: string;
    requesterPlayerId: string;
    requiredPA: number;
    player: IPlayer | undefined;
}

export interface ITurnActionValidationResult {
    ok: boolean;
    code?: string;
    message?: string;
}

export function validateAndSpendTurnAction(input: ITurnActionValidationInput): ITurnActionValidationResult {
    if (input.phase === GamePhase.GAME_OVER) {
        return { ok: false, code: "GAME_OVER", message: "La partita è terminata." };
    }
    if (input.requesterPlayerId !== input.currentTurnPlayerId) {
        return { ok: false, code: "NOT_YOUR_TURN", message: "Non è il tuo turno." };
    }
    if (input.phase !== GamePhase.PLAYER_TURN) {
        return { ok: false, code: "WRONG_PHASE", message: "Fase non corretta." };
    }
    if (!input.player?.isConnected) {
        return { ok: false, code: "ACTION_DENIED", message: "Giocatore non connesso." };
    }
    if (!input.player || input.player.actionPoints < input.requiredPA) {
        return { ok: false, code: "NO_PA", message: "Punti Azione insufficienti." };
    }

    input.player.actionPoints -= input.requiredPA;
    return { ok: true };
}

export interface INextTurnResult {
    nextIndex: number;
    nextPlayerId: string;
}

export function computeNextConnectedTurn(
    playerOrder: string[],
    currentTurnIndex: number,
    isConnected: (playerId: string) => boolean,
): INextTurnResult | null {
    const playerCount = playerOrder.length;
    if (playerCount === 0) return null;

    let nextIndex = currentTurnIndex;
    let attempts = 0;

    do {
        nextIndex = (nextIndex + 1) % playerCount;
        const nextPlayerId = playerOrder.at(nextIndex) ?? "";
        attempts++;
        if (nextPlayerId && isConnected(nextPlayerId)) {
            return { nextIndex, nextPlayerId };
        }
    } while (attempts < playerCount);

    return null;
}


