import * as Colyseus from 'colyseus.js';
import { ClientMessages, IGameState, IPlayer } from '../../../shared/SharedTypes';
import {
    PersistedReconnectContext,
    RECONNECT_MAX_WINDOW_MS,
    RECONNECT_STORAGE_KEY,
    getReconnectDelayMs,
    isReconnectContextFresh,
} from './ReconnectPolicy';

export type ReconnectStage = 'idle' | 'reconnecting' | 'reconnected' | 'failed';

export interface ReconnectStatus {
    stage: ReconnectStage;
    attempt: number;
    elapsedMs: number;
    maxWindowMs: number;
    nextRetryMs?: number;
    closeCode?: number;
    detail?: string;
}

export class ServerManager {
    private client: Colyseus.Client;
    public room?: Colyseus.Room<IGameState>;

    private currentCeoName = '';
    private currentRoomCode = '';
    private userRequestedLeave = false;
    private reconnecting = false;
    private reconnectLoopToken = 0;

    // Callback listeners for UI
    public onStateChange?: (state: IGameState) => void;
    public onPlayerChange?: (player: IPlayer) => void;
    public onRoomMessage?: (type: string | number, message: any) => void;
    public onReconnectStatus?: (status: ReconnectStatus) => void;

    constructor() {
        const endpoint = window.location.hostname === 'localhost' ? 'ws://localhost:2567' : `wss://${window.location.hostname}`;
        console.log('[ServerManager] ctor endpoint:', endpoint);
        this.client = new Colyseus.Client(endpoint);
    }

    async createOfficeRoom(ceoName: string, roomCode: string): Promise<Colyseus.Room<IGameState>> {
        console.log('[ServerManager] createOfficeRoom ceoName=', ceoName, 'roomCode=', roomCode);
        this.currentCeoName = String(ceoName ?? '').trim();
        this.currentRoomCode = String(roomCode ?? '').trim();
        this.userRequestedLeave = false;
        try {
            this.room = await this.client.create<IGameState>('office_room', { ceoName, roomCode });
            console.log('[ServerManager] joined office_room id=', this.room.id, 'sessionId=', this.room.sessionId);
            this.setupListeners();
            return this.room;
        } catch (e) {
            console.error('[ServerManager] Create Error', e);
            throw e;
        }
    }

    async joinOfficeRoom(ceoName: string, roomCode: string): Promise<Colyseus.Room<IGameState>> {
        console.log('[ServerManager] joinOfficeRoom ceoName=', ceoName, 'roomCode=', roomCode);
        this.currentCeoName = String(ceoName ?? '').trim();
        this.currentRoomCode = String(roomCode ?? '').trim();
        this.userRequestedLeave = false;
        try {
            this.room = await this.client.join<IGameState>('office_room', { ceoName, roomCode });
            console.log('[ServerManager] joined office_room id=', this.room.id, 'sessionId=', this.room.sessionId);
            this.setupListeners();
            return this.room;
        } catch (e) {
            console.error('[ServerManager] Join Error', e);
            throw e;
        }
    }

    async suggestRoomCode(): Promise<string> {
        let rooms: Colyseus.RoomAvailable[] = [];
        try {
            rooms = await this.client.getAvailableRooms('office_room');
        } catch {
            rooms = [];
        }

        const used = new Set(
            rooms
                .map((room) => String((room.metadata as any)?.roomCode ?? '').trim())
                .filter((code) => /^\d{4}$/.test(code)),
        );

        for (let i = 0; i < 40; i++) {
            const code = `${Math.floor(1000 + Math.random() * 9000)}`;
            if (!used.has(code)) return code;
        }
        return `${Math.floor(1000 + Math.random() * 9000)}`;
    }

    async roomCodeExists(roomCode: string): Promise<boolean> {
        try {
            const rooms = await this.client.getAvailableRooms('office_room');
            const normalized = String(roomCode ?? '').trim();
            return rooms.some((room) => String((room.metadata as any)?.roomCode ?? '').trim() === normalized);
        } catch {
            return false;
        }
    }

