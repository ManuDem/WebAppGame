import {
    ClientMessages,
    GamePhase,
    IGameState,
    IPlayer,
    MAX_ACTION_POINTS,
    MIN_PLAYERS_TO_START,
    ServerEvents,
} from '../../../shared/SharedTypes';
import { sanitizeLanguage, SupportedLanguage, t } from '../i18n';

const HOST_ID = 'qa_host';
const JOIN_ID = 'qa_join';
const EXTRA_ID = 'qa_extra';

function createPlayer(
    sessionId: string,
    username: string,
    ready: boolean,
    connected: boolean,
): IPlayer {
    return {
        sessionId,
        username,
        isReady: ready,
        isConnected: connected,
        actionPoints: 0,
        hand: [],
        company: [],
        score: 0,
        victories: 0,
        activeEffects: [],
    };
}

function createInitialState(lang: SupportedLanguage): IGameState {
    const players = new Map<string, IPlayer>();
    players.set(HOST_ID, createPlayer(HOST_ID, t(lang, 'qa_mock_local_name'), true, true));
    players.set(JOIN_ID, createPlayer(JOIN_ID, t(lang, 'qa_mock_opp_north'), false, true));
    players.set(EXTRA_ID, createPlayer(EXTRA_ID, t(lang, 'qa_mock_opp_south'), true, true));

    return {
        phase: GamePhase.PRE_LOBBY,
        players,
        hostSessionId: HOST_ID,
        playerOrder: [HOST_ID, JOIN_ID, EXTRA_ID],
        currentTurnPlayerId: HOST_ID,
        turnIndex: 0,
        centralCrises: [],
        deckCount: 0,
        actionStack: [],
        pendingAction: null,
        reactionEndTime: 0,
        turnNumber: 0,
    };
}

export class MockPreLobbyServerManager {
    public room?: { sessionId: string; state: IGameState };
    public onStateChange?: (state: IGameState) => void;
    public onPlayerChange?: (player: IPlayer) => void;
    public onRoomMessage?: (type: string | number, message: any) => void;

    private readonly lang: SupportedLanguage;

    constructor(lang: SupportedLanguage) {
        this.lang = sanitizeLanguage(lang);
        this.room = {
            sessionId: HOST_ID,
            state: createInitialState(this.lang),
        };
    }

    private emitState() {
        if (!this.room) return;
        this.onStateChange?.(this.room.state);
        const me = this.room.state.players.get(this.room.sessionId);
        if (me) this.onPlayerChange?.(me);
    }

    private emitError(code: string, key: string) {
        this.onRoomMessage?.(ServerEvents.ERROR, {
            code,
            message: t(this.lang, key),
        });
    }

    public joinGame() {
        if (!this.room) return;
        const me = this.room.state.players.get(this.room.sessionId);
        if (!me) return;
        me.isReady = true;
        this.emitState();
    }

    public startMatch() {
        if (!this.room) return;
        const state = this.room.state;
        const hostId = state.hostSessionId;
        if (this.room.sessionId !== hostId) {
            this.emitError('HOST_ONLY', 'game_error_host_only');
            return;
        }

        const connected = Array.from(state.players.values()).filter((p) => p.isConnected);
        if (connected.length < MIN_PLAYERS_TO_START) {
            this.emitError('NOT_ENOUGH_PLAYERS', 'game_error_not_enough_players');
            return;
        }
        if (!connected.every((p) => p.isReady)) {
            this.emitError('PLAYERS_NOT_READY', 'game_error_players_not_ready');
            return;
        }

        state.phase = GamePhase.PLAYER_TURN;
        state.turnNumber = 1;
        state.turnIndex = 0;
        state.currentTurnPlayerId = state.playerOrder[0] ?? HOST_ID;
        const active = state.players.get(state.currentTurnPlayerId);
        if (active) active.actionPoints = MAX_ACTION_POINTS;
        this.onRoomMessage?.(ServerEvents.TURN_STARTED, {
            playerId: state.currentTurnPlayerId,
            turnNumber: state.turnNumber,
            actionPoints: active?.actionPoints ?? MAX_ACTION_POINTS,
            actionTypeLabel: ClientMessages.START_MATCH,
        });
        this.emitState();
    }
}

export function createMockPreLobbyServerManager(lang: SupportedLanguage): MockPreLobbyServerManager {
    return new MockPreLobbyServerManager(lang);
}

