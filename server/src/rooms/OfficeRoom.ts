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
    MIN_PLAYERS_TO_START,
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
import { CardEffectParser } from "../../../shared/CardEffectParser";
import cardsDbRaw from "../../../shared/cards_db.json";
import { collectMonsterTemplateIds, createMonsterCardState, drawMonsterTemplateId, rollCrisisAttempt } from "../game/monsterBoard";
import { computeNextConnectedTurn, validateAndSpendTurnAction } from "../game/turnFlow";
import { evaluatePlayerWin } from "../game/winConditions";
import { consumePendingDrawTags, resolveReactionQueue } from "../game/reactionResolution";
import { createItemCardForEquip, equipItemOnHero, resolveHeroEquipTarget } from "../game/itemEquip";
import { rebindDisconnectedPlayerSession, validateOfficeRoomCode, validateOfficeRoomJoinRequest } from './officeRoomIdentity';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Constants
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MAX_PLAYERS = 10;
const STARTING_HAND_SIZE = 3;

/** Win conditions */
const WIN_EMPLOYEES = 4;   // Here-to-Slay Lite: 4 Hero in company
const WIN_CRISES = 2;   // Here-to-Slay Lite: 2 Monster risolti (VP score)

interface IMagicResolutionResult {
    success: boolean;
    message?: string;
}

interface IDiscountPlan {
    amount: number;
    sourceTag: string | null;
}

interface ICrisisResolutionSummary {
    success: boolean;
    rewardCode?: string;
    penaltyCode?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  OfficeRoom â€” the authoritative game room
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export class OfficeRoom extends Room<OfficeRoomState> {
    private roomCode = "0000";

    /** Handle to the reaction-window countdown timer */
    private reactionTimeout: Delayed | null = null;

    /** Server-side deck (not synchronized to state) */
    protected serverDeck: ICardData[] = [];

    /** Card template lookup map (templateId â†’ ICardTemplate) built from cards_db.json */
    private cardTemplates: Map<string, ICardTemplate> = new Map();
    private monsterTemplateIds: string[] = [];
    private monsterBag: string[] = [];
    private pendingRemovedCards: Map<string, ICardData> = new Map();

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Lifecycle
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    onCreate(_options: any): void {
        console.log("ðŸ¢ OfficeRoom created!");
        console.log("[ROOM] OfficeRoom.onCreate called with options:", _options);
        this.setState(new OfficeRoomState());
        this.state.pendingAction = null as any;
        this.maxClients = MAX_PLAYERS;
        this.roomCode = this.normalizeRoomCode(_options?.roomCode);
        this.setMetadata({ roomCode: this.roomCode });
        console.log("[ROOM] Max clients set to:", this.maxClients);

        // Build card template lookup from embedded JSON
        this.buildCardTemplateLookup();

        this.onMessage(ClientMessages.JOIN_GAME, (client, data) => this.handleJoinGame(client, data));
        this.onMessage(ClientMessages.START_MATCH, (client, _data) => this.handleStartMatch(client));
        this.onMessage(ClientMessages.END_TURN, (client, _data) => this.handleEndTurn(client));
        this.onMessage(ClientMessages.DRAW_CARD, (client, _data) => this.handleDrawCard(client));
        this.onMessage(ClientMessages.PLAY_EMPLOYEE, (client, data) => this.handlePlayEmployee(client, data));
        this.onMessage(ClientMessages.PLAY_MAGIC, (client, data) => this.handlePlayMagic(client, data));
        this.onMessage(ClientMessages.SOLVE_CRISIS, (client, data) => this.handleSolveCrisis(client, data));
        this.onMessage(ClientMessages.PLAY_REACTION, (client, data) => this.handlePlayReaction(client, data));
        this.onMessage(ClientMessages.EMOTE, (client, data) => this.handleEmote(client, data));
    }

    onAuth(client: Client, options: JoinOptions, _request: any) {
        console.log("[AUTH] Incoming auth request from client", client.sessionId, "options:", { ceoName: options?.ceoName, roomCode: options?.roomCode });
        const existing = typeof options?.ceoName === 'string'
            ? this.findPlayerByName(options.ceoName)
            : null;
        const validation = validateOfficeRoomJoinRequest({
            options,
            expectedRoomCode: this.roomCode,
            phase: this.state.phase,
            existingPlayer: existing
                ? { sessionId: existing.sessionId, isConnected: existing.player.isConnected }
                : null,
        });
        if (!validation.ok) {
            console.warn("[AUTH] Rejected", validation.message, { ceoName: options?.ceoName, roomCode: options?.roomCode });
            throw new ServerError(validation.statusCode, validation.message);
        }

        console.log("[AUTH] Accepted client", client.sessionId, "ceoName:", validation.value.ceoName, "rejoinFrom:", validation.value.rejoinFromSessionId);
        return validation.value;
    }
    onJoin(client: Client, options: JoinOptions, auth?: { ceoName: string; rejoinFromSessionId?: string | null }): void {
        console.log(`ðŸ‘¤ Player connected: ${client.sessionId}`);
        const rejoinFrom = auth?.rejoinFromSessionId ?? null;

        if (rejoinFrom) {
            const player = rebindDisconnectedPlayerSession(this.state as any, rejoinFrom, client.sessionId);
            if (player) {
                console.log("[JOIN] Reconnected by name:", player.username, "oldSession:", rejoinFrom, "newSession:", client.sessionId);
                return;
            }
        }
        const player = new PlayerState();
        player.sessionId = client.sessionId;
        player.username = auth?.ceoName || options?.ceoName || `CEO_${client.sessionId.substring(0, 4)}`;
        player.actionPoints = 0;
        player.isConnected = true;
        player.isReady = false;
        this.state.players.set(client.sessionId, player);
        if (!this.state.hostSessionId) {
            this.state.hostSessionId = client.sessionId;
        }
        console.log("[JOIN] onJoin for session", client.sessionId, "username:", player.username);
        console.log("[JOIN] Current players:", Array.from(this.state.players.keys()));
    }

    async onLeave(client: Client, consented: boolean): Promise<void> {
        console.log("[LEAVE] onLeave for session", client.sessionId, "consented:", consented);
        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.isConnected = false;
        }

        console.log(`ðŸ‘‹ Player left: ${client.sessionId} (consented: ${consented})`);

        // Check if it's their turn. If so, start a 5s fallback to automatically skip
        // their turn so the game isn't completely paralyzed
        let skipTimeout: Delayed | null = null;
        if (!consented && this.state.currentTurnPlayerId === client.sessionId && this.state.phase === GamePhase.PLAYER_TURN) {
            console.log(`   â±ï¸  Active player disconnected. Waiting 5s before advancing turn...`);
            skipTimeout = this.clock.setTimeout(() => {
                const p = this.state.players.get(client.sessionId);
                if (p && !p.isConnected && this.state.currentTurnPlayerId === client.sessionId && this.state.phase === GamePhase.PLAYER_TURN) {
                    console.log(`   â­ï¸  5s passed. Auto-skipping turn for disconnected player.`);
                    this.advanceTurn();
                }
            }, 5000);
        }

        if (consented) {
            if (this.shouldPreserveDisconnectedSlot()) {
                // In match attivo preserviamo lo slot anche su uscita volontaria:
                // il player (host incluso) puo rientrare con stesso nome.
                this.cleanupPendingForRemovedPlayer(client.sessionId);
                const stillThere = this.state.players.get(client.sessionId) as PlayerState | undefined;
                if (stillThere) {
                    stillThere.isConnected = false;
                }
                if (this.state.currentTurnPlayerId === client.sessionId && this.state.phase === GamePhase.PLAYER_TURN) {
                    this.advanceTurn();
                }
                return;
            }

            this.removePlayerPermanently(client.sessionId);

            if (skipTimeout) {
                skipTimeout.clear();
            }
            return;
        }

        if (!consented) {
            try {
                // Se Ã¨ un refresh accidentale/resize brutale aspetta 30 secondi
                console.log(`   â³ Waiting for ${client.sessionId} to reconnect...`);
                const newClient = await this.allowReconnection(client, 30);

                // Se si riconnette, il framework mappa in automatico il nuovo client alla stessa entitÃ 
                if (player) {
                    player.isConnected = true;
                    console.log(`   âœ… ${newClient.sessionId} (formerly ${client.sessionId}) reconnected!`);
                }

                // If they reconnected before the 5s skip, cancel the skip
                if (skipTimeout) {
                    skipTimeout.clear();
                    console.log(`   ðŸ‘ Timely reconnection. Turn skip cancelled.`);
                }
            } catch (e) {
                if (this.shouldPreserveDisconnectedSlot()) {
                    // Match in corso: manteniamo lo slot disconnesso per consentire rejoin manuale per nome.
                    console.log(`   âš ï¸ Timeout expired. Keeping disconnected slot for ${client.sessionId} (manual rejoin allowed).`);
                    this.cleanupPendingForRemovedPlayer(client.sessionId);
                    const stillThere = this.state.players.get(client.sessionId) as PlayerState | undefined;
                    if (stillThere) {
                        stillThere.isConnected = false;
                    }
                    if (this.state.currentTurnPlayerId === client.sessionId && this.state.phase === GamePhase.PLAYER_TURN) {
                        this.advanceTurn();
                    }
                    return;
                }

                // Lobby/pre-lobby: timeout scaduto => cleanup definitivo.
                console.log(`   âŒ Timeout expired. Deleting player ${client.sessionId}.`);
                this.removePlayerPermanently(client.sessionId);
            }
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Card Template Lookup
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            console.log(`ðŸ“š Loaded ${this.cardTemplates.size} card templates from cards_db.json`);
        }
    }

