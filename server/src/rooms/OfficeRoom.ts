import { Room, Client, Delayed, ServerError } from "colyseus";
import {
    OfficeRoomState,
    PlayerState,
    PendingActionState,
    CardState,
} from "../State";
import {
    GamePhase,
    ClientMessages,
    ServerEvents,
    CardType,
    MAX_ACTION_POINTS,
    DRAW_CARD_COST,
    REACTION_WINDOW_MS,
    ITurnStartedEvent,
    ICardDrawnEvent,
    ICardData,
    JoinOptions
} from "../../../shared/SharedTypes";

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 3;

// ═════════════════════════════════════════════════════════
//  OfficeRoom — the authoritative game room
// ═════════════════════════════════════════════════════════
export class OfficeRoom extends Room<OfficeRoomState> {

    /** Handle to the reaction-window countdown timer */
    private reactionTimeout: Delayed | null = null;

    /** Server-side deck (not synchronized to state) */
    private serverDeck: ICardData[] = [];

    onCreate(_options: any): void {
        console.log("🏢 OfficeRoom created!");
        this.setState(new OfficeRoomState());
        // Nullify pendingAction by default since schema instantiates it empty
        this.state.pendingAction = null as any;

        this.maxClients = MAX_PLAYERS;

        // ── Register message handlers via ClientMessages enum ──
        this.onMessage(ClientMessages.JOIN_GAME, (client, data) => this.handleJoinGame(client, data));
        this.onMessage(ClientMessages.END_TURN, (client, _data) => this.handleEndTurn(client));
        this.onMessage(ClientMessages.DRAW_CARD, (client, _data) => this.handleDrawCard(client));
        this.onMessage(ClientMessages.PLAY_EMPLOYEE, (client, data) => this.handlePlayEmployee(client, data));
        this.onMessage(ClientMessages.PLAY_MAGIC, (client, data) => this.handlePlayMagic(client, data));
        this.onMessage(ClientMessages.SOLVE_CRISIS, (client, data) => this.handleSolveCrisis(client, data));
        this.onMessage(ClientMessages.PLAY_REACTION, (client, data) => this.handlePlayReaction(client, data));
        this.onMessage(ClientMessages.EMOTE, (client, data) => this.handleEmote(client, data));
    }

    onAuth(client: Client, options: JoinOptions, request: any) {
        // Validation: ceoName must be provided
        if (!options || !options.ceoName) {
            throw new ServerError(400, "Nome CEO mancante.");
        }

        const ceoName = options.ceoName;

        // Validation: ceoName must be string, 3-15 chars, alphanumeric
        if (typeof ceoName !== "string") {
            throw new ServerError(400, "Il nome CEO deve essere una stringa.");
        }

        if (ceoName.length < 3 || ceoName.length > 15) {
            throw new ServerError(400, "Il nome CEO deve essere compreso tra 3 e 15 caratteri.");
        }

        if (!/^[a-zA-Z0-9]+$/.test(ceoName)) {
            throw new ServerError(400, "Il nome CEO può contenere solo caratteri alfanumerici (niente spazi o simboli).");
        }

        // Return user data to be available in onJoin
        return { ceoName };
    }

    onJoin(client: Client, options: JoinOptions, auth?: { ceoName: string }): void {
        console.log(`👤 Player connected: ${client.sessionId}`);

        // Note: Joining the room doesn't automatically mean they are ready in the game.
        // We add them to state, but they must send JOIN_GAME to mark isReady = true.
        const player = new PlayerState();
        player.sessionId = client.sessionId;
        player.username = auth?.ceoName || options?.ceoName || `CEO_${client.sessionId.substring(0, 4)}`;
        player.actionPoints = 0; // AP are given when the game actually starts
        player.isConnected = true;
        player.isReady = false;

        this.state.players.set(client.sessionId, player);
    }

