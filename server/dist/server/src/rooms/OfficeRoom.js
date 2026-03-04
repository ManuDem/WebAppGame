"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficeRoom = void 0;
const colyseus_1 = require("colyseus");
const State_1 = require("../State");
const SharedTypes_1 = require("../../../shared/SharedTypes");
const DeckManager_1 = require("../../../shared/DeckManager");
const CardEffectParser_1 = require("../../../shared/CardEffectParser");
const cards_db_json_1 = __importDefault(require("../../../shared/cards_db.json"));
// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const MAX_PLAYERS = 10;
const STARTING_HAND_SIZE = 3;
/** Win conditions */
const WIN_EMPLOYEES = 4; // Modalita semplificata: 4 dipendenti in company
const WIN_CRISES = 2; // Modalita semplificata: 2 crisi risolte (VP score)
// ═════════════════════════════════════════════════════════
//  OfficeRoom — the authoritative game room
// ═════════════════════════════════════════════════════════
class OfficeRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.roomCode = "0000";
        /** Handle to the reaction-window countdown timer */
        this.reactionTimeout = null;
        /** Server-side deck (not synchronized to state) */
        this.serverDeck = [];
        /** Card template lookup map (templateId → ICardTemplate) built from cards_db.json */
        this.cardTemplates = new Map();
    }
    // ─────────────────────────────────────────────────────
    //  Lifecycle
    // ─────────────────────────────────────────────────────
    onCreate(_options) {
        console.log("🏢 OfficeRoom created!");
        console.log("[ROOM] OfficeRoom.onCreate called with options:", _options);
        this.setState(new State_1.OfficeRoomState());
        this.state.pendingAction = null;
        this.maxClients = MAX_PLAYERS;
        this.roomCode = this.normalizeRoomCode(_options?.roomCode);
        this.setMetadata({ roomCode: this.roomCode });
        console.log("[ROOM] Max clients set to:", this.maxClients);
        // Build card template lookup from embedded JSON
        this.buildCardTemplateLookup();
        this.onMessage(SharedTypes_1.ClientMessages.JOIN_GAME, (client, data) => this.handleJoinGame(client, data));
        this.onMessage(SharedTypes_1.ClientMessages.START_MATCH, (client, _data) => this.handleStartMatch(client));
        this.onMessage(SharedTypes_1.ClientMessages.END_TURN, (client, _data) => this.handleEndTurn(client));
        this.onMessage(SharedTypes_1.ClientMessages.DRAW_CARD, (client, _data) => this.handleDrawCard(client));
        this.onMessage(SharedTypes_1.ClientMessages.PLAY_EMPLOYEE, (client, data) => this.handlePlayEmployee(client, data));
        this.onMessage(SharedTypes_1.ClientMessages.PLAY_MAGIC, (client, data) => this.handlePlayMagic(client, data));
        this.onMessage(SharedTypes_1.ClientMessages.SOLVE_CRISIS, (client, data) => this.handleSolveCrisis(client, data));
        this.onMessage(SharedTypes_1.ClientMessages.PLAY_REACTION, (client, data) => this.handlePlayReaction(client, data));
        this.onMessage(SharedTypes_1.ClientMessages.EMOTE, (client, data) => this.handleEmote(client, data));
    }
    onAuth(client, options, _request) {
        console.log("[AUTH] Incoming auth request from client", client.sessionId, "options:", { ceoName: options?.ceoName, roomCode: options?.roomCode });
        if (!options?.ceoName) {
            console.warn("[AUTH] Rejected: missing ceoName");
            throw new colyseus_1.ServerError(400, "Nome CEO mancante.");
        }
        const roomCode = this.normalizeRoomCode(options?.roomCode);
        if (roomCode !== this.roomCode) {
            console.warn("[AUTH] Rejected: roomCode mismatch", roomCode, "!=", this.roomCode);
            throw new colyseus_1.ServerError(404, "Codice stanza non valido.");
        }
        const ceoName = options.ceoName;
        if (typeof ceoName !== "string") {
            console.warn("[AUTH] Rejected: ceoName is not a string", ceoName);
            throw new colyseus_1.ServerError(400, "Il nome CEO deve essere una stringa.");
        }
        if (ceoName.length < 3 || ceoName.length > 15) {
            console.warn("[AUTH] Rejected: ceoName invalid length", ceoName);
            throw new colyseus_1.ServerError(400, "Il nome CEO deve essere compreso tra 3 e 15 caratteri.");
        }
        if (!/^[a-zA-Z0-9]+$/.test(ceoName)) {
            console.warn("[AUTH] Rejected: ceoName invalid characters", ceoName);
            throw new colyseus_1.ServerError(400, "Il nome CEO può contenere solo caratteri alfanumerici (niente spazi o simboli).");
        }
        const existing = this.findPlayerByName(ceoName);
        if (existing && existing.player.isConnected) {
            console.warn("[AUTH] Rejected: ceoName already connected", ceoName);
            throw new colyseus_1.ServerError(409, "Nome CEO già in uso in questa stanza.");
        }
        if (this.state.phase !== SharedTypes_1.GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== SharedTypes_1.GamePhase.PRE_LOBBY && !existing) {
            console.warn("[AUTH] Rejected: match already started and no reconnect slot for", ceoName);
            throw new colyseus_1.ServerError(403, "Partita già in corso. Puoi rientrare solo con un nome già presente.");
        }
        console.log("[AUTH] Accepted client", client.sessionId, "ceoName:", ceoName, "rejoinFrom:", existing?.sessionId ?? null);
        return { ceoName, rejoinFromSessionId: existing?.sessionId ?? null };
    }
    onJoin(client, options, auth) {
        console.log(`👤 Player connected: ${client.sessionId}`);
        const rejoinFrom = auth?.rejoinFromSessionId ?? null;
        if (rejoinFrom && this.state.players.has(rejoinFrom)) {
            const player = this.state.players.get(rejoinFrom);
            this.state.players.delete(rejoinFrom);
            player.sessionId = client.sessionId;
            player.isConnected = true;
            this.state.players.set(client.sessionId, player);
            const orderIndex = this.state.playerOrder.indexOf(rejoinFrom);
            if (orderIndex !== -1) {
                this.state.playerOrder.splice(orderIndex, 1, client.sessionId);
            }
            if (this.state.currentTurnPlayerId === rejoinFrom) {
                this.state.currentTurnPlayerId = client.sessionId;
            }
            if (this.state.pendingAction) {
                if (this.state.pendingAction.playerId === rejoinFrom) {
                    this.state.pendingAction.playerId = client.sessionId;
                }
                if (this.state.pendingAction.targetPlayerId === rejoinFrom) {
                    this.state.pendingAction.targetPlayerId = client.sessionId;
                }
            }
            this.state.actionStack = this.state.actionStack.map((action) => ({
                ...action,
                playerId: action.playerId === rejoinFrom ? client.sessionId : action.playerId,
                targetPlayerId: action.targetPlayerId === rejoinFrom ? client.sessionId : action.targetPlayerId,
            }));
            if (this.state.hostSessionId === rejoinFrom) {
                this.state.hostSessionId = client.sessionId;
            }
            console.log("[JOIN] Reconnected by name:", player.username, "oldSession:", rejoinFrom, "newSession:", client.sessionId);
            return;
        }
        const player = new State_1.PlayerState();
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
    async onLeave(client, consented) {
        console.log("[LEAVE] onLeave for session", client.sessionId, "consented:", consented);
        const player = this.state.players.get(client.sessionId);
        const wasCurrentTurn = this.state.currentTurnPlayerId === client.sessionId;
        if (player) {
            player.isConnected = false;
        }
        console.log(`👋 Player left: ${client.sessionId} (consented: ${consented})`);
        // Check if it's their turn. If so, start a 5s fallback to automatically skip
        // their turn so the game isn't completely paralyzed
        let skipTimeout = null;
        if (!consented && this.state.currentTurnPlayerId === client.sessionId && this.state.phase === SharedTypes_1.GamePhase.PLAYER_TURN) {
            console.log(`   ⏱️  Active player disconnected. Waiting 5s before advancing turn...`);
            skipTimeout = this.clock.setTimeout(() => {
                const p = this.state.players.get(client.sessionId);
                if (p && !p.isConnected && this.state.currentTurnPlayerId === client.sessionId && this.state.phase === SharedTypes_1.GamePhase.PLAYER_TURN) {
                    console.log(`   ⏭️  5s passed. Auto-skipping turn for disconnected player.`);
                    this.advanceTurn();
                }
            }, 5000);
        }
        if (consented) {
            this.state.players.delete(client.sessionId);
            const orderIndex = this.state.playerOrder.indexOf(client.sessionId);
            if (orderIndex !== -1)
                this.state.playerOrder.splice(orderIndex, 1);
            if (this.state.hostSessionId === client.sessionId) {
                this.assignNextHost();
            }
            if (skipTimeout) {
                skipTimeout.clear();
            }
            if (wasCurrentTurn && this.state.phase === SharedTypes_1.GamePhase.PLAYER_TURN) {
                if (this.state.playerOrder.length > 0) {
                    this.advanceTurn();
                }
                else {
                    this.state.currentTurnPlayerId = "";
                    this.state.turnIndex = 0;
                    this.state.phase = SharedTypes_1.GamePhase.PRE_LOBBY;
                }
            }
            return;
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
            }
            catch (e) {
                // Timeout di 30s scaduto, cancellare il giocatore definitivamente dallo State
                console.log(`   ❌ Timeout expired. Deleting player ${client.sessionId}.`);
                this.state.players.delete(client.sessionId);
                const orderIndex = this.state.playerOrder.indexOf(client.sessionId);
                if (orderIndex !== -1)
                    this.state.playerOrder.splice(orderIndex, 1);
                if (this.state.hostSessionId === client.sessionId) {
                    this.assignNextHost();
                }
            }
        }
    }
    // ─────────────────────────────────────────────────────
    //  Card Template Lookup
    // ─────────────────────────────────────────────────────
    buildCardTemplateLookup() {
        if (!Array.isArray(cards_db_json_1.default) || cards_db_json_1.default.length === 0) {
            console.error("[ROOM] FATAL: cards_db.json is missing, invalid or empty. Card templates will not be available.");
            return;
        }
        for (const raw of cards_db_json_1.default) {
            if (!raw || typeof raw.id !== "string") {
                console.warn("[ROOM] Skipping invalid card template entry from cards_db.json:", raw);
                continue;
            }
            this.cardTemplates.set(raw.id, raw);
        }
        if (this.cardTemplates.size === 0) {
            console.error("[ROOM] FATAL: No valid card templates loaded from cards_db.json.");
        }
        else {
            console.log(`📚 Loaded ${this.cardTemplates.size} card templates from cards_db.json`);
        }
    }
    getTemplate(templateId) {
        return this.cardTemplates.get(templateId);
    }
    // ─────────────────────────────────────────────────────
    //  Game Start
    // ─────────────────────────────────────────────────────
    handleJoinGame(client, _data) {
        if (this.state.phase !== SharedTypes_1.GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== SharedTypes_1.GamePhase.PRE_LOBBY) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { message: "Il gioco è già iniziato." });
            return;
        }
        const player = this.state.players.get(client.sessionId);
        if (player && !player.isReady) {
            player.isReady = true;
            console.log(`   ${client.sessionId} is ready!`);
        }
    }
    handleStartMatch(client) {
        if (this.state.phase !== SharedTypes_1.GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== SharedTypes_1.GamePhase.PRE_LOBBY) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "GAME_ALREADY_STARTED", message: "La partita e gia iniziata." });
            return;
        }
        if (client.sessionId !== this.state.hostSessionId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "HOST_ONLY", message: "Solo l'host puo avviare la partita." });
            return;
        }
        const connectedEntries = this.getConnectedPlayerEntries();
        if (connectedEntries.length < SharedTypes_1.MIN_PLAYERS_TO_START) {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "NOT_ENOUGH_PLAYERS",
                message: `Servono almeno ${SharedTypes_1.MIN_PLAYERS_TO_START} giocatori connessi.`,
            });
            return;
        }
        const allConnectedReady = connectedEntries.every((entry) => entry.player.isReady);
        if (!allConnectedReady) {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "PLAYERS_NOT_READY",
                message: "Tutti i giocatori connessi devono confermare prima di iniziare.",
            });
            return;
        }
        this.startGame(connectedEntries.map((entry) => entry.sessionId));
    }
    startGame(participantIds) {
        const connectedReadyIds = participantIds.filter((sessionId) => {
            const player = this.state.players.get(sessionId);
            return Boolean(player && player.isConnected && player.isReady);
        });
        if (connectedReadyIds.length < SharedTypes_1.MIN_PLAYERS_TO_START) {
            this.broadcast(SharedTypes_1.ServerEvents.ERROR, {
                code: "NOT_ENOUGH_READY",
                message: `Servono almeno ${SharedTypes_1.MIN_PLAYERS_TO_START} giocatori pronti.`,
            });
            return;
        }
        this.state.phase = SharedTypes_1.GamePhase.PLAYER_TURN;
        // Fisher-Yates shuffle of player order
        const players = Array.from(connectedReadyIds);
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        while (this.state.playerOrder.length > 0)
            this.state.playerOrder.pop();
        players.forEach((p) => this.state.playerOrder.push(p));
        this.state.turnIndex = 0;
        this.state.currentTurnPlayerId = this.state.playerOrder.at(0) ?? "";
        this.state.turnNumber = 1;
        // Build real deck via DeckManager
        try {
            this.serverDeck = DeckManager_1.DeckManager.createDeck();
        }
        catch (err) {
            console.error("[ROOM] FATAL: Failed to create deck from cards_db.json:", err);
            this.broadcast(SharedTypes_1.ServerEvents.ERROR, {
                code: "DECK_INIT_FAILED",
                message: "Errore interno nel mazzo di gioco. Partita annullata."
            });
            this.state.phase = SharedTypes_1.GamePhase.GAME_OVER;
            return;
        }
        if (!this.serverDeck || this.serverDeck.length === 0) {
            console.error("[ROOM] FATAL: DeckManager.createDeck returned an empty deck. Aborting game start.");
            this.broadcast(SharedTypes_1.ServerEvents.ERROR, {
                code: "DECK_EMPTY_INIT",
                message: "Impossibile iniziare la partita: mazzo vuoto."
            });
            this.state.phase = SharedTypes_1.GamePhase.GAME_OVER;
            return;
        }
        this.state.deckCount = this.serverDeck.length;
        console.log(`🃏 Deck ready: ${this.state.deckCount} cards`);
        // Populate central crises (crisis type only, up to 3)
        this.populateCentralCrises();
        // Deal an initial hand to keep the first turns fast and readable (casual mode).
        this.dealInitialHands(players, STARTING_HAND_SIZE);
        // Give PA to first active player
        const activePlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (activePlayer)
            activePlayer.actionPoints = SharedTypes_1.MAX_ACTION_POINTS;
        console.log(`🎮 Game started! First turn: ${this.state.currentTurnPlayerId} | starting hand: ${STARTING_HAND_SIZE}`);
        this.broadcast(SharedTypes_1.ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: SharedTypes_1.MAX_ACTION_POINTS
        });
    }
    populateCentralCrises() {
        const crisisTemplates = Array.from(this.cardTemplates.values()).filter(t => t.type === "crisis");
        const max = Math.min(crisisTemplates.length, 3);
        for (let i = 0; i < max; i++) {
            const t = crisisTemplates[i];
            const card = new State_1.CardState();
            card.id = this.generateId();
            card.templateId = t.id;
            card.type = SharedTypes_1.CardType.IMPREVISTO;
            card.costPA = t.cost;
            card.isFaceUp = true;
            card.name = t.name;
            this.state.centralCrises.push(card);
        }
        console.log(`🏦 Central crises populated: ${this.state.centralCrises.length}`);
    }
    dealInitialHands(participantIds, cardsPerPlayer) {
        if (cardsPerPlayer <= 0 || participantIds.length === 0)
            return;
        for (let round = 0; round < cardsPerPlayer; round++) {
            for (const sessionId of participantIds) {
                const player = this.state.players.get(sessionId);
                if (!player || !player.isConnected)
                    continue;
                const drawnCard = DeckManager_1.DeckManager.drawCard(this.serverDeck);
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
    createCardStateFromDeckCard(drawnCard) {
        const card = new State_1.CardState();
        card.id = drawnCard.id;
        card.templateId = drawnCard.templateId;
        card.type = drawnCard.type;
        if (drawnCard.costPA !== undefined)
            card.costPA = drawnCard.costPA;
        card.isFaceUp = false;
        const tmpl = this.getTemplate(drawnCard.templateId);
        if (tmpl) {
            card.name = tmpl.name;
            card.description = tmpl.description;
        }
        return card;
    }
    // ─────────────────────────────────────────────────────
    //  Turn Management
    // ─────────────────────────────────────────────────────
    handleEndTurn(client) {
        if (client.sessionId !== this.state.currentTurnPlayerId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "NOT_YOUR_TURN", message: "Non è il tuo turno." });
            return;
        }
        if (this.state.phase !== SharedTypes_1.GamePhase.PLAYER_TURN) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "WRONG_PHASE", message: "La fase non lo consente." });
            return;
        }
        this.advanceTurn();
    }
    advanceTurn() {
        const playerCount = this.state.playerOrder.length;
        if (playerCount === 0)
            return;
        let nextIndex = this.state.turnIndex;
        let attempts = 0;
        let nextPlayerId = "";
        do {
            nextIndex = (nextIndex + 1) % playerCount;
            nextPlayerId = this.state.playerOrder.at(nextIndex) ?? "";
            attempts++;
            if (attempts >= playerCount)
                break;
        } while (!this.state.players.get(nextPlayerId)?.isConnected);
        this.state.turnIndex = nextIndex;
        this.state.currentTurnPlayerId = nextPlayerId;
        this.state.phase = SharedTypes_1.GamePhase.PLAYER_TURN;
        this.state.turnNumber++;
        const nextPlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (nextPlayer)
            nextPlayer.actionPoints = SharedTypes_1.MAX_ACTION_POINTS;
        // TASK 3: Reset locked_tricks on all players at turn boundary
        this.state.players.forEach((player) => {
            const effects = player.activeEffects;
            const idx = effects.indexOf("locked_tricks");
            if (idx !== -1)
                effects.splice(idx, 1);
        });
        console.log(`➡️  Turn ${this.state.turnNumber}: ${this.state.currentTurnPlayerId}`);
        this.broadcast(SharedTypes_1.ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: SharedTypes_1.MAX_ACTION_POINTS
        });
        this.checkWinConditions();
    }
    // ─────────────────────────────────────────────────────
    //  DRAW_CARD — uses DeckManager.drawCard
    // ─────────────────────────────────────────────────────
    handleDrawCard(client) {
        if (!this.checkPlayerTurnAction(client, SharedTypes_1.DRAW_CARD_COST))
            return;
        const drawnCard = DeckManager_1.DeckManager.drawCard(this.serverDeck);
        if (!drawnCard) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "DECK_EMPTY", message: "Il mazzo è vuoto." });
            // Refund PA
            const player = this.state.players.get(client.sessionId);
            if (player)
                player.actionPoints += SharedTypes_1.DRAW_CARD_COST;
            return;
        }
        this.state.deckCount = this.serverDeck.length;
        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.hand.push(this.createCardStateFromDeckCard(drawnCard));
        }
        console.log(`📥 DRAW_CARD by ${client.sessionId}. Deck left: ${this.state.deckCount}`);
        client.send(SharedTypes_1.ServerEvents.CARD_DRAWN, {
            card: drawnCard,
            remainingDeck: this.state.deckCount
        });
        this.checkWinConditions();
    }
    // ─────────────────────────────────────────────────────
    //  PLAY_EMPLOYEE — Reaction Window trigger
    // ─────────────────────────────────────────────────────
    handlePlayEmployee(client, data) {
        const { cardId } = data;
        if (!cardId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "MISSING_CARD_ID", message: "Specifica il cardId." });
            return;
        }
        const player = this.state.players.get(client.sessionId);
        if (!player)
            return;
        const handArr = player.hand;
        const cardIdx = handArr.findIndex((c) => c.id === cardId);
        if (cardIdx === -1) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non è nella tua mano." });
            return;
        }
        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const cost = template?.cost ?? 1;
        if (!this.checkPlayerTurnAction(client, cost))
            return;
        // PA deducted. Remove card from hand (stored in pending until resolve).
        handArr.splice(cardIdx, 1);
        // Populate pendingAction
        const pending = new State_1.PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = SharedTypes_1.ClientMessages.PLAY_EMPLOYEE;
        pending.targetCardId = cardInHand.templateId; // templateId for CardEffectParser lookup
        pending.timestamp = Date.now();
        this.state.pendingAction = pending;
        this.state.phase = SharedTypes_1.GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + SharedTypes_1.REACTION_WINDOW_MS;
        // Seed the LIFO action stack with the original action (at index 0)
        this.state.actionStack = [pending];
        // Start server-side timeout
        if (this.reactionTimeout)
            this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), SharedTypes_1.REACTION_WINDOW_MS);
        console.log(`🃏 PLAY_EMPLOYEE by ${client.sessionId}: ${template?.name} (cost ${cost} PA). Window open.`);
        // Broadcast START_REACTION_TIMER so Phaser shows animated countdown
        this.broadcast(SharedTypes_1.ServerEvents.START_REACTION_TIMER, {
            durationMs: SharedTypes_1.REACTION_WINDOW_MS,
            actionTypeLabel: `Assunzione di "${template?.name ?? cardInHand.templateId}" in corso!`
        });
    }
    // ─────────────────────────────────────────────────────
    //  SOLVE_CRISIS — Reaction Window trigger
    // ─────────────────────────────────────────────────────
    handleSolveCrisis(client, data) {
        const { crisisId } = data;
        if (!crisisId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "MISSING_CRISIS_ID", message: "Specifica il crisisId." });
            return;
        }
        const crisisArr = this.state.centralCrises;
        const crisis = crisisArr.find((c) => c.id === crisisId);
        if (!crisis) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "CRISIS_NOT_FOUND", message: "La crisi non esiste sulla plancia." });
            return;
        }
        const template = this.getTemplate(crisis.templateId);
        const cost = template?.cost ?? 2;
        if (!this.checkPlayerTurnAction(client, cost))
            return;
        // Populate pendingAction
        const pending = new State_1.PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = SharedTypes_1.ClientMessages.SOLVE_CRISIS;
        pending.targetCrisisId = crisisId;
        pending.targetCardId = crisis.templateId; // for CardEffectParser resolve
        pending.timestamp = Date.now();
        this.state.pendingAction = pending;
        this.state.phase = SharedTypes_1.GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + SharedTypes_1.REACTION_WINDOW_MS;
        this.state.actionStack = [pending];
        if (this.reactionTimeout)
            this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), SharedTypes_1.REACTION_WINDOW_MS);
        const player = this.state.players.get(client.sessionId);
        console.log(`💼 SOLVE_CRISIS by ${client.sessionId}: ${template?.name}. Window open.`);
        this.broadcast(SharedTypes_1.ServerEvents.START_REACTION_TIMER, {
            durationMs: SharedTypes_1.REACTION_WINDOW_MS,
            actionTypeLabel: `Risoluzione crisi "${template?.name ?? crisis.templateId}" in corso!`
        });
    }
    // ─────────────────────────────────────────────────────
    //  PLAY_MAGIC — immediate (no Reaction Window)
    // ─────────────────────────────────────────────────────
    handlePlayMagic(client, data) {
        const { cardId, targetPlayerId } = data;
        if (!cardId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "MISSING_CARD_ID", message: "Specifica il cardId." });
            return;
        }
        const player = this.state.players.get(client.sessionId);
        if (!player)
            return;
        // TASK 3: Check locked_tricks tag
        if (player.activeEffects.includes("locked_tricks")) {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "TRICKS_LOCKED",
                message: "I Trucchi sono bloccati per questo turno!"
            });
            return;
        }
        const handArr = player.hand;
        const cardIdx = handArr.findIndex((c) => c.id === cardId);
        if (cardIdx === -1) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non è nella tua mano." });
            return;
        }
        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const cost = template?.cost ?? 1;
        // TASK 3: Validate targetPlayerId for targeted tricks
        const needsTarget = template?.effect?.action &&
            ["steal_pa", "steal_card", "discard", "trade_random"].includes(template.effect.action);
        if (needsTarget && !targetPlayerId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "MISSING_TARGET",
                message: "Questa carta richiede di scegliere un bersaglio."
            });
            return;
        }
        if (targetPlayerId) {
            if (targetPlayerId === client.sessionId) {
                client.send(SharedTypes_1.ServerEvents.ERROR, { code: "SELF_TARGET", message: "Non puoi bersagliare te stesso." });
                return;
            }
            if (!this.state.players.has(targetPlayerId)) {
                client.send(SharedTypes_1.ServerEvents.ERROR, { code: "INVALID_TARGET", message: "Il giocatore bersaglio non esiste." });
                return;
            }
        }
        if (!this.checkPlayerTurnAction(client, cost))
            return;
        // Deduct PA and remove from hand immediately
        handArr.splice(cardIdx, 1);
        // Populate pendingAction 
        const pending = new State_1.PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = SharedTypes_1.ClientMessages.PLAY_MAGIC;
        pending.targetCardId = cardInHand.templateId; // templateId for CardEffectParser
        pending.targetPlayerId = targetPlayerId;
        pending.timestamp = Date.now();
        this.state.pendingAction = pending;
        this.state.phase = SharedTypes_1.GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + SharedTypes_1.REACTION_WINDOW_MS;
        this.state.actionStack = [pending];
        if (this.reactionTimeout)
            this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), SharedTypes_1.REACTION_WINDOW_MS);
        console.log(`✨ PLAY_MAGIC by ${client.sessionId}: ${template?.name}. Window open.`);
        this.broadcast(SharedTypes_1.ServerEvents.START_REACTION_TIMER, {
            durationMs: SharedTypes_1.REACTION_WINDOW_MS,
            actionTypeLabel: `Magheggio "${template?.name ?? cardInHand.templateId}" in corso!`
        });
    }
    // ─────────────────────────────────────────────────────
    //  PLAY_REACTION — enqueue into action stack
    // ─────────────────────────────────────────────────────
    handlePlayReaction(client, data) {
        if (this.state.phase !== SharedTypes_1.GamePhase.REACTION_WINDOW) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "NO_REACTION_WINDOW", message: "Nessuna finestra di reazione attiva." });
            return;
        }
        if (client.sessionId === this.state.pendingAction?.playerId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "SELF_REACTION", message: "Non puoi reagire alla tua stessa azione." });
            return;
        }
        const { cardId } = data;
        if (!cardId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "MISSING_CARD_ID", message: "Specifica la carta Reazione." });
            return;
        }
        const player = this.state.players.get(client.sessionId);
        if (!player)
            return;
        const handArr = player.hand;
        const cardIdx = handArr.findIndex((c) => c.id === cardId);
        if (cardIdx === -1) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non è nella tua mano." });
            return;
        }
        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const cost = template?.cost ?? 1;
        if (player.actionPoints < cost) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "NO_PA", message: "Punti Azione insufficienti per reagire." });
            return;
        }
        // Deduct PA and remove card from hand
        player.actionPoints -= cost;
        handArr.splice(cardIdx, 1);
        // Create IPendingAction for this reaction and push onto stack (LIFO top)
        const reactionPending = {
            id: this.generateId(),
            playerId: client.sessionId,
            actionType: SharedTypes_1.ClientMessages.PLAY_REACTION,
            targetCardId: cardInHand.templateId, // reaction card's templateId for CardEffectParser
            timestamp: Date.now(),
            isCancelled: false
        };
        // Push BEFORE original action so stack[0] = newest reaction (LIFO)
        this.state.actionStack.unshift(reactionPending);
        console.log(`🗡️  PLAY_REACTION by ${client.sessionId}: ${template?.name} queued (stack depth: ${this.state.actionStack.length})`);
        this.broadcast(SharedTypes_1.ServerEvents.REACTION_TRIGGERED, {
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
    resolvePhase() {
        this.state.phase = SharedTypes_1.GamePhase.RESOLUTION;
        console.log(`🔥 Reaction Window closed. Resolving stack of ${this.state.actionStack.length} action(s)...`);
        const originalAction = this.state.pendingAction;
        // Build the reactions array in chronological order (oldest first).
        // Our internal stack has stack[0] = newest reaction, stack[N-1] = original action.
        const chainStack = [...this.state.actionStack].reverse();
        // The first element is the original action. The rest are reactions.
        const reactions = chainStack.slice(1);
        // Run the full LIFO resolution queue using Agent 3's API
        let result = null;
        try {
            if (originalAction) {
                result = CardEffectParser_1.CardEffectParser.resolveQueue(originalAction, reactions, this.state);
            }
        }
        catch (err) {
            console.error("[ROOM] FATAL: Error during CardEffectParser.resolveQueue:", err);
            result = {
                success: false,
                log: ["[resolveQueue] Internal error during resolution. Action cancelled."]
            };
        }
        // Apply structural effects that CardEffectParser can't do (Colyseus schema mutations):
        if (originalAction && !originalAction.isCancelled) {
            switch (originalAction.actionType) {
                case SharedTypes_1.ClientMessages.PLAY_EMPLOYEE:
                    this.applyEmployeeHire(originalAction.playerId, originalAction.targetCardId);
                    break;
                case SharedTypes_1.ClientMessages.SOLVE_CRISIS:
                    this.applyCrisisRemoval(originalAction.playerId, originalAction.targetCrisisId);
                    break;
            }
        }
        // TASK 2: Consume pending_draw_X tags set by CardEffectParser
        this.state.players.forEach((player) => {
            const effects = player.activeEffects;
            for (let i = effects.length - 1; i >= 0; i--) {
                const tag = effects[i];
                if (typeof tag === 'string' && tag.startsWith('pending_draw_')) {
                    const drawCount = parseInt(tag.replace('pending_draw_', ''), 10);
                    if (!isNaN(drawCount) && drawCount > 0) {
                        for (let d = 0; d < drawCount; d++) {
                            const drawn = DeckManager_1.DeckManager.drawCard(this.serverDeck);
                            if (drawn) {
                                player.hand.push(this.createCardStateFromDeckCard(drawn));
                            }
                        }
                        this.state.deckCount = this.serverDeck.length;
                    }
                    effects.splice(i, 1); // Consume the tag
                }
            }
        });
        const success = result ? result.success : !originalAction?.isCancelled;
        const log = result ? result.log :
            (success ? [`Azione originale eseguita con successo.`] : [`Azione annullata.`]);
        this.broadcast(SharedTypes_1.ServerEvents.ACTION_RESOLVED, { success, log });
        // Cleanup
        this.state.pendingAction = null;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;
        this.reactionTimeout = null;
        this.state.phase = SharedTypes_1.GamePhase.PLAYER_TURN;
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
    applyEmployeeHire(playerId, templateId) {
        const player = this.state.players.get(playerId);
        if (!player)
            return;
        const template = this.getTemplate(templateId);
        if (!template)
            return;
        const companyCard = new State_1.CardState();
        companyCard.id = this.generateId();
        companyCard.templateId = templateId;
        companyCard.type = SharedTypes_1.CardType.EMPLOYEE;
        companyCard.costPA = template.cost;
        companyCard.isFaceUp = true;
        companyCard.name = template.name;
        player.company.push(companyCard);
        console.log(`   👔 ${player.username} hired ${template.name}. Company size: ${player.company.length}`);
    }
    /**
     * Removes the resolved crisis from centralCrises.
     * CardEffectParser.resolve already awarded VP via resolveCrisis().
     */
    applyCrisisRemoval(playerId, crisisId) {
        const crisisArr = this.state.centralCrises;
        const idx = crisisArr.findIndex((c) => c.id === crisisId);
        if (idx !== -1) {
            const crisis = crisisArr[idx];
            crisisArr.splice(idx, 1);
            console.log(`   🗑️  Crisis ${crisis.templateId} removed from central table.`);
        }
    }
    // ─────────────────────────────────────────────────────
    //  Win Condition Check
    // ─────────────────────────────────────────────────────
    checkWinConditions() {
        if (this.state.phase === SharedTypes_1.GamePhase.GAME_OVER)
            return;
        for (const [sessionId, player] of this.state.players) {
            // TASK 1: Calculate weighted employee count using win_multiplier_X tags
            let weightedEmployeeCount = 0;
            const companyArr = player.company;
            for (const empCard of companyArr) {
                let multiplier = 1;
                const effects = player.activeEffects;
                for (const eff of effects) {
                    if (typeof eff === 'string' && eff.startsWith('win_multiplier_')) {
                        const parsedMul = parseInt(eff.replace('win_multiplier_', ''), 10);
                        if (!isNaN(parsedMul) && parsedMul > multiplier) {
                            multiplier = parsedMul;
                        }
                    }
                }
                weightedEmployeeCount += multiplier;
            }
            const crisisVP = player.score;
            const won = weightedEmployeeCount >= WIN_EMPLOYEES || crisisVP >= WIN_CRISES;
            if (won) {
                this.state.winnerId = sessionId;
                this.state.phase = SharedTypes_1.GamePhase.GAME_OVER;
                this.broadcast(SharedTypes_1.ServerEvents.GAME_WON, {
                    winnerId: player.sessionId,
                    winnerName: player.username,
                    finalScore: player.score
                });
                console.log(`🏆 GAME OVER! Winner: ${player.username} (weighted employees: ${weightedEmployeeCount}, crisisVP: ${crisisVP})`);
                return;
            }
        }
    }
    // ─────────────────────────────────────────────────────
    //  Triple Validation Helper
    // ─────────────────────────────────────────────────────
    checkPlayerTurnAction(client, requiredPA) {
        // TASK 4: Block all actions during GAME_OVER
        if (this.state.phase === SharedTypes_1.GamePhase.GAME_OVER) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "GAME_OVER", message: "La partita è terminata." });
            return false;
        }
        if (client.sessionId !== this.state.currentTurnPlayerId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "NOT_YOUR_TURN", message: "Non è il tuo turno." });
            return false;
        }
        if (this.state.phase !== SharedTypes_1.GamePhase.PLAYER_TURN) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "WRONG_PHASE", message: "Fase non corretta." });
            return false;
        }
        const player = this.state.players.get(client.sessionId);
        if (!player || player.actionPoints < requiredPA) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "NO_PA", message: "Punti Azione insufficienti." });
            return false;
        }
        player.actionPoints -= requiredPA;
        return true;
    }
    // ─────────────────────────────────────────────────────
    //  Misc
    // ─────────────────────────────────────────────────────
    handleEmote(client, data) {
        console.log(`💬 Emote from ${client.sessionId}: ${data?.emoteId}`);
        this.broadcast("EMOTE", { playerId: client.sessionId, emoteId: data?.emoteId });
    }
    generateId() {
        return "xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    getConnectedPlayerEntries() {
        const connected = [];
        for (const [sessionId, player] of this.state.players) {
            const typedPlayer = player;
            if (typedPlayer.isConnected) {
                connected.push({ sessionId, player: typedPlayer });
            }
        }
        return connected;
    }
    assignNextHost() {
        const connected = this.getConnectedPlayerEntries();
        if (connected.length > 0) {
            this.state.hostSessionId = connected[0].sessionId;
            return;
        }
        const firstAny = this.state.players.keys().next();
        this.state.hostSessionId = firstAny.done ? "" : firstAny.value;
    }
    normalizeRoomCode(raw) {
        const code = String(raw ?? "").trim();
        if (!/^\d{4}$/.test(code)) {
            throw new colyseus_1.ServerError(400, "Il codice stanza deve avere 4 cifre.");
        }
        return code;
    }
    findPlayerByName(name) {
        const target = name.trim().toLowerCase();
        for (const [sessionId, player] of this.state.players) {
            if ((player.username ?? "").trim().toLowerCase() === target) {
                return { sessionId, player: player };
            }
        }
        return null;
    }
}
exports.OfficeRoom = OfficeRoom;
//# sourceMappingURL=OfficeRoom.js.map