    private getTemplate(templateId: string): ICardTemplate | undefined {
        return this.cardTemplates.get(templateId);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Game Start
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private handleJoinGame(client: Client, _data: any): void {
        if (this.state.phase !== GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== GamePhase.PRE_LOBBY) {
            client.send(ServerEvents.ERROR, { code: "GAME_ALREADY_STARTED", message: "Il gioco Ã¨ giÃ  iniziato." });
            return;
        }
        const player = this.state.players.get(client.sessionId);
        if (player && !player.isReady) {
            player.isReady = true;
            console.log(`   ${client.sessionId} is ready!`);
        }
    }

    private handleStartMatch(client: Client): void {
        if (this.state.phase !== GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== GamePhase.PRE_LOBBY) {
            client.send(ServerEvents.ERROR, { code: "GAME_ALREADY_STARTED", message: "La partita e gia iniziata." });
            return;
        }
        if (client.sessionId !== this.state.hostSessionId) {
            client.send(ServerEvents.ERROR, { code: "HOST_ONLY", message: "Solo l'host puo avviare la partita." });
            return;
        }

        const connectedEntries = this.getConnectedPlayerEntries();
        if (connectedEntries.length < MIN_PLAYERS_TO_START) {
            client.send(ServerEvents.ERROR, {
                code: "NOT_ENOUGH_PLAYERS",
                message: `Servono almeno ${MIN_PLAYERS_TO_START} giocatori connessi.`,
            });
            return;
        }

        const allConnectedReady = connectedEntries.every((entry) => entry.player.isReady);
        if (!allConnectedReady) {
            client.send(ServerEvents.ERROR, {
                code: "PLAYERS_NOT_READY",
                message: "Tutti i giocatori connessi devono confermare prima di iniziare.",
            });
            return;
        }

        this.startGame(connectedEntries.map((entry) => entry.sessionId));
    }

    private startGame(participantIds: string[]): void {
        const connectedReadyIds = participantIds.filter((sessionId) => {
            const player = this.state.players.get(sessionId) as PlayerState | undefined;
            return Boolean(player && player.isConnected && player.isReady);
        });
        if (connectedReadyIds.length < MIN_PLAYERS_TO_START) {
            this.broadcast(ServerEvents.ERROR, {
                code: "NOT_ENOUGH_READY",
                message: `Servono almeno ${MIN_PLAYERS_TO_START} giocatori pronti.`,
            } as IErrorEvent);
            return;
        }
        this.state.phase = GamePhase.PLAYER_TURN;

        // Fisher-Yates shuffle of player order
        const players = Array.from(connectedReadyIds);
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        while (this.state.playerOrder.length > 0) this.state.playerOrder.pop();
        players.forEach((p) => this.state.playerOrder.push(p));

        players.forEach((sessionId) => {
            const participant = this.state.players.get(sessionId) as PlayerState | undefined;
            if (!participant) return;
            while ((participant.hand as any[]).length > 0) (participant.hand as any[]).pop();
            while ((participant.company as any[]).length > 0) (participant.company as any[]).pop();
            while ((participant.activeEffects as any[]).length > 0) (participant.activeEffects as any[]).pop();
            participant.score = 0;
            participant.actionPoints = 0;
        });

        this.state.turnIndex = 0;
        this.state.currentTurnPlayerId = this.state.playerOrder.at(0) ?? "";
        this.state.turnNumber = 1;
        this.state.winnerId = undefined;
        this.state.pendingAction = null as any;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;
        if (this.reactionTimeout) {
            this.reactionTimeout.clear();
            this.reactionTimeout = null;
        }

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
        console.log(`ðŸƒ Deck ready: ${this.state.deckCount} cards`);

        // Assign a Party Leader to each participant (setup-only cards, outside main deck).
        this.assignPartyLeaders(players);

        this.monsterTemplateIds = collectMonsterTemplateIds(this.cardTemplates.values());
        this.monsterBag = [];

        // Populate and keep central monsters at 3 slots.
        this.populateCentralCrises();

        // Deal an initial hand to keep the first turns fast and readable (casual mode).
        this.dealInitialHands(players, STARTING_HAND_SIZE);

        // Give PA to first active player
        const activePlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (activePlayer) activePlayer.actionPoints = MAX_ACTION_POINTS;

        console.log(`ðŸŽ® Game started! First turn: ${this.state.currentTurnPlayerId} | starting hand: ${STARTING_HAND_SIZE}`);
        this.broadcast(ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: MAX_ACTION_POINTS
        } as ITurnStartedEvent);
    }

