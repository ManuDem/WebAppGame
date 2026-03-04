import * as Colyseus from 'colyseus.js';
import { ClientMessages, IGameState, IPlayer } from '../../../shared/SharedTypes';

export class ServerManager {
    private client: Colyseus.Client;
    public room?: Colyseus.Room<IGameState>;

    // Callbacks listeners per la UI
    public onStateChange?: (state: IGameState) => void;
    public onPlayerChange?: (player: IPlayer) => void;
    public onRoomMessage?: (type: string | number, message: any) => void;

    constructor() {
        const endpoint = window.location.hostname === 'localhost' ? 'ws://localhost:2567' : `wss://${window.location.hostname}`;
        console.log('[ServerManager] ctor – endpoint:', endpoint);
        this.client = new Colyseus.Client(endpoint);
    }

    async createOfficeRoom(ceoName: string, roomCode: string): Promise<Colyseus.Room<IGameState>> {
        console.log('[ServerManager] createOfficeRoom – ceoName=', ceoName, 'roomCode=', roomCode);
        try {
            this.room = await this.client.create<IGameState>('office_room', { ceoName, roomCode });
            console.log('[ServerManager] joined office_room – id=', this.room.id, 'sessionId=', this.room.sessionId);
            this.setupListeners();
            return this.room;
        } catch (e) {
            console.error('[ServerManager] Create Error', e);
            throw e;
        }
    }

    async joinOfficeRoom(ceoName: string, roomCode: string): Promise<Colyseus.Room<IGameState>> {
        console.log('[ServerManager] joinOfficeRoom – ceoName=', ceoName, 'roomCode=', roomCode);
        try {
            this.room = await this.client.join<IGameState>('office_room', { ceoName, roomCode });
            console.log('[ServerManager] joined office_room – id=', this.room.id, 'sessionId=', this.room.sessionId);

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

        console.log('[ServerManager] setupListeners – roomId=', this.room.id);

        // Callback dello state schema
        this.room.onStateChange((state) => {
            console.log('[ServerManager] onStateChange – players size=', state.players.size);
            if (this.onStateChange) this.onStateChange(state);

            // Ascolta cambiamenti specifici al giocatore locale
            const me = state.players.get(this.room!.sessionId);
            if (me && this.onPlayerChange) {
                this.onPlayerChange(me);
            }
        });

        this.room.onMessage('*', (type: any, message: any) => {
            console.log(`[ServerManager] Received explicit message [${type}]:`, message);
            if (this.onRoomMessage) this.onRoomMessage(type, message);
        });
    }

    // --- AZIONI CLIENT -> SERVER ---

    public drawCard() {
        this.room?.send(ClientMessages.DRAW_CARD);
    }

    public playEmployee(cardId: string) {
        this.room?.send(ClientMessages.PLAY_EMPLOYEE, { cardId });
    }

    public playMagic(cardId: string, targetPlayerId?: string) {
        this.room?.send(ClientMessages.PLAY_MAGIC, { cardId, targetPlayerId });
    }

    public solveCrisis(_cardId: string, crisisId: string) {
        this.room?.send(ClientMessages.SOLVE_CRISIS, { crisisId });
    }

    public endTurn() {
        this.room?.send(ClientMessages.END_TURN);
    }

    public playReaction(cardId: string) {
        this.room?.send(ClientMessages.PLAY_REACTION, { cardId });
    }

    public joinGame() {
        this.room?.send(ClientMessages.JOIN_GAME);
    }

    public startMatch() {
        this.room?.send(ClientMessages.START_MATCH);
    }
}
