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
    ICardTemplate,
    IPendingAction,
    JoinOptions,
    IPlayEmployeePayload,
    ISolveCrisisPayload,
    IPlayMagicPayload,
    IPlayReactionPayload,
    IEmotePayload,
    IStartReactionTimerPayload,
    IGameWonEvent,
    IErrorEvent,
} from "../../../shared/SharedTypes";
import { DeckManager } from "../../../shared/DeckManager";
import { CardEffectParser, IResolveQueueResult } from "../../../shared/CardEffectParser";
import cardsDbRaw from "../../../shared/cards_db.json";

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 3;

/** Win conditions */
const WIN_EMPLOYEES = 5;   // Monopolio Umano: 5 dipendenti in company
const WIN_CRISES = 3;   // Problem Solver: 3 crisi risolte (VP score)

// ═════════════════════════════════════════════════════════
//  OfficeRoom — the authoritative game room
// ═════════════════════════════════════════════════════════
export class OfficeRoom extends Room<OfficeRoomState> {

    /** Handle to the reaction-window countdown timer */
    private reactionTimeout: Delayed | null = null;

    /** Server-side deck (not synchronized to state) */
    protected serverDeck: ICardData[] = [];

    /** Card template lookup map (templateId → ICardTemplate) built from cards_db.json */
    private cardTemplates: Map<string, ICardTemplate> = new Map();

    // ─────────────────────────────────────────────────────
    //  Lifecycle
    // ─────────────────────────────────────────────────────

    onCreate(_options: any): void {
        console.log("🏢 OfficeRoom created!");
        console.log("[ROOM] OfficeRoom.onCreate called with options:", _options);
        this.setState(new OfficeRoomState());
        this.state.pendingAction = null as any;
        this.maxClients = MAX_PLAYERS;
        console.log("[ROOM] Max clients set to:", this.maxClients);

        // Build card template lookup from embedded JSON
        this.buildCardTemplateLookup();

        this.onMessage(ClientMessages.JOIN_GAME, (client, data) => this.handleJoinGame(client, data));
        this.onMessage(ClientMessages.END_TURN, (client, _data) => this.handleEndTurn(client));
        this.onMessage(ClientMessages.DRAW_CARD, (client, _data) => this.handleDrawCard(client));
        this.onMessage(ClientMessages.PLAY_EMPLOYEE, (client, data) => this.handlePlayEmployee(client, data));
        this.onMessage(ClientMessages.PLAY_MAGIC, (client, data) => this.handlePlayMagic(client, data));
        this.onMessage(ClientMessages.SOLVE_CRISIS, (client, data) => this.handleSolveCrisis(client, data));
        this.onMessage(ClientMessages.PLAY_REACTION, (client, data) => this.handlePlayReaction(client, data));
        this.onMessage(ClientMessages.EMOTE, (client, data) => this.handleEmote(client, data));
    }

    onAuth(client: Client, options: JoinOptions, _request: any) {
        console.log("[AUTH] Incoming auth request from client", client.sessionId, "options:", { ceoName: options?.ceoName });
        if (!options?.ceoName) {
            console.warn("[AUTH] Rejected: missing ceoName");
            throw new ServerError(400, "Nome CEO mancante.");
        }
        const ceoName = options.ceoName;
        if (typeof ceoName !== "string") {
            console.warn("[AUTH] Rejected: ceoName is not a string", ceoName);
            throw new ServerError(400, "Il nome CEO deve essere una stringa.");
        }
        if (ceoName.length < 3 || ceoName.length > 15) {
            console.warn("[AUTH] Rejected: ceoName invalid length", ceoName);
            throw new ServerError(400, "Il nome CEO deve essere compreso tra 3 e 15 caratteri.");
        }
        if (!/^[a-zA-Z0-9]+$/.test(ceoName)) {
            console.warn("[AUTH] Rejected: ceoName invalid characters", ceoName);
            throw new ServerError(400, "Il nome CEO può contenere solo caratteri alfanumerici (niente spazi o simboli).");
        }
        console.log("[AUTH] Accepted client", client.sessionId, "ceoName:", ceoName);
        return { ceoName };
    }

