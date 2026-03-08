import { GamePhase, IPendingAction, JoinOptions } from '../../../shared/SharedTypes';
import { PlayerState } from '../State';

interface ValidationSuccess<T> {
    ok: true;
    value: T;
}

interface ValidationFailure {
    ok: false;
    statusCode: number;
    message: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

interface ExistingPlayerSlot {
    sessionId: string;
    isConnected: boolean;
}

interface ValidateJoinRequestInput {
    options?: JoinOptions | null;
    expectedRoomCode: string;
    phase: GamePhase;
    existingPlayer?: ExistingPlayerSlot | null;
}

export interface JoinRequestContext {
    ceoName: string;
    rejoinFromSessionId: string | null;
}

type PlayerDirectory = {
    has: (sessionId: string) => boolean;
    get: (sessionId: string) => PlayerState | undefined;
    set: (sessionId: string, player: PlayerState) => unknown;
    delete: (sessionId: string) => unknown;
};

export interface OfficeRoomReconnectState {
    players: PlayerDirectory;
    playerOrder: string[];
    currentTurnPlayerId: string;
    pendingAction?: { playerId?: string; targetPlayerId?: string } | null;
    actionStack: IPendingAction[];
    hostSessionId: string;
}

const CEO_NAME_PATTERN = /^[a-zA-Z0-9]+$/;
const OPEN_JOIN_PHASES = new Set([GamePhase.WAITING_FOR_PLAYERS, GamePhase.PRE_LOBBY]);

export function validateOfficeRoomCode(raw: unknown): ValidationResult<string> {
    const code = String(raw ?? '').trim();
    if (!/^\d{4}$/.test(code)) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Il codice stanza deve avere 4 cifre.',
        };
    }

    return { ok: true, value: code };
}

export function validateOfficeRoomJoinRequest(input: ValidateJoinRequestInput): ValidationResult<JoinRequestContext> {
    const ceoName = String(input.options?.ceoName ?? '').trim();
    if (!ceoName) {
        return { ok: false, statusCode: 400, message: 'Nome CEO mancante.' };
    }

    const roomCode = validateOfficeRoomCode(input.options?.roomCode);
    if (!roomCode.ok) return roomCode;
    if (roomCode.value !== input.expectedRoomCode) {
        return { ok: false, statusCode: 404, message: 'Codice stanza non valido.' };
    }

    if (ceoName.length < 3 || ceoName.length > 15) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Il nome CEO deve essere compreso tra 3 e 15 caratteri.',
        };
    }

    if (!CEO_NAME_PATTERN.test(ceoName)) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Il nome CEO puo contenere solo caratteri alfanumerici (niente spazi o simboli).',
        };
    }

    if (input.existingPlayer?.isConnected) {
        return {
            ok: false,
            statusCode: 409,
            message: 'Nome CEO gia in uso in questa stanza.',
        };
    }

    if (!OPEN_JOIN_PHASES.has(input.phase) && !input.existingPlayer) {
        return {
            ok: false,
            statusCode: 403,
            message: 'Partita gia in corso. Puoi rientrare solo con un nome gia presente.',
        };
    }

    return {
        ok: true,
        value: {
            ceoName,
            rejoinFromSessionId: input.existingPlayer?.sessionId ?? null,
        },
    };
}

export function rebindDisconnectedPlayerSession(
    state: OfficeRoomReconnectState,
    previousSessionId: string,
    nextSessionId: string,
): PlayerState | null {
    if (!state.players.has(previousSessionId)) return null;

    const player = state.players.get(previousSessionId);
    if (!player) return null;

    state.players.delete(previousSessionId);
    player.sessionId = nextSessionId;
    player.isConnected = true;
    state.players.set(nextSessionId, player);

    const orderIndex = state.playerOrder.indexOf(previousSessionId);
    if (orderIndex !== -1) {
        state.playerOrder.splice(orderIndex, 1, nextSessionId);
    }

    if (state.currentTurnPlayerId === previousSessionId) {
        state.currentTurnPlayerId = nextSessionId;
    }

    if (state.pendingAction) {
        if (state.pendingAction.playerId === previousSessionId) {
            state.pendingAction.playerId = nextSessionId;
        }
        if (state.pendingAction.targetPlayerId === previousSessionId) {
            state.pendingAction.targetPlayerId = nextSessionId;
        }
    }

    state.actionStack = state.actionStack.map((action) => ({
        ...action,
        playerId: action.playerId === previousSessionId ? nextSessionId : action.playerId,
        targetPlayerId: action.targetPlayerId === previousSessionId ? nextSessionId : action.targetPlayerId,
    }));

    if (state.hostSessionId === previousSessionId) {
        state.hostSessionId = nextSessionId;
    }

    return player;
}
