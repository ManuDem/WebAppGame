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

    async joinOfficeRoom(ceoName: string): Promise<Colyseus.Room<IGameState>> {
        console.log('[ServerManager] joinOfficeRoom – ceoName=', ceoName);
        try {
            this.room = await this.client.joinOrCreate<IGameState>('office_room', { ceoName });
            console.log('[ServerManager] joined office_room – id=', this.room.id, 'sessionId=', this.room.sessionId);

            this.setupListeners();
            return this.room;
        } catch (e) {
            console.error('[ServerManager] Join Error', e);
            throw e;
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

    public playMagic(cardId: string) {
        this.room?.send(ClientMessages.PLAY_MAGIC, { cardId });
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
}