    onJoin(client: Client, options: JoinOptions, auth?: { ceoName: string }): void {
        console.log(`👤 Player connected: ${client.sessionId}`);
        const player = new PlayerState();
        player.sessionId = client.sessionId;
        player.username = auth?.ceoName || options?.ceoName || `CEO_${client.sessionId.substring(0, 4)}`;
        player.actionPoints = 0;
        player.isConnected = true;
        player.isReady = false;
        this.state.players.set(client.sessionId, player);
        console.log("[JOIN] onJoin for session", client.sessionId, "username:", player.username);
        console.log("[JOIN] Current players:", Array.from(this.state.players.keys()));
    }

    async onLeave(client: Client, consented: boolean): Promise<void> {
        console.log("[LEAVE] onLeave for session", client.sessionId, "consented:", consented);
        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.isConnected = false;
        }

        console.log(`👋 Player left: ${client.sessionId} (consented: ${consented})`);

        // Check if it's their turn. If so, start a 5s fallback to automatically skip
        // their turn so the game isn't completely paralyzed
        let skipTimeout: Delayed | null = null;
        if (this.state.currentTurnPlayerId === client.sessionId && this.state.phase === GamePhase.PLAYER_TURN) {
            console.log(`   ⏱️  Active player disconnected. Waiting 5s before advancing turn...`);
            skipTimeout = this.clock.setTimeout(() => {
                const p = this.state.players.get(client.sessionId);
                if (p && !p.isConnected && this.state.currentTurnPlayerId === client.sessionId && this.state.phase === GamePhase.PLAYER_TURN) {
                    console.log(`   ⏭️  5s passed. Auto-skipping turn for disconnected player.`);
                    this.advanceTurn();
                }
            }, 5000);
        }