    async onLeave(client: Client, consented: boolean): Promise<void> {
        const player = this.state.players.get(client.sessionId);

        if (player) {
            player.isConnected = false;
            console.log(`👋 Player left: ${client.sessionId} (consented: ${consented})`);

            if (this.state.phase !== GamePhase.WAITING_FOR_PLAYERS && !consented) {
                try {
                    console.log(`   ⏳ Waiting for ${client.sessionId} to reconnect...`);
                    // Feature 01: 30 seconds reconnect timeout
                    await this.allowReconnection(client, 30);
                    player.isConnected = true;
                    console.log(`   ✅ ${client.sessionId} reconnected!`);
                    return;
                } catch {
                    console.log(`   ❌ ${client.sessionId} did not reconnect in time.`);
                }
            }

            // Remove player if they didn't reconnect or left consensually
            this.state.players.delete(client.sessionId);
            const orderIndex = this.state.playerOrder.indexOf(client.sessionId);
            if (orderIndex !== -1) {
                this.state.playerOrder.splice(orderIndex, 1);
            }
        }
    }

    // ─────────────────────────────────────────────────────
    //  Reaction Window & Turn Management
    // ─────────────────────────────────────────────────────

    private startReactionWindow(
        triggerPlayerId: string,
        actionType: ClientMessages.PLAY_EMPLOYEE | ClientMessages.SOLVE_CRISIS,
        targetCardId?: string,
        targetCrisisId?: string
    ): void {
        this.state.phase = GamePhase.REACTION_WINDOW;

        const pending = new PendingActionState();
        pending.playerId = triggerPlayerId;
        pending.actionType = actionType;
        if (targetCardId) pending.targetCardId = targetCardId;
        if (targetCrisisId) pending.targetCrisisId = targetCrisisId;
        pending.timestamp = Date.now();

        this.state.pendingAction = pending;
        this.state.reactionEndTime = pending.timestamp + REACTION_WINDOW_MS;

        console.log(`⏱️  Reaction Window opened! (${actionType} by ${triggerPlayerId})`);

        this.reactionTimeout = this.clock.setTimeout(() => {
            this.resolveReactions();
        }, REACTION_WINDOW_MS);
    }

    private resolveReactions(): void {
        this.state.phase = GamePhase.RESOLUTION;

        console.log(`🔥 Timer expired. Resolving effect for action: ${this.state.pendingAction?.actionType}`);

        // ── FASE 3 PLACEHOLDER ──────────────────────────────
        // Apply target effects, evaluate if reaction cancelled the action, etc.
        // ─────────────────────────────────────────────────────

        // Broadcast resolution result
        this.broadcast(ServerEvents.ACTION_RESOLVED, {
            originalActionType: this.state.pendingAction?.actionType,
            success: true // placeholder
        });

        // Clear reaction trace and restore phase
        this.state.pendingAction = null as any;
        this.state.reactionEndTime = 0;
        this.state.phase = GamePhase.PLAYER_TURN;

        console.log("   ✅ Turn restored.");
    }