    private assignPartyLeaders(participantIds: string[]): void {
        const leaders = Array.from(this.cardTemplates.values()).filter((t) => {
            const type = String(t.type ?? "").trim().toLowerCase();
            return type === "party_leader" || type === "leader";
        });
        if (leaders.length === 0) return;

        for (let i = 0; i < participantIds.length; i++) {
            const playerId = participantIds[i];
            const player = this.state.players.get(playerId) as PlayerState | undefined;
            if (!player) continue;

            const leader = leaders[i % leaders.length]!;
            const effects = player.activeEffects as string[];
            const leaderTag = `party_leader_${leader.id}`;
            if (!effects.includes(leaderTag)) effects.push(leaderTag);

            // Apply passive leader effects once at setup.
            try {
                CardEffectParser.resolve(leader as any, player as any, null, this.state as any);
            } catch (err) {
                console.warn("[ROOM] Failed to apply party leader effect:", leader.id, err);
            }
        }
    }

    private populateCentralCrises(): void {
        while (this.state.centralCrises.length > 0) {
            this.state.centralCrises.pop();
        }
        this.refillCentralCrisesToThree();
    }

    private refillCentralCrisesToThree(): void {
        if (this.monsterTemplateIds.length === 0) {
            this.monsterTemplateIds = collectMonsterTemplateIds(this.cardTemplates.values());
        }
        const maxSlots = 3;
        while (this.state.centralCrises.length < maxSlots) {
            const templateId = drawMonsterTemplateId(this.monsterBag, this.monsterTemplateIds);
            if (!templateId) break;

            const template = this.getTemplate(templateId);
            if (!template) continue;

            this.state.centralCrises.push(createMonsterCardState(template, () => this.generateId()));
        }
        console.log(`Central monsters on board: ${this.state.centralCrises.length}`);
    }

    private dealInitialHands(participantIds: string[], cardsPerPlayer: number): void {
        if (cardsPerPlayer <= 0 || participantIds.length === 0) return;

        for (let round = 0; round < cardsPerPlayer; round++) {
            for (const sessionId of participantIds) {
                const player = this.state.players.get(sessionId) as PlayerState | undefined;
                if (!player || !player.isConnected) continue;

                const drawnCard = DeckManager.drawCard(this.serverDeck);
                if (!drawnCard) {
                    console.warn("[ROOM] Deck exhausted during initial hand distribution.");
                    this.state.deckCount = this.serverDeck.length;
                    return;
                }

                player.hand.push(this.createCardStateFromDeckCard(drawnCard));
            }
        }

        this.state.deckCount = this.serverDeck.length;
    }