    private setupListeners() {
        if (!this.room) return;

        console.log('[ServerManager] setupListeners roomId=', this.room.id);
        const attachedRoom = this.room;
        this.persistReconnectContext(attachedRoom);

        attachedRoom.onStateChange((state) => {
            if (this.room !== attachedRoom) return;
            console.log('[ServerManager] onStateChange players size=', state.players.size);
            if (this.onStateChange) this.onStateChange(state);

            const me = state.players.get(attachedRoom.sessionId);
            if (me && this.onPlayerChange) {
                this.onPlayerChange(me);
            }
            this.persistReconnectContext(attachedRoom);
        });

        attachedRoom.onMessage('*', (type: any, message: any) => {
            if (this.room !== attachedRoom) return;
            console.log(`[ServerManager] Received explicit message [${type}]:`, message);
            if (this.onRoomMessage) this.onRoomMessage(type, message);
        });

        attachedRoom.onError((code: number, message?: string) => {
            if (this.room !== attachedRoom) return;
            console.warn('[ServerManager] room error', code, message ?? '');
            if (this.onRoomMessage) {
                this.onRoomMessage('ROOM_SOCKET_ERROR', { code, message });
            }
        });

        attachedRoom.onLeave((code: number) => {
            if (this.room !== attachedRoom) return;
            if (this.userRequestedLeave) {
                this.userRequestedLeave = false;
                this.room = undefined;
                this.clearReconnectContext();
                this.emitReconnectStatus({
                    stage: 'idle',
                    attempt: 0,
                    elapsedMs: 0,
                    maxWindowMs: RECONNECT_MAX_WINDOW_MS,
                    closeCode: code,
                });
                return;
            }

            console.warn('[ServerManager] room leave detected, starting reconnect flow. code=', code);
            this.room = undefined;
            void this.startReconnectFlow(code);
        });
    }

    public leaveRoom(consented: boolean = true) {
        this.userRequestedLeave = true;
        const activeRoom = this.room;
        this.room = undefined;
        this.clearReconnectContext();
        this.emitReconnectStatus({
            stage: 'idle',
            attempt: 0,
            elapsedMs: 0,
            maxWindowMs: RECONNECT_MAX_WINDOW_MS,
        });
        return activeRoom?.leave(consented);
    }

    private emitReconnectStatus(status: ReconnectStatus) {
        if (this.onReconnectStatus) this.onReconnectStatus(status);
    }

    private async startReconnectFlow(closeCode: number) {
        if (this.reconnecting) return;
        const persisted = this.loadReconnectContext();
        if (!isReconnectContextFresh(persisted) && (!this.currentCeoName || !this.currentRoomCode)) {
            this.emitReconnectStatus({
                stage: 'failed',
                attempt: 0,
                elapsedMs: 0,
                maxWindowMs: RECONNECT_MAX_WINDOW_MS,
                closeCode,
                detail: 'missing reconnect context',
            });
            return;
        }

        this.reconnecting = true;
        const loopToken = ++this.reconnectLoopToken;
        const startMs = Date.now();
        let attempt = 0;
        let lastError = '';

        while (!this.userRequestedLeave && Date.now() - startMs <= RECONNECT_MAX_WINDOW_MS) {
            attempt += 1;
            this.emitReconnectStatus({
                stage: 'reconnecting',
                attempt,
                elapsedMs: Date.now() - startMs,
                maxWindowMs: RECONNECT_MAX_WINDOW_MS,
                closeCode,
                detail: lastError || undefined,
            });

            try {
                const room = await this.tryReconnectOnce();
                if (loopToken !== this.reconnectLoopToken) {
                    try {
                        await room.leave(true);
                    } catch {
                        // no-op
                    }
                    this.reconnecting = false;
                    return;
                }

                this.room = room;
                this.userRequestedLeave = false;
                this.setupListeners();
                this.persistReconnectContext(room);
                this.reconnecting = false;
                this.emitReconnectStatus({
                    stage: 'reconnected',
                    attempt,
                    elapsedMs: Date.now() - startMs,
                    maxWindowMs: RECONNECT_MAX_WINDOW_MS,
                    closeCode,
                });
                return;
            } catch (err) {
                lastError = this.stringifyError(err);
            }

            const nextRetryMs = getReconnectDelayMs(attempt + 1);
            if (Date.now() - startMs + nextRetryMs > RECONNECT_MAX_WINDOW_MS) break;
            this.emitReconnectStatus({
                stage: 'reconnecting',
                attempt,
                elapsedMs: Date.now() - startMs,
                maxWindowMs: RECONNECT_MAX_WINDOW_MS,
                nextRetryMs,
                closeCode,
                detail: lastError || undefined,
            });
            await this.delay(nextRetryMs);
        }

        this.reconnecting = false;
        this.clearReconnectContext();
        this.emitReconnectStatus({
            stage: 'failed',
            attempt,
            elapsedMs: Date.now() - startMs,
            maxWindowMs: RECONNECT_MAX_WINDOW_MS,
            closeCode,
            detail: lastError || 'timeout',
        });
    }