        if (!consented) {
            try {
                // Se è un refresh accidentale/resize brutale aspetta 30 secondi
                console.log(`   ⏳ Waiting for ${client.sessionId} to reconnect...`);
                const newClient = await this.allowReconnection(client, 30);

                // Se si riconnette, il framework mappa in automatico il nuovo client alla stessa entità
                if (player) {
                    player.isConnected = true;
                    console.log(`   ✅ ${newClient.sessionId} (formerly ${client.sessionId}) reconnected!`);
                }

                // If they reconnected before the 5s skip, cancel the skip
                if (skipTimeout) {
                    skipTimeout.clear();
                    console.log(`   👍 Timely reconnection. Turn skip cancelled.`);
                }
            } catch (e) {
                // Timeout di 30s scaduto, cancellare il giocatore definitivamente dallo State
                console.log(`   ❌ Timeout expired. Deleting player ${client.sessionId}.`);
                this.state.players.delete(client.sessionId);

                const orderIndex = this.state.playerOrder.indexOf(client.sessionId);
                if (orderIndex !== -1) this.state.playerOrder.splice(orderIndex, 1);
            }
        }
    }

    // ─────────────────────────────────────────────────────
    //  Card Template Lookup
    // ─────────────────────────────────────────────────────

    private buildCardTemplateLookup(): void {
        if (!Array.isArray(cardsDbRaw) || cardsDbRaw.length === 0) {
            console.error("[ROOM] FATAL: cards_db.json is missing, invalid or empty. Card templates will not be available.");
            return;
        }

        for (const raw of cardsDbRaw as any[]) {
            if (!raw || typeof raw.id !== "string") {
                console.warn("[ROOM] Skipping invalid card template entry from cards_db.json:", raw);
                continue;
            }
            this.cardTemplates.set(raw.id, raw as ICardTemplate);
        }

        if (this.cardTemplates.size === 0) {
            console.error("[ROOM] FATAL: No valid card templates loaded from cards_db.json.");
        } else {
            console.log(`📚 Loaded ${this.cardTemplates.size} card templates from cards_db.json`);
        }
    }

    private getTemplate(templateId: string): ICardTemplate | undefined {
        return this.cardTemplates.get(templateId);
    }

    // ─────────────────────────────────────────────────────
    //  Game Start
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
        if (this.state.playerOrder.length >= MIN_PLAYERS) {
            const allReady = Array.from(this.state.players.values()).every(p => p.isReady);
            if (allReady && this.state.phase === GamePhase.WAITING_FOR_PLAYERS) {
                this.startGame();
            }
        }
    }

    private startGame(): void {
        this.state.phase = GamePhase.PLAYER_TURN;

        // Fisher-Yates shuffle of player order
        const players = Array.from(this.state.playerOrder);
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        while (this.state.playerOrder.length > 0) this.state.playerOrder.pop();
        players.forEach(p => this.state.playerOrder.push(p));

        this.state.turnIndex = 0;
        this.state.currentTurnPlayerId = this.state.playerOrder[0] ?? "";
        this.state.turnNumber = 1;

        // Build real deck via DeckManager
        try {
            this.serverDeck = DeckManager.createDeck();
        } catch (err) {
            console.error("[ROOM] FATAL: Failed to create deck from cards_db.json:", err);
            this.broadcast(ServerEvents.ERROR, {
                code: "DECK_INIT_FAILED",
                message: "Errore interno nel mazzo di gioco. Partita annullata."
            } as IErrorEvent);
            this.state.phase = GamePhase.GAME_OVER;
            return;
        }

        if (!this.serverDeck || this.serverDeck.length === 0) {
            console.error("[ROOM] FATAL: DeckManager.createDeck returned an empty deck. Aborting game start.");
            this.broadcast(ServerEvents.ERROR, {
                code: "DECK_EMPTY_INIT",
                message: "Impossibile iniziare la partita: mazzo vuoto."
            } as IErrorEvent);
            this.state.phase = GamePhase.GAME_OVER;
            return;
        }

        this.state.deckCount = this.serverDeck.length;
        console.log(`🃏 Deck ready: ${this.state.deckCount} cards`);

        // Populate central crises (crisis type only, up to 3)
        this.populateCentralCrises();

        // Give PA to first active player
        const activePlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (activePlayer) activePlayer.actionPoints = MAX_ACTION_POINTS;

        console.log(`🎮 Game started! First turn: ${this.state.currentTurnPlayerId}`);
        this.broadcast(ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: MAX_ACTION_POINTS
        } as ITurnStartedEvent);
    }

    private populateCentralCrises(): void {
        const crisisTemplates = Array.from(this.cardTemplates.values()).filter(t => t.type === "crisis");
        const max = Math.min(crisisTemplates.length, 3);
        for (let i = 0; i < max; i++) {
            const t = crisisTemplates[i]!;
            const card = new CardState();
            card.id = this.generateId();
            card.templateId = t.id;
            card.type = CardType.CRISIS;
            card.costPA = t.cost;
            card.isFaceUp = true;
            card.name = t.name;
            this.state.centralCrises.push(card);
        }
        console.log(`🏦 Central crises populated: ${this.state.centralCrises.length}`);
    }

    // ─────────────────────────────────────────────────────
    //  Turn Management
    // ─────────────────────────────────────────────────────

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

    private advanceTurn(): void {
        const playerCount = this.state.playerOrder.length;
        if (playerCount === 0) return;

        let nextIndex = this.state.turnIndex;
        let attempts = 0;
        let nextPlayerId = "";

        do {
            nextIndex = (nextIndex + 1) % playerCount;
            nextPlayerId = this.state.playerOrder[nextIndex] ?? "";
            attempts++;
            if (attempts >= playerCount) break;
        } while (!this.state.players.get(nextPlayerId)?.isConnected);

        this.state.turnIndex = nextIndex;
        this.state.currentTurnPlayerId = nextPlayerId;
        this.state.phase = GamePhase.PLAYER_TURN;
        this.state.turnNumber++;

        const nextPlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (nextPlayer) nextPlayer.actionPoints = MAX_ACTION_POINTS;

        console.log(`➡️  Turn ${this.state.turnNumber}: ${this.state.currentTurnPlayerId}`);
        this.broadcast(ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: MAX_ACTION_POINTS
        } as ITurnStartedEvent);
    }

    // ─────────────────────────────────────────────────────
    //  DRAW_CARD — uses DeckManager.drawCard
    // ─────────────────────────────────────────────────────

    private handleDrawCard(client: Client): void {
        if (!this.checkPlayerTurnAction(client, DRAW_CARD_COST)) return;

        const drawnCard = DeckManager.drawCard(this.serverDeck);
        if (!drawnCard) {
            client.send(ServerEvents.ERROR, { code: "DECK_EMPTY", message: "Il mazzo è vuoto." });
            // Refund PA
            const player = this.state.players.get(client.sessionId);
            if (player) player.actionPoints += DRAW_CARD_COST;
            return;
        }

        this.state.deckCount = this.serverDeck.length;

        const player = this.state.players.get(client.sessionId);
        if (player) {
            const card = new CardState();
            card.id = drawnCard.id;
            card.templateId = drawnCard.templateId;
            card.type = drawnCard.type;
            if (drawnCard.costPA !== undefined) card.costPA = drawnCard.costPA;
            card.isFaceUp = false;
            // Enrich with template name (visible only to owner via Fog of War filter)
            const tmpl = this.getTemplate(drawnCard.templateId);
            if (tmpl) { card.name = tmpl.name; card.description = tmpl.description; }
            player.hand.push(card);
        }

        console.log(`📥 DRAW_CARD by ${client.sessionId}. Deck left: ${this.state.deckCount}`);
        client.send(ServerEvents.CARD_DRAWN, {
            card: drawnCard,
            remainingDeck: this.state.deckCount
        } as ICardDrawnEvent);

        this.checkWinConditions();
    }

    // ─────────────────────────────────────────────────────
    //  PLAY_EMPLOYEE — Reaction Window trigger
    // ─────────────────────────────────────────────────────

    private handlePlayEmployee(client: Client, data: IPlayEmployeePayload): void {
        const { cardId } = data;
        if (!cardId) {
            client.send(ServerEvents.ERROR, { code: "MISSING_CARD_ID", message: "Specifica il cardId." });
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        const handArr = player.hand as any[];
        const cardIdx = handArr.findIndex((c: any) => c.id === cardId);
        if (cardIdx === -1) {
            client.send(ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non è nella tua mano." });
            return;
        }

        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const cost = template?.cost ?? 1;

        if (!this.checkPlayerTurnAction(client, cost)) return;

        // PA deducted. Remove card from hand (stored in pending until resolve).
        handArr.splice(cardIdx, 1);

        // Populate pendingAction
        const pending = new PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = ClientMessages.PLAY_EMPLOYEE;
        pending.targetCardId = cardInHand.templateId; // templateId for CardEffectParser lookup
        pending.timestamp = Date.now();

        this.state.pendingAction = pending;
        this.state.phase = GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + REACTION_WINDOW_MS;

        // Seed the LIFO action stack with the original action (at index 0)
        this.state.actionStack = [pending as IPendingAction];

        // Start server-side timeout
        if (this.reactionTimeout) this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), REACTION_WINDOW_MS);

        console.log(`🃏 PLAY_EMPLOYEE by ${client.sessionId}: ${template?.name} (cost ${cost} PA). Window open.`);

        // Broadcast START_REACTION_TIMER so Phaser shows animated countdown
        this.broadcast(ServerEvents.START_REACTION_TIMER, {
            durationMs: REACTION_WINDOW_MS,
            actionTypeLabel: `Assunzione di "${template?.name ?? cardInHand.templateId}" in corso!`
        } as IStartReactionTimerPayload);
    }

    // ─────────────────────────────────────────────────────
    //  SOLVE_CRISIS — Reaction Window trigger
    // ─────────────────────────────────────────────────────

    private handleSolveCrisis(client: Client, data: ISolveCrisisPayload): void {
        const { crisisId } = data;
        if (!crisisId) {
            client.send(ServerEvents.ERROR, { code: "MISSING_CRISIS_ID", message: "Specifica il crisisId." });
            return;
        }

        const crisisArr = this.state.centralCrises as any[];
        const crisis = crisisArr.find((c: any) => c.id === crisisId);
        if (!crisis) {
            client.send(ServerEvents.ERROR, { code: "CRISIS_NOT_FOUND", message: "La crisi non esiste sulla plancia." });
            return;
        }

        const template = this.getTemplate(crisis.templateId);
        const cost = template?.cost ?? 2;

        if (!this.checkPlayerTurnAction(client, cost)) return;

        // Populate pendingAction
        const pending = new PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = ClientMessages.SOLVE_CRISIS;
        pending.targetCrisisId = crisisId;
        pending.targetCardId = crisis.templateId; // for CardEffectParser resolve
        pending.timestamp = Date.now();

        this.state.pendingAction = pending;
        this.state.phase = GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + REACTION_WINDOW_MS;
        this.state.actionStack = [pending as IPendingAction];

        if (this.reactionTimeout) this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), REACTION_WINDOW_MS);

        const player = this.state.players.get(client.sessionId);
        console.log(`💼 SOLVE_CRISIS by ${client.sessionId}: ${template?.name}. Window open.`);

        this.broadcast(ServerEvents.START_REACTION_TIMER, {
            durationMs: REACTION_WINDOW_MS,
            actionTypeLabel: `Risoluzione crisi "${template?.name ?? crisis.templateId}" in corso!`
        } as IStartReactionTimerPayload);
    }

    // ─────────────────────────────────────────────────────
    //  PLAY_MAGIC — immediate (no Reaction Window)
    // ─────────────────────────────────────────────────────

    private handlePlayMagic(client: Client, data: IPlayMagicPayload): void {
        const { cardId, targetPlayerId } = data;
        if (!cardId) {
            client.send(ServerEvents.ERROR, { code: "MISSING_CARD_ID", message: "Specifica il cardId." });
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        const handArr = player.hand as any[];
        const cardIdx = handArr.findIndex((c: any) => c.id === cardId);
        if (cardIdx === -1) {
            client.send(ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non è nella tua mano." });
            return;
        }

        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const cost = template?.cost ?? 1;

        if (!this.checkPlayerTurnAction(client, cost)) return;

        // Deduct PA and remove from hand immediately
        handArr.splice(cardIdx, 1);

        // Populate pendingAction 
        const pending = new PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = ClientMessages.PLAY_MAGIC;
        pending.targetCardId = cardInHand.templateId; // templateId for CardEffectParser
        pending.targetPlayerId = targetPlayerId;
        pending.timestamp = Date.now();

        this.state.pendingAction = pending;
        this.state.phase = GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + REACTION_WINDOW_MS;
        this.state.actionStack = [pending as IPendingAction];

        if (this.reactionTimeout) this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), REACTION_WINDOW_MS);

        console.log(`✨ PLAY_MAGIC by ${client.sessionId}: ${template?.name}. Window open.`);

        this.broadcast(ServerEvents.START_REACTION_TIMER, {
            durationMs: REACTION_WINDOW_MS,
            actionTypeLabel: `Magheggio "${template?.name ?? cardInHand.templateId}" in corso!`
        } as IStartReactionTimerPayload);
    }

    // ─────────────────────────────────────────────────────
    //  PLAY_REACTION — enqueue into action stack
    // ─────────────────────────────────────────────────────

    private handlePlayReaction(client: Client, data: IPlayReactionPayload): void {
        if (this.state.phase !== GamePhase.REACTION_WINDOW) {
            client.send(ServerEvents.ERROR, { code: "NO_REACTION_WINDOW", message: "Nessuna finestra di reazione attiva." });
            return;
        }

        if (client.sessionId === this.state.pendingAction?.playerId) {
            client.send(ServerEvents.ERROR, { code: "SELF_REACTION", message: "Non puoi reagire alla tua stessa azione." });
            return;
        }

        const { cardId } = data;
        if (!cardId) {
            client.send(ServerEvents.ERROR, { code: "MISSING_CARD_ID", message: "Specifica la carta Reazione." });
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        const handArr = player.hand as any[];
        const cardIdx = handArr.findIndex((c: any) => c.id === cardId);
        if (cardIdx === -1) {
            client.send(ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non è nella tua mano." });
            return;
        }

        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const cost = template?.cost ?? 1;

        if (player.actionPoints < cost) {
            client.send(ServerEvents.ERROR, { code: "NO_PA", message: "Punti Azione insufficienti per reagire." });
            return;
        }

        // Deduct PA and remove card from hand
        player.actionPoints -= cost;
        handArr.splice(cardIdx, 1);

        // Create IPendingAction for this reaction and push onto stack (LIFO top)
        const reactionPending: IPendingAction = {
            id: this.generateId(),
            playerId: client.sessionId,
            actionType: ClientMessages.PLAY_REACTION,
            targetCardId: cardInHand.templateId,  // reaction card's templateId for CardEffectParser
            timestamp: Date.now(),
            isCancelled: false
        };

        // Push BEFORE original action so stack[0] = newest reaction (LIFO)
        this.state.actionStack.unshift(reactionPending);

        console.log(`🗡️  PLAY_REACTION by ${client.sessionId}: ${template?.name} queued (stack depth: ${this.state.actionStack.length})`);

        this.broadcast(ServerEvents.REACTION_TRIGGERED, {
            playerId: client.sessionId,
            playerName: player.username,
            cardId,
            templateId: cardInHand.templateId,
            cardName: template?.name ?? cardId
        });
    }

    // ─────────────────────────────────────────────────────
    //  resolvePhase — called by clock.setTimeout
    // ─────────────────────────────────────────────────────

    private resolvePhase(): void {
        this.state.phase = GamePhase.RESOLUTION;
        console.log(`🔥 Reaction Window closed. Resolving stack of ${this.state.actionStack.length} action(s)...`);

        const originalAction = this.state.pendingAction;

        // Build the reactions array in chronological order (oldest first).
        // Our internal stack has stack[0] = newest reaction, stack[N-1] = original action.
        const chainStack = [...this.state.actionStack].reverse();

        // The first element is the original action. The rest are reactions.
        const reactions = chainStack.slice(1);

        // Run the full LIFO resolution queue using Agent 3's API
        let result: IResolveQueueResult | null = null;
        try {
            if (originalAction) {
                result = CardEffectParser.resolveQueue(originalAction, reactions, this.state as any);
            }
        } catch (err) {
            console.error("[ROOM] FATAL: Error during CardEffectParser.resolveQueue:", err);
            result = {
                success: false,
                log: ["[resolveQueue] Internal error during resolution. Action cancelled."]
            };
        }

        // Apply structural effects that CardEffectParser can't do (Colyseus schema mutations):
        if (originalAction && !originalAction.isCancelled) {
            switch (originalAction.actionType) {
                case ClientMessages.PLAY_EMPLOYEE:
                    this.applyEmployeeHire(originalAction.playerId, originalAction.targetCardId!);
                    break;
                case ClientMessages.SOLVE_CRISIS:
                    this.applyCrisisRemoval(originalAction.playerId, originalAction.targetCrisisId!);
                    break;
            }
        }

        const success = result ? result.success : !originalAction?.isCancelled;
        const log = result ? result.log :
            (success ? [`Azione originale eseguita con successo.`] : [`Azione annullata.`]);

        this.broadcast(ServerEvents.ACTION_RESOLVED, { success, log });

        // Cleanup
        this.state.pendingAction = null as any;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;
        this.reactionTimeout = null;
        this.state.phase = GamePhase.PLAYER_TURN;

        console.log(`   ✅ Resolution complete. Restored PLAYER_TURN.`);
        this.checkWinConditions();
    }

    // ─────────────────────────────────────────────────────
    //  Structural effect appliers (Colyseus schema mutations)
    // ─────────────────────────────────────────────────────

    /**
     * Moves the card from pending limbo → player's company (public area).
     * Called by resolveReactions when the PLAY_EMPLOYEE action is not cancelled.
     */
    private applyEmployeeHire(playerId: string, templateId: string): void {
        const player = this.state.players.get(playerId);
        if (!player) return;

        const template = this.getTemplate(templateId);
        if (!template) return;

        const companyCard = new CardState();
        companyCard.id = this.generateId();
        companyCard.templateId = templateId;
        companyCard.type = CardType.EMPLOYEE;
        companyCard.costPA = template.cost;
        companyCard.isFaceUp = true;
        companyCard.name = template.name;
        player.company.push(companyCard);

        // Score = number of hired employees (company.length)
        player.score = (player.company as any[]).length;
        console.log(`   👔 ${player.username} hired ${template.name}. Company size: ${player.score}`);
    }

    /**
     * Removes the resolved crisis from centralCrises.
     * CardEffectParser.resolve already awarded VP via resolveCrisis().
     */
    private applyCrisisRemoval(playerId: string, crisisId: string): void {
        const crisisArr = this.state.centralCrises as any[];
        const idx = crisisArr.findIndex((c: any) => c.id === crisisId);
        if (idx !== -1) {
            const crisis = crisisArr[idx];
            crisisArr.splice(idx, 1);
            console.log(`   🗑️  Crisis ${crisis.templateId} removed from central table.`);
        }
    }

    // ─────────────────────────────────────────────────────
    //  Win Condition Check
    // ─────────────────────────────────────────────────────

    private checkWinConditions(): void {
        if (this.state.phase === GamePhase.GAME_OVER) return;

        for (const [sessionId, player] of this.state.players) {
            const employeeCount = (player.company as any[]).length;
            const crisisVP = player.score;

            const won = employeeCount >= WIN_EMPLOYEES || crisisVP >= WIN_CRISES;
            if (won) {
                this.state.winnerId = sessionId;
                this.state.phase = GamePhase.GAME_OVER;

                const payload: IGameWonEvent = {
                    winnerId: player.sessionId,
                    winnerName: player.username,
                    finalScore: player.score
                };

                this.broadcast(ServerEvents.GAME_WON, payload);
                console.log(`🏆 GAME OVER! Winner: ${player.username} (employees: ${employeeCount}, score: ${crisisVP})`);
                return;
            }
        }
    }

    // ─────────────────────────────────────────────────────
    //  Triple Validation Helper
    // ─────────────────────────────────────────────────────

    private checkPlayerTurnAction(client: Client, requiredPA: number): boolean {
        if (client.sessionId !== this.state.currentTurnPlayerId) {
            client.send(ServerEvents.ERROR, { code: "NOT_YOUR_TURN", message: "Non è il tuo turno." });
            return false;
        }
        if (this.state.phase !== GamePhase.PLAYER_TURN) {
            client.send(ServerEvents.ERROR, { code: "WRONG_PHASE", message: "Fase non corretta." });
            return false;
        }
        const player = this.state.players.get(client.sessionId);
        if (!player || player.actionPoints < requiredPA) {
            client.send(ServerEvents.ERROR, { code: "NO_PA", message: "Punti Azione insufficienti." });
            return false;
        }
        player.actionPoints -= requiredPA;
        return true;
    }

    // ─────────────────────────────────────────────────────
    //  Misc
    // ─────────────────────────────────────────────────────

    private handleEmote(client: Client, data: IEmotePayload): void {
        console.log(`💬 Emote from ${client.sessionId}: ${data?.emoteId}`);
        this.broadcast("EMOTE", { playerId: client.sessionId, emoteId: data?.emoteId });
    }

    private generateId(): string {
        return "xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