    private advanceTurn(): void {
        const playerCount = this.state.playerOrder.length;
        if (playerCount === 0) return;

        let nextIndex = this.state.turnIndex;
        let attempts = 0;
        let nextPlayerId = "";

        // Loop to find next connected player
        do {
            nextIndex = (nextIndex + 1) % playerCount;
            nextPlayerId = this.state.playerOrder[nextIndex] ?? "";
            attempts++;
            // Break if we checked everyone (e.g. all offline)
            if (attempts >= playerCount) break;
        } while (
            !this.state.players.get(nextPlayerId)?.isConnected
        );

        this.state.turnIndex = nextIndex;
        this.state.currentTurnPlayerId = nextPlayerId;
        this.state.phase = GamePhase.PLAYER_TURN;
        this.state.turnNumber++;

        // Reset AP for the new active player
        const nextPlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (nextPlayer) {
            nextPlayer.actionPoints = MAX_ACTION_POINTS;
        }

        console.log(`➡️  Turn ${this.state.turnNumber}: ${this.state.currentTurnPlayerId}'s turn`);

        this.broadcast(ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: MAX_ACTION_POINTS
        } as ITurnStartedEvent);
    }

    // ─────────────────────────────────────────────────────
    //  Message Handlers (Validazioni incluse)
    // ─────────────────────────────────────────────────────

    private handleJoinGame(client: Client, _data: any): void {
        if (this.state.phase !== GamePhase.WAITING_FOR_PLAYERS) {
            client.send(ServerEvents.ERROR, { message: "Il gioco è già iniziato." });
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (player && !player.isReady) {
            player.isReady = true;
            this.state.playerOrder.push(client.sessionId);
            console.log(`   ${client.sessionId} is ready!`);
        }

        // Logic to automatically start if minimum players are met and everyone's ready
        // For simplicity now, if we have MIN_PLAYERS and they are all ready, start.
        if (this.state.playerOrder.length >= MIN_PLAYERS) {
            let allReady = Array.from(this.state.players.values()).every(p => p.isReady);

            // Evita di far ripartire in automatico il gioco ogni volta che qualcuno joinna una volta iniziato
            if (allReady && this.state.phase === GamePhase.WAITING_FOR_PLAYERS) {
                this.startGame();
            }
        }
    }

    private startGame(): void {
        this.state.phase = GamePhase.PLAYER_TURN;

        // Shuffle player order ArraySchema
        let players = Array.from(this.state.playerOrder);
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        while (this.state.playerOrder.length > 0) { this.state.playerOrder.pop(); }
        players.forEach(p => this.state.playerOrder.push(p));

        this.state.turnIndex = 0;
        this.state.currentTurnPlayerId = this.state.playerOrder[0] ?? "";
        this.state.turnNumber = 1;

        // Populate deck (placeholder until Agent 3 integrates createDeck)
        this.serverDeck = this.generatePlaceholderDeck();
        this.state.deckCount = this.serverDeck.length;

        // Assign PA to the first active player
        const activePlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (activePlayer) {
            activePlayer.actionPoints = MAX_ACTION_POINTS;
        }

        console.log(`🎮 Game started! First turn: ${this.state.currentTurnPlayerId}`);

        this.broadcast(ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: MAX_ACTION_POINTS
        } as ITurnStartedEvent);
    }

    private generatePlaceholderDeck(): ICardData[] {
        const deck: ICardData[] = [];
        for (let i = 0; i < 30; i++) {
            deck.push({
                id: `card_${Math.random().toString(36).substring(2, 9)}`,
                templateId: "emp_placeholder",
                type: CardType.EMPLOYEE
            });
        }
        return deck;
    }

    private handleEndTurn(client: Client): void {
        if (client.sessionId !== this.state.currentTurnPlayerId) {
            client.send(ServerEvents.ERROR, { code: "NOT_YOUR_TURN", message: "Non è il tuo turno." });
            return;
        }
        if (this.state.phase !== GamePhase.PLAYER_TURN) {
            client.send(ServerEvents.ERROR, { code: "WRONG_PHASE", message: "La fase non lo consente." });
            return;
        }

        this.advanceTurn();
    }

    private handleDrawCard(client: Client): void {
        if (!this.checkPlayerTurnAction(client, DRAW_CARD_COST)) return;

        // Check Deck Empty
        if (this.state.deckCount <= 0 || this.serverDeck.length <= 0) {
            client.send(ServerEvents.ERROR, { code: "DECK_EMPTY", message: "Il mazzo è vuoto." });
            // Refund PA
            const player = this.state.players.get(client.sessionId);
            if (player) player.actionPoints += DRAW_CARD_COST;
            return;
        }

        // Pop card from server deck
        const drawnCard = this.serverDeck.pop();
        if (!drawnCard) return;

        this.state.deckCount = this.serverDeck.length;

        const player = this.state.players.get(client.sessionId);
        if (player) {
            const cardSchema = new CardState();
            cardSchema.id = drawnCard.id;
            cardSchema.templateId = drawnCard.templateId;
            cardSchema.type = drawnCard.type;
            if (drawnCard.costPA !== undefined) cardSchema.costPA = drawnCard.costPA;
            if (drawnCard.isFaceUp !== undefined) cardSchema.isFaceUp = drawnCard.isFaceUp;

            player.hand.push(cardSchema);
        }

        console.log(`📥 DRAW_CARD by ${client.sessionId}. Deck left: ${this.state.deckCount}`);

        client.send(ServerEvents.CARD_DRAWN, {
            card: drawnCard,
            remainingDeck: this.state.deckCount
        } as ICardDrawnEvent);
    }

    private handlePlayEmployee(client: Client, data: any): void {
        // Assume PA cost is determined by card template, but we assume 1 PA for testing
        if (!this.checkPlayerTurnAction(client, 1)) return;

        console.log(`🃏 [STUB] PLAY_EMPLOYEE by ${client.sessionId}`);
        this.startReactionWindow(client.sessionId, ClientMessages.PLAY_EMPLOYEE, data?.cardId);
    }

    private handleSolveCrisis(client: Client, data: any): void {
        // Assume solving a crisis costs 2 PA
        if (!this.checkPlayerTurnAction(client, 2)) return;

        console.log(`💼 [STUB] SOLVE_CRISIS by ${client.sessionId}`);
        this.startReactionWindow(client.sessionId, ClientMessages.SOLVE_CRISIS, undefined, data?.crisisId);
    }

    private handlePlayMagic(client: Client, data: any): void {
        // Immediate magic
        if (!this.checkPlayerTurnAction(client, 1)) return;

        console.log(`✨ [STUB] PLAY_MAGIC by ${client.sessionId}`);
        client.send(ServerEvents.ERROR, { message: "Not implemented (FASE 3)" });
    }

    private handlePlayReaction(client: Client, data: any): void {
        if (this.state.phase !== GamePhase.REACTION_WINDOW) {
            client.send(ServerEvents.ERROR, { message: "Nessuna finestra di reazione attiva." });
            return;
        }

        if (client.sessionId === this.state.pendingAction?.playerId) {
            client.send(ServerEvents.ERROR, { message: "Non puoi reagire alla tua stessa azione." });
            return;
        }

        // We would validate if they have PA or valid cards here.
        console.log(`🗡️  Reaction queued by ${client.sessionId} (Card: ${data?.cardId})`);
        this.broadcast(ServerEvents.REACTION_TRIGGERED, {
            playerId: client.sessionId,
            cardId: data?.cardId
        });

        // FASE 3: We will queue this interaction into a hidden structure on the server
        // so `resolveReactions` can process it later.
    }

    private handleEmote(client: Client, data: any): void {
        // Broadcast emote to everyone instantly
        // Wait, ClientMessages.EMOTE means it's coming from client.
        // We probably broadcast a ServerEvents structure if there was one, 
        // but let's just use room broadcast.
        console.log(`💬 Emote from ${client.sessionId}: ${data?.emoteId}`);
    }

    // ─────────────────────────────────────────────────────
    //  Validazione Tripla Helper
    // ─────────────────────────────────────────────────────
    private checkPlayerTurnAction(client: Client, requiredPA: number): boolean {
        // 1. Turn validation
        if (client.sessionId !== this.state.currentTurnPlayerId) {
            client.send(ServerEvents.ERROR, { code: "NOT_YOUR_TURN", message: "Non è il tuo turno." });
            return false;
        }

        // 2. Phase validation
        if (this.state.phase !== GamePhase.PLAYER_TURN) {
            client.send(ServerEvents.ERROR, { code: "WRONG_PHASE", message: "Fase non corretta." });
            return false;
        }

        // 3. Resource validation
        const player = this.state.players.get(client.sessionId);
        if (!player || player.actionPoints < requiredPA) {
            client.send(ServerEvents.ERROR, { code: "NO_PA", message: "Punti Azione insufficienti." });
            return false;
        }

        // Deduct PA immediately
        player.actionPoints -= requiredPA;
        return true;
    }
}