    private async tryReconnectOnce(): Promise<Colyseus.Room<IGameState>> {
        const persisted = this.loadReconnectContext();
        const ceoName = String(this.currentCeoName || persisted?.ceoName || '').trim();
        const roomCode = String(this.currentRoomCode || persisted?.roomCode || '').trim();
        if (!ceoName || !roomCode) {
            throw new Error('Missing ceoName/roomCode for reconnect');
        }

        this.currentCeoName = ceoName;
        this.currentRoomCode = roomCode;

        const token = String(persisted?.reconnectToken ?? '').trim();
        if (token) {
            try {
                return await this.client.reconnect<IGameState>(token);
            } catch (err) {
                console.warn('[ServerManager] reconnect(token) failed:', this.stringifyError(err));
            }
        }

        const roomId = String(persisted?.roomId ?? '').trim();
        if (roomId) {
            try {
                return await this.client.joinById<IGameState>(roomId, { ceoName, roomCode });
            } catch (err) {
                console.warn('[ServerManager] joinById fallback failed:', this.stringifyError(err));
            }
        }

        return this.client.join<IGameState>('office_room', { ceoName, roomCode });
    }

    private persistReconnectContext(room?: Colyseus.Room<IGameState>) {
        const activeRoom = room ?? this.room;
        if (!activeRoom) return;
        if (!this.currentCeoName || !this.currentRoomCode) return;

        const snapshot: PersistedReconnectContext = {
            roomId: String(activeRoom.id ?? ''),
            sessionId: String(activeRoom.sessionId ?? ''),
            reconnectToken: String((activeRoom as any)?.reconnectionToken ?? ''),
            ceoName: this.currentCeoName,
            roomCode: this.currentRoomCode,
            updatedAt: Date.now(),
        };

        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
            // Ignore storage write failures.
        }
    }

    private loadReconnectContext(): PersistedReconnectContext | null {
        const storage = this.getStorage();
        if (!storage) return null;
        try {
            const raw = storage.getItem(RECONNECT_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as PersistedReconnectContext;
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch {
            return null;
        }
    }

    private clearReconnectContext() {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.removeItem(RECONNECT_STORAGE_KEY);
        } catch {
            // Ignore storage cleanup failures.
        }
    }

    private getStorage(): Storage | null {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return null;
            return window.localStorage;
        } catch {
            return null;
        }
    }

    private stringifyError(err: unknown): string {
        if (err instanceof Error) return err.message;
        return String(err ?? '');
    }

    private async delay(ms: number): Promise<void> {
        await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), Math.max(0, ms));
        });
    }

    // --- CLIENT -> SERVER actions ---

    public drawCard() {
        this.room?.send(ClientMessages.DRAW_CARD);
    }

    public playEmployee(cardId: string) {
        this.room?.send(ClientMessages.PLAY_EMPLOYEE, { cardId });
    }

    public playMagic(cardId: string, targetPlayerId?: string, targetHeroCardId?: string) {
        this.room?.send(ClientMessages.PLAY_MAGIC, { cardId, targetPlayerId, targetHeroCardId });
    }

    public solveCrisis(crisisId: string) {
        this.room?.send(ClientMessages.SOLVE_CRISIS, { crisisId });
    }

    public endTurn() {
        this.room?.send(ClientMessages.END_TURN);
    }

    public playReaction(cardId: string) {
        this.room?.send(ClientMessages.PLAY_REACTION, { cardId });
    }

    public sendEmote(emoteId: string) {
        this.room?.send(ClientMessages.EMOTE, { emoteId });
    }

    public joinGame() {
        this.room?.send(ClientMessages.JOIN_GAME);
    }

    public startMatch() {
        this.room?.send(ClientMessages.START_MATCH);
    }
}