    private createCardStateFromDeckCard(drawnCard: ICardData): CardState {
        const card = new CardState();
        card.id = drawnCard.id;
        card.templateId = drawnCard.templateId;
        card.type = drawnCard.type;
        if (drawnCard.costPA !== undefined) card.costPA = drawnCard.costPA;
        card.isFaceUp = false;
        if (drawnCard.targetRoll !== undefined) card.targetRoll = drawnCard.targetRoll;
        if (drawnCard.modifier !== undefined) card.modifier = drawnCard.modifier;
        card.subtype = drawnCard.subtype ?? "none";
        if (drawnCard.shortDesc) card.shortDesc = drawnCard.shortDesc;

        const tmpl = this.getTemplate(drawnCard.templateId);
        if (tmpl) {
            card.name = tmpl.name;
            card.shortDesc = tmpl.shortDesc;
            card.description = tmpl.description;
            if (card.subtype === "none" && tmpl.subtype) card.subtype = tmpl.subtype;
            if (card.targetRoll === undefined && typeof tmpl.targetRoll === "number") card.targetRoll = tmpl.targetRoll;
            if (card.modifier === undefined && typeof tmpl.modifier === "number") card.modifier = tmpl.modifier;
        }

        return card;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Turn Management
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private handleEndTurn(client: Client): void {
        if (client.sessionId !== this.state.currentTurnPlayerId) {
            client.send(ServerEvents.ERROR, { code: "NOT_YOUR_TURN", message: "Non Ã¨ il tuo turno." });
            return;
        }
        if (this.state.phase !== GamePhase.PLAYER_TURN) {
            client.send(ServerEvents.ERROR, { code: "WRONG_PHASE", message: "La fase non lo consente." });
            return;
        }
        this.advanceTurn();
    }

    private advanceTurn(): void {
        const next = computeNextConnectedTurn(
            this.state.playerOrder as string[],
            this.state.turnIndex,
            (playerId) => Boolean(this.state.players.get(playerId)?.isConnected),
        );
        if (!next) {
            this.state.currentTurnPlayerId = "";
            this.state.turnIndex = 0;
            this.state.phase = GamePhase.WAITING_FOR_PLAYERS;
            return;
        }

        this.state.turnIndex = next.nextIndex;
        this.state.currentTurnPlayerId = next.nextPlayerId;
        this.state.phase = GamePhase.PLAYER_TURN;
        this.state.turnNumber++;

        const nextPlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (nextPlayer) nextPlayer.actionPoints = MAX_ACTION_POINTS;

        // TASK 3: Reset locked_tricks on all players at turn boundary
        this.state.players.forEach((player) => {
            const effects = player.activeEffects as string[];
            const idx = effects.indexOf("locked_tricks");
            if (idx !== -1) effects.splice(idx, 1);
        });

        console.log(`âž¡ï¸  Turn ${this.state.turnNumber}: ${this.state.currentTurnPlayerId}`);
        this.broadcast(ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: MAX_ACTION_POINTS
        } as ITurnStartedEvent);

        this.checkWinConditions();
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  DRAW_CARD â€” uses DeckManager.drawCard
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private handleDrawCard(client: Client): void {
        if (!this.checkPlayerTurnAction(client, DRAW_CARD_COST)) return;

        const drawnCard = DeckManager.drawCard(this.serverDeck);
        if (!drawnCard) {
            client.send(ServerEvents.ERROR, { code: "DECK_EMPTY", message: "Il mazzo Ã¨ vuoto." });
            // Refund PA
            const player = this.state.players.get(client.sessionId);
            if (player) player.actionPoints += DRAW_CARD_COST;
            return;
        }

        this.state.deckCount = this.serverDeck.length;

        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.hand.push(this.createCardStateFromDeckCard(drawnCard));
        }

        console.log(`ðŸ“¥ DRAW_CARD by ${client.sessionId}. Deck left: ${this.state.deckCount}`);
        client.send(ServerEvents.CARD_DRAWN, {
            card: drawnCard,
            remainingDeck: this.state.deckCount
        } as ICardDrawnEvent);

        this.checkWinConditions();
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  PLAY_EMPLOYEE â€” Reaction Window trigger
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            client.send(ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non Ã¨ nella tua mano." });
            return;
        }

        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const typeValue = String(template?.type ?? cardInHand.type ?? "").trim().toLowerCase();
        if (typeValue !== "hero" && typeValue !== "employee") {
            client.send(ServerEvents.ERROR, {
                code: "NOT_HERO_CARD",
                message: "Puoi assumere solo carte Hero.",
            });
            return;
        }
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

        console.log(`ðŸƒ PLAY_EMPLOYEE by ${client.sessionId}: ${template?.name} (cost ${cost} PA). Window open.`);

        // Broadcast START_REACTION_TIMER so Phaser shows animated countdown
        this.broadcast(ServerEvents.START_REACTION_TIMER, {
            durationMs: REACTION_WINDOW_MS,
            actionTypeLabel: `Assunzione di "${template?.name ?? cardInHand.templateId}" in corso!`
        } as IStartReactionTimerPayload);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  SOLVE_CRISIS â€” Reaction Window trigger
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private handleSolveCrisis(client: Client, data: ISolveCrisisPayload): void {
        const crisisId = String(data?.crisisId ?? "").trim();
        const heroCardId = String(data?.heroCardId ?? "").trim();
        if (!crisisId) {
            client.send(ServerEvents.ERROR, { code: "MISSING_CRISIS_ID", message: "Specifica il crisisId." });
            return;
        }
        if (!heroCardId) {
            client.send(ServerEvents.ERROR, {
                code: "MISSING_ATTACK_HERO",
                message: "Seleziona un Hero valido per attaccare l'Imprevisto.",
            });
            return;
        }

        const player = this.state.players.get(client.sessionId) as PlayerState | undefined;
        if (!player) return;

        const heroValidation = this.validateSelectedAttackHero(player, heroCardId);
        if (!heroValidation.ok || !heroValidation.hero) {
            client.send(ServerEvents.ERROR, {
                code: heroValidation.errorCode ?? "INVALID_ATTACK_HERO",
                message: heroValidation.errorMessage ?? "L'Hero selezionato per l'attacco non esiste nella tua azienda.",
            });
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
        pending.targetHeroCardId = heroValidation.hero.id;
        pending.timestamp = Date.now();

        this.state.pendingAction = pending;
        this.state.phase = GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + REACTION_WINDOW_MS;
        this.state.actionStack = [pending as IPendingAction];

        if (this.reactionTimeout) this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), REACTION_WINDOW_MS);

        console.log(`ðŸ’¼ SOLVE_CRISIS by ${client.sessionId}: ${template?.name}. Window open.`);

        this.broadcast(ServerEvents.START_REACTION_TIMER, {
            durationMs: REACTION_WINDOW_MS,
            actionTypeLabel: `Risoluzione crisi "${template?.name ?? crisis.templateId}" in corso!`
        } as IStartReactionTimerPayload);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  PLAY_MAGIC â€” immediate (no Reaction Window)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private handlePlayMagic(client: Client, data: IPlayMagicPayload): void {
        const { cardId, targetPlayerId, targetHeroCardId } = data;
        if (!cardId) {
            client.send(ServerEvents.ERROR, { code: "MISSING_CARD_ID", message: "Specifica il cardId." });
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        // TASK 3: Check locked_tricks tag
        if ((player.activeEffects as string[]).includes("locked_tricks")) {
            client.send(ServerEvents.ERROR, {
                code: "TRICKS_LOCKED",
                message: "I Trucchi sono bloccati per questo turno!"
            });
            return;
        }

        const handArr = player.hand as any[];
        const cardIdx = handArr.findIndex((c: any) => c.id === cardId);
        if (cardIdx === -1) {
            client.send(ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non Ã¨ nella tua mano." });
            return;
        }

        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const typeValue = String(template?.type ?? cardInHand.type ?? "").trim().toLowerCase();
        const subtypeValue = String(template?.subtype ?? cardInHand.subtype ?? "").trim().toLowerCase();
        if (typeValue === "hero" || typeValue === "employee") {
            client.send(ServerEvents.ERROR, {
                code: "USE_PLAY_EMPLOYEE",
                message: "Le carte Hero si giocano con l'azione di assunzione.",
            });
            return;
        }
        if (
            typeValue === "challenge"
            || typeValue === "reaction"
            || typeValue === "modifier"
            || subtypeValue === "reaction"
            || subtypeValue === "modifier"
        ) {
            client.send(ServerEvents.ERROR, {
                code: "REACTION_ONLY_WINDOW",
                message: "Le carte Reazione possono essere giocate solo durante la finestra di reazione.",
            });
            return;
        }

        const allowedMagicLike = ["magic", "event", "trick", "item", "oggetto"];
        if (!allowedMagicLike.includes(typeValue)) {
            client.send(ServerEvents.ERROR, {
                code: "INVALID_CARD_TYPE",
                message: "Tipo carta non valido per questa azione.",
            });
            return;
        }
        const baseCost = template?.cost ?? 1;

        // Validate targetPlayerId for targeted cards (magic/modifier)
        const effectAction = String(template?.effect?.action ?? "");
        const effectTarget = String(template?.effect?.target ?? "").toLowerCase();
        const targetedActions = ["steal_pa", "steal_card", "discard", "trade_random"];
        const needsTarget = targetedActions.includes(effectAction)
            && ["opponent", "another_opponent", "opponent_hand"].includes(effectTarget);

        if (needsTarget && !targetPlayerId) {
            client.send(ServerEvents.ERROR, {
                code: "MISSING_TARGET",
                message: "Questa carta richiede di scegliere un bersaglio."
            });
            return;
        }

        if (needsTarget && targetPlayerId) {
            if (targetPlayerId === client.sessionId) {
                client.send(ServerEvents.ERROR, { code: "SELF_TARGET", message: "Non puoi bersagliare te stesso." });
                return;
            }
            if (!this.state.players.has(targetPlayerId)) {
                client.send(ServerEvents.ERROR, { code: "INVALID_TARGET", message: "Il giocatore bersaglio non esiste." });
                return;
            }
        }

        const isItemCard = typeValue === "item" || typeValue === "oggetto";
        let resolvedTargetHeroCardId: string | undefined = undefined;
        if (isItemCard) {
            const equipTarget = resolveHeroEquipTarget({
                player,
                targetHeroCardId,
                allowFallbackToPlayerLevel: false,
            });
            if (!equipTarget.ok) {
                client.send(ServerEvents.ERROR, {
                    code: equipTarget.errorCode ?? "MISSING_HERO_TARGET",
                    message: equipTarget.errorMessage ?? "Seleziona un Hero valido per equipaggiare l'Item.",
                });
                return;
            }
            resolvedTargetHeroCardId = equipTarget.targetHero?.id;
        }

        const discountPlan = this.peekMagicDiscount(player as PlayerState, isItemCard);
        const effectiveCost = Math.max(0, baseCost - discountPlan.amount);

        if (!this.checkPlayerTurnAction(client, effectiveCost)) return;
        if (discountPlan.amount > 0) {
            this.consumeMagicDiscount(player as PlayerState, discountPlan);
        }

        // Deduct PA and remove from hand immediately
        const removedCard = handArr.splice(cardIdx, 1)[0] as ICardData;

        // Populate pendingAction 
        const pending = new PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = ClientMessages.PLAY_MAGIC;
        pending.targetCardId = cardInHand.templateId; // templateId for CardEffectParser
        pending.targetPlayerId = needsTarget ? targetPlayerId : undefined;
        pending.targetHeroCardId = resolvedTargetHeroCardId;
        pending.timestamp = Date.now();
        this.pendingRemovedCards.set(pending.id, this.cloneRuntimeCardData(removedCard));

        this.state.pendingAction = pending;
        this.state.phase = GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + REACTION_WINDOW_MS;
        this.state.actionStack = [pending as IPendingAction];

        if (this.reactionTimeout) this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), REACTION_WINDOW_MS);

        console.log(`[PLAY_MAGIC] ${client.sessionId}: ${template?.name}. Window open. Cost ${baseCost} -> ${effectiveCost}`);

        this.broadcast(ServerEvents.START_REACTION_TIMER, {
            durationMs: REACTION_WINDOW_MS,
            actionTypeLabel: `Magheggio "${template?.name ?? cardInHand.templateId}" in corso!`
        } as IStartReactionTimerPayload);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  PLAY_REACTION â€” enqueue into action stack
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            client.send(ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non Ã¨ nella tua mano." });
            return;
        }

        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const typeValue = String(template?.type ?? cardInHand.type ?? "").trim().toLowerCase();
        const subtypeValue = String((cardInHand as any)?.subtype ?? template?.subtype ?? "").trim().toLowerCase();

        const isReactionCard = subtypeValue === "reaction"
            || subtypeValue === "modifier"
            || typeValue === "challenge"
            || typeValue === "reaction"
            || typeValue === "modifier";
        if (!isReactionCard) {
            client.send(ServerEvents.ERROR, {
                code: "NOT_REACTION_CARD",
                message: "Questa carta non e una Reazione valida.",
            });
            return;
        }

        // Reazioni/Modifier non consumano PA nel modello Here-to-Slay Lite.
        handArr.splice(cardIdx, 1);

        // Create IPendingAction for this reaction and push onto stack (LIFO top)
        const reactionPending: IPendingAction = {
            id: this.generateId(),
            playerId: client.sessionId,
            actionType: ClientMessages.PLAY_REACTION,
            targetCardId: cardInHand.templateId,  // reaction card's templateId for CardEffectParser
            targetPlayerId: this.state.pendingAction?.playerId ?? undefined,
            timestamp: Date.now(),
            isCancelled: false
        };

        // Push BEFORE original action so stack[0] = newest reaction (LIFO)
        this.state.actionStack.unshift(reactionPending);

        console.log(`ðŸ—¡ï¸  PLAY_REACTION by ${client.sessionId}: ${template?.name} queued (stack depth: ${this.state.actionStack.length})`);

        this.broadcast(ServerEvents.REACTION_TRIGGERED, {
            playerId: client.sessionId,
            playerName: player.username,
            cardId,
            templateId: cardInHand.templateId,
            cardName: template?.name ?? cardId
        });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  resolvePhase â€” called by clock.setTimeout
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private resolvePhase(): void {
        this.state.phase = GamePhase.RESOLUTION;
        console.log(`Reaction Window closed. Resolving stack of ${this.state.actionStack.length} action(s)...`);

        const resolution = resolveReactionQueue(this.state as any);
        const originalAction = resolution.originalAction;

        let structuralSuccess = !originalAction?.isCancelled;
        let magicResolution: IMagicResolutionResult | null = null;
        let crisisSummary: ICrisisResolutionSummary | null = null;
        if (originalAction && !originalAction.isCancelled) {
            switch (originalAction.actionType) {
                case ClientMessages.PLAY_EMPLOYEE:
                    this.applyEmployeeHire(originalAction.playerId, originalAction.targetCardId!);
                    structuralSuccess = true;
                    break;
                case ClientMessages.SOLVE_CRISIS:
                    crisisSummary = this.applyCrisisResolution(
                        originalAction.playerId,
                        originalAction.targetCrisisId!,
                        originalAction.targetHeroCardId,
                    );
                    structuralSuccess = crisisSummary.success;
                    break;
                case ClientMessages.PLAY_MAGIC:
                    magicResolution = this.applyMagicResolution(originalAction);
                    structuralSuccess = magicResolution.success;
                    break;
                default:
                    structuralSuccess = true;
                    break;
            }
        }

        const drawnCards = consumePendingDrawTags(
            this.state as any,
            () => DeckManager.drawCard(this.serverDeck),
            (card) => this.createCardStateFromDeckCard(card),
        );
        if (drawnCards > 0) {
            this.state.deckCount = this.serverDeck.length;
        }

        const success = resolution.parserSuccess && structuralSuccess;
        const log = resolution.log.length > 0
            ? [...resolution.log]
            : (success ? [`Azione originale eseguita con successo.`] : [`Azione annullata.`]);
        if (originalAction && originalAction.actionType === ClientMessages.SOLVE_CRISIS && !originalAction.isCancelled) {
            log.push(success
                ? "Imprevisto risolto con successo."
                : "Tentativo di risoluzione Imprevisto fallito.");
        }
        if (originalAction && originalAction.actionType === ClientMessages.PLAY_MAGIC && magicResolution?.message) {
            log.push(magicResolution.message);
        }

        this.broadcast(ServerEvents.ACTION_RESOLVED, { success, log });

        if (originalAction?.id) {
            this.pendingRemovedCards.delete(originalAction.id);
        }

        this.state.pendingAction = null as any;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;
        this.reactionTimeout = null;
        this.state.phase = GamePhase.PLAYER_TURN;

        console.log(`Resolution complete. Restored PLAYER_TURN.`);
        this.checkWinConditions();
    }

    private applyEmployeeHire(playerId: string, templateId: string): void {
        const player = this.state.players.get(playerId);
        if (!player) return;

        const template = this.getTemplate(templateId);
        if (!template) return;

        const companyCard = new CardState();
        companyCard.id = this.generateId();
        companyCard.templateId = templateId;
        companyCard.type = CardType.HERO;
        companyCard.costPA = template.cost;
        companyCard.isFaceUp = true;
        companyCard.name = template.name;
        companyCard.shortDesc = template.shortDesc;
        companyCard.description = template.description;
        player.company.push(companyCard);

        console.log(`   ðŸ‘” ${player.username} hired ${template.name}. Company size: ${(player.company as any[]).length}`);
    }

    /**
     * Server-authoritative crisis resolution:
     * - Roll 2d6 (+ modifiers)
     * - Broadcast DICE_ROLLED
     * - On success: reward + remove crisis
     * - On fail: apply crisis penalty
     */
    private applyMagicResolution(action: IPendingAction): IMagicResolutionResult {
        const player = this.state.players.get(action.playerId);
        if (!player) return { success: false, message: "Azione annullata: giocatore non trovato." };
        if (!action.targetCardId) return { success: true };

        const template = this.getTemplate(action.targetCardId);
        if (!template) {
            return {
                success: false,
                message: "Carta non risolta: template non trovato.",
            };
        }

        const typeValue = String(template.type ?? "").trim().toLowerCase();
        if (typeValue !== "item" && typeValue !== "oggetto") {
            return { success: true };
        }

        const equipTarget = resolveHeroEquipTarget({
            player,
            targetHeroCardId: action.targetHeroCardId,
            allowFallbackToPlayerLevel: false,
        });
        if (!equipTarget.ok || !equipTarget.targetHero) {
            return {
                success: false,
                message: "Item annullato: Hero bersaglio non valido.",
            };
        }

        const itemCard = createItemCardForEquip(template, () => this.generateId());
        const equipped = equipItemOnHero(equipTarget.targetHero, itemCard);
        if (!equipped) {
            return {
                success: false,
                message: "Item annullato: equip fallito.",
            };
        }

        return { success: true };
    }

    private isHeroRuntimeCard(card: unknown): card is CardState {
        const typeValue = String((card as any)?.type ?? "").trim().toLowerCase();
        return typeValue === "hero" || typeValue === "employee";
    }

    private validateSelectedAttackHero(
        player: PlayerState,
        heroCardId: string,
    ): { ok: boolean; hero?: CardState; errorCode?: string; errorMessage?: string } {
        const heroes = (player.company as any[]).filter((entry) => this.isHeroRuntimeCard(entry)) as CardState[];
        if (heroes.length === 0) {
            return {
                ok: false,
                errorCode: "NO_HERO_FOR_ATTACK",
                errorMessage: "Serve almeno un Hero in azienda per attaccare un Imprevisto.",
            };
        }
        if (!heroCardId) {
            return {
                ok: false,
                errorCode: "MISSING_ATTACK_HERO",
                errorMessage: "Seleziona un Hero valido per attaccare l'Imprevisto.",
            };
        }

        const selected = heroes.find((hero) => String(hero.id) === String(heroCardId));
        if (!selected) {
            return {
                ok: false,
                errorCode: "INVALID_ATTACK_HERO",
                errorMessage: "L'Hero selezionato per l'attacco non esiste nella tua azienda.",
            };
        }

        return { ok: true, hero: selected };
    }

    private applyCrisisResolution(playerId: string, crisisId: string, heroCardId?: string): ICrisisResolutionSummary {
        const player = this.state.players.get(playerId) as PlayerState | undefined;
        if (!player) return { success: false };

        const heroValidation = this.validateSelectedAttackHero(player, String(heroCardId ?? ""));
        if (!heroValidation.ok || !heroValidation.hero) {
            return { success: false };
        }

        const crisisArr = this.state.centralCrises as any[];
        const idx = crisisArr.findIndex((c: any) => c.id === crisisId);
        if (idx === -1) return { success: false };

        const crisis = crisisArr[idx];
        const template = this.getTemplate(crisis.templateId);
        const targetRoll = typeof crisis.targetRoll === "number"
            ? crisis.targetRoll
            : (typeof template?.targetRoll === "number" ? template.targetRoll : 7);
        const rewardCode = typeof template?.effect?.reward === "string" ? template.effect.reward : undefined;
        const penaltyCode = typeof template?.effect?.penalty === "string" ? template.effect.penalty : undefined;

        const modifier = this.getCrisisRollModifier(player, heroValidation.hero) + (typeof crisis.modifier === "number" ? crisis.modifier : 0);
        const roll = rollCrisisAttempt(targetRoll, modifier);

        this.broadcast(ServerEvents.DICE_ROLLED, {
            playerId,
            cardId: crisis.id,
            roll1: roll.roll1,
            roll2: roll.roll2,
            modifier,
            targetRoll,
            total: roll.total,
            success: roll.success,
            rewardCode: roll.success ? rewardCode : undefined,
            penaltyCode: roll.success ? undefined : penaltyCode,
        });

        if (roll.success) {
            const reward = template?.effect?.reward;
            if (typeof reward === "string" && reward.startsWith("vp_")) {
                const gainedVp = parseInt(reward.replace("vp_", ""), 10);
                player.score += Number.isFinite(gainedVp) && gainedVp > 0 ? gainedVp : 1;
            } else {
                player.score += 1;
            }
            crisisArr.splice(idx, 1);
            this.refillCentralCrisesToThree();
            console.log(`   Crisis ${crisis.templateId} removed from central table.`);
            return { success: true, rewardCode };
        }

        this.applyCrisisPenalty(template?.effect?.penalty, playerId);
        return { success: false, penaltyCode };
    }

    private getCrisisRollModifier(player: PlayerState, selectedHero: CardState): number {
        let bonus = 0;
        if (typeof selectedHero?.modifier === "number") {
            bonus += selectedHero.modifier;
        }
        const equippedItems = (selectedHero?.equippedItems ?? []) as any[];
        for (const item of equippedItems) {
            if (typeof item?.modifier === "number") {
                bonus += item.modifier;
            }
        }

        const effects = player.activeEffects as string[];
        for (let i = effects.length - 1; i >= 0; i--) {
            const tag = effects[i];
            if (typeof tag !== "string") continue;

            if (tag.startsWith("roll_bonus_")) {
                const parsed = parseInt(tag.replace("roll_bonus_", ""), 10);
                if (Number.isFinite(parsed)) {
                    bonus += parsed;
                }
                continue;
            }

            if (tag.startsWith("next_roll_mod_")) {
                const parsed = parseInt(tag.replace("next_roll_mod_", ""), 10);
                if (Number.isFinite(parsed)) {
                    bonus += parsed;
                }
                // one-shot: consumed when this roll is computed
                effects.splice(i, 1);
            }
        }

        return bonus;
    }

    private applyCrisisPenalty(rawPenalty: unknown, solverPlayerId: string): void {
        const penalty = typeof rawPenalty === "string" ? rawPenalty : "";
        if (!penalty) return;

        const victims = Array.from(this.state.players.entries())
            .filter(([sessionId]) => sessionId !== solverPlayerId)
            .map(([, p]) => p as PlayerState);

        for (const victim of victims) {
            switch (penalty) {
                case "discard_2":
                    for (let i = 0; i < 2; i++) {
                        const hand = victim.hand as any[];
                        if (hand.length === 0) break;
                        hand.splice(Math.floor(Math.random() * hand.length), 1);
                    }
                    break;
                case "lose_employee":
                    if ((victim.company as any[]).length > 0) {
                        (victim.company as any[]).pop();
                    }
                    break;
                case "lock_tricks": {
                    const effects = victim.activeEffects as string[];
                    if (!effects.includes("locked_tricks")) {
                        effects.push("locked_tricks");
                    }
                    break;
                }
                default:
                    console.warn("[ROOM] Unknown crisis penalty:", penalty);
                    break;
            }
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Win Condition Check
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private checkWinConditions(): void {
        if (this.state.phase === GamePhase.GAME_OVER) return;

        for (const [sessionId, player] of this.state.players) {
            const evaluation = evaluatePlayerWin(player, WIN_EMPLOYEES, WIN_CRISES);
            if (!evaluation.won) continue;

            this.state.winnerId = sessionId;
            this.state.phase = GamePhase.GAME_OVER;

            this.broadcast(ServerEvents.GAME_WON, {
                winnerId: player.sessionId,
                winnerName: player.username,
                finalScore: player.score,
            } as IGameWonEvent);
            console.log(`GAME OVER! Winner: ${player.username} (weighted employees: ${evaluation.weightedEmployeeCount}, crisisVP: ${evaluation.crisisVP})`);
            return;
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Triple Validation Helper
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private checkPlayerTurnAction(client: Client, requiredPA: number): boolean {
        const player = this.state.players.get(client.sessionId);
        const validation = validateAndSpendTurnAction({
            phase: this.state.phase,
            currentTurnPlayerId: this.state.currentTurnPlayerId,
            requesterPlayerId: client.sessionId,
            requiredPA,
            player,
        });

        if (!validation.ok) {
            client.send(ServerEvents.ERROR, {
                code: validation.code ?? "ACTION_DENIED",
                message: validation.message ?? "Azione non consentita.",
            });
            return false;
        }

        return true;
    }

    private peekMagicDiscount(player: PlayerState, isItemCard: boolean): IDiscountPlan {
        if (isItemCard) return { amount: 0, sourceTag: null };

        const effects = player.activeEffects as string[];
        let bestAmount = 0;
        let bestTag: string | null = null;

        for (const tag of effects) {
            if (typeof tag !== "string") continue;
            if (!tag.startsWith("discount_magic_") && !tag.startsWith("discount_trick_")) continue;
            const raw = tag.startsWith("discount_magic_")
                ? tag.replace("discount_magic_", "")
                : tag.replace("discount_trick_", "");
            const parsed = parseInt(raw, 10);
            if (!Number.isFinite(parsed) || parsed <= 0) continue;
            if (parsed > bestAmount) {
                bestAmount = parsed;
                bestTag = tag;
            }
        }

        return { amount: bestAmount, sourceTag: bestTag };
    }

    private consumeMagicDiscount(player: PlayerState, plan: IDiscountPlan): void {
        if (!plan.sourceTag || plan.amount <= 0) return;
        const effects = player.activeEffects as string[];

        const tagIndex = effects.indexOf(plan.sourceTag);
        if (tagIndex !== -1) {
            effects.splice(tagIndex, 1);
        }

        const pairTag = plan.sourceTag.startsWith("discount_magic_")
            ? `discount_trick_${plan.amount}`
            : `discount_magic_${plan.amount}`;
        const pairIndex = effects.indexOf(pairTag);
        if (pairIndex !== -1) {
            effects.splice(pairIndex, 1);
        }
    }

    private cloneRuntimeCardData(card: ICardData): ICardData {
        return {
            id: String(card.id),
            templateId: String(card.templateId),
            type: card.type,
            costPA: card.costPA,
            isFaceUp: card.isFaceUp,
            name: card.name,
            shortDesc: card.shortDesc,
            description: card.description,
            targetRoll: card.targetRoll,
            modifier: card.modifier,
            subtype: card.subtype,
        };
    }

    private removePlayerPermanently(sessionId: string): void {
        this.cleanupPendingForRemovedPlayer(sessionId);

        this.state.players.delete(sessionId);
        const orderIndex = this.state.playerOrder.indexOf(sessionId);
        if (orderIndex !== -1) this.state.playerOrder.splice(orderIndex, 1);
        if (this.state.hostSessionId === sessionId) {
            this.assignNextHost();
        }

        if (this.state.currentTurnPlayerId === sessionId) {
            if (this.state.playerOrder.length > 0 && this.state.phase === GamePhase.PLAYER_TURN) {
                this.advanceTurn();
            } else if (this.state.playerOrder.length === 0) {
                this.state.currentTurnPlayerId = "";
                this.state.turnIndex = 0;
                this.state.phase = GamePhase.WAITING_FOR_PLAYERS;
            } else {
                this.state.currentTurnPlayerId = this.state.playerOrder[this.state.turnIndex] ?? "";
            }
        }
    }

    private cleanupPendingForRemovedPlayer(sessionId: string): void {
        const pending = this.state.pendingAction as IPendingAction | null;
        const inReactionFlow = this.state.phase === GamePhase.REACTION_WINDOW || this.state.phase === GamePhase.RESOLUTION;

        if (pending?.targetPlayerId === sessionId) {
            pending.targetPlayerId = undefined;
        }

        this.state.actionStack = this.state.actionStack
            .filter((action) => action.playerId !== sessionId)
            .map((action) => ({
                ...action,
                targetPlayerId: action.targetPlayerId === sessionId ? undefined : action.targetPlayerId,
            }));

        if (pending?.playerId !== sessionId) {
            return;
        }

        if (this.reactionTimeout) {
            this.reactionTimeout.clear();
            this.reactionTimeout = null;
        }
        if (pending.id) {
            this.pendingRemovedCards.delete(pending.id);
        }
        this.state.pendingAction = null as any;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;

        if (inReactionFlow) {
            this.state.phase = GamePhase.PLAYER_TURN;
            this.broadcast(ServerEvents.ACTION_RESOLVED, {
                success: false,
                log: ["Azione annullata: giocatore disconnesso."],
            });
        }
    }

    private shouldPreserveDisconnectedSlot(): boolean {
        // In partita in corso manteniamo gli slot dei player disconnessi:
        // questo permette rejoin manuale con lo stesso nome anche dopo il timeout di auto-reconnect.
        return this.state.phase !== GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== GamePhase.PRE_LOBBY;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Misc
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private handleEmote(client: Client, data: IEmotePayload): void {
        console.log(`ðŸ’¬ Emote from ${client.sessionId}: ${data?.emoteId}`);
        this.broadcast(ServerEvents.EMOTE, { playerId: client.sessionId, emoteId: data?.emoteId });
    }

    private generateId(): string {
        return "xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private getConnectedPlayerEntries(): Array<{ sessionId: string; player: PlayerState }> {
        const connected: Array<{ sessionId: string; player: PlayerState }> = [];
        for (const [sessionId, player] of this.state.players) {
            const typedPlayer = player as PlayerState;
            if (typedPlayer.isConnected) {
                connected.push({ sessionId, player: typedPlayer });
            }
        }
        return connected;
    }

    private assignNextHost(): void {
        const connected = this.getConnectedPlayerEntries();
        if (connected.length > 0) {
            this.state.hostSessionId = connected[0].sessionId;
            return;
        }
        const firstAny = this.state.players.keys().next();
        this.state.hostSessionId = firstAny.done ? "" : firstAny.value;
    }

    private normalizeRoomCode(raw: unknown): string {
        const validation = validateOfficeRoomCode(raw);
        if (!validation.ok) {
            throw new ServerError(validation.statusCode, validation.message);
        }
        return validation.value;
    }
    private findPlayerByName(name: string): { sessionId: string; player: PlayerState } | null {
        const target = name.trim().toLowerCase();
        for (const [sessionId, player] of this.state.players) {
            if ((player.username ?? "").trim().toLowerCase() === target) {
                return { sessionId, player: player as PlayerState };
            }
        }
        return null;
    }
}










