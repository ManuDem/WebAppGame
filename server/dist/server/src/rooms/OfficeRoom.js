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
const monsterBoard_1 = require("../game/monsterBoard");
const turnFlow_1 = require("../game/turnFlow");
const winConditions_1 = require("../game/winConditions");
const reactionResolution_1 = require("../game/reactionResolution");
const itemEquip_1 = require("../game/itemEquip");
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Constants
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MAX_PLAYERS = 10;
const STARTING_HAND_SIZE = 3;
/** Win conditions */
const WIN_EMPLOYEES = 4; // Here-to-Slay Lite: 4 Hero in company
const WIN_CRISES = 2; // Here-to-Slay Lite: 2 Monster risolti (VP score)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  OfficeRoom â€” the authoritative game room
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
class OfficeRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.roomCode = "0000";
        /** Handle to the reaction-window countdown timer */
        this.reactionTimeout = null;
        /** Server-side deck (not synchronized to state) */
        this.serverDeck = [];
        /** Card template lookup map (templateId â†’ ICardTemplate) built from cards_db.json */
        this.cardTemplates = new Map();
        this.monsterTemplateIds = [];
        this.monsterBag = [];
        this.pendingRemovedCards = new Map();
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Lifecycle
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    onCreate(_options) {
        console.log("ðŸ¢ OfficeRoom created!");
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
            throw new colyseus_1.ServerError(400, "Il nome CEO puÃ² contenere solo caratteri alfanumerici (niente spazi o simboli).");
        }
        const existing = this.findPlayerByName(ceoName);
        if (existing && existing.player.isConnected) {
            console.warn("[AUTH] Rejected: ceoName already connected", ceoName);
            throw new colyseus_1.ServerError(409, "Nome CEO giÃ  in uso in questa stanza.");
        }
        if (this.state.phase !== SharedTypes_1.GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== SharedTypes_1.GamePhase.PRE_LOBBY && !existing) {
            console.warn("[AUTH] Rejected: match already started and no reconnect slot for", ceoName);
            throw new colyseus_1.ServerError(403, "Partita giÃ  in corso. Puoi rientrare solo con un nome giÃ  presente.");
        }
        console.log("[AUTH] Accepted client", client.sessionId, "ceoName:", ceoName, "rejoinFrom:", existing?.sessionId ?? null);
        return { ceoName, rejoinFromSessionId: existing?.sessionId ?? null };
    }
    onJoin(client, options, auth) {
        console.log(`ðŸ‘¤ Player connected: ${client.sessionId}`);
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
        if (player) {
            player.isConnected = false;
        }
        console.log(`ðŸ‘‹ Player left: ${client.sessionId} (consented: ${consented})`);
        // Check if it's their turn. If so, start a 5s fallback to automatically skip
        // their turn so the game isn't completely paralyzed
        let skipTimeout = null;
        if (!consented && this.state.currentTurnPlayerId === client.sessionId && this.state.phase === SharedTypes_1.GamePhase.PLAYER_TURN) {
            console.log(`   â±ï¸  Active player disconnected. Waiting 5s before advancing turn...`);
            skipTimeout = this.clock.setTimeout(() => {
                const p = this.state.players.get(client.sessionId);
                if (p && !p.isConnected && this.state.currentTurnPlayerId === client.sessionId && this.state.phase === SharedTypes_1.GamePhase.PLAYER_TURN) {
                    console.log(`   â­ï¸  5s passed. Auto-skipping turn for disconnected player.`);
                    this.advanceTurn();
                }
            }, 5000);
        }
        if (consented) {
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
            }
            catch (e) {
                // Timeout di 30s scaduto, cancellare il giocatore definitivamente dallo State
                console.log(`   âŒ Timeout expired. Deleting player ${client.sessionId}.`);
                this.removePlayerPermanently(client.sessionId);
            }
        }
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Card Template Lookup
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            console.log(`ðŸ“š Loaded ${this.cardTemplates.size} card templates from cards_db.json`);
        }
    }
    getTemplate(templateId) {
        return this.cardTemplates.get(templateId);
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Game Start
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    handleJoinGame(client, _data) {
        if (this.state.phase !== SharedTypes_1.GamePhase.WAITING_FOR_PLAYERS && this.state.phase !== SharedTypes_1.GamePhase.PRE_LOBBY) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "GAME_ALREADY_STARTED", message: "Il gioco Ã¨ giÃ  iniziato." });
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
        players.forEach((sessionId) => {
            const participant = this.state.players.get(sessionId);
            if (!participant)
                return;
            while (participant.hand.length > 0)
                participant.hand.pop();
            while (participant.company.length > 0)
                participant.company.pop();
            while (participant.activeEffects.length > 0)
                participant.activeEffects.pop();
            participant.score = 0;
            participant.actionPoints = 0;
        });
        this.state.turnIndex = 0;
        this.state.currentTurnPlayerId = this.state.playerOrder.at(0) ?? "";
        this.state.turnNumber = 1;
        this.state.winnerId = undefined;
        this.state.pendingAction = null;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;
        if (this.reactionTimeout) {
            this.reactionTimeout.clear();
            this.reactionTimeout = null;
        }
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
        console.log(`ðŸƒ Deck ready: ${this.state.deckCount} cards`);
        // Assign a Party Leader to each participant (setup-only cards, outside main deck).
        this.assignPartyLeaders(players);
        this.monsterTemplateIds = (0, monsterBoard_1.collectMonsterTemplateIds)(this.cardTemplates.values());
        this.monsterBag = [];
        // Populate and keep central monsters at 3 slots.
        this.populateCentralCrises();
        // Deal an initial hand to keep the first turns fast and readable (casual mode).
        this.dealInitialHands(players, STARTING_HAND_SIZE);
        // Give PA to first active player
        const activePlayer = this.state.players.get(this.state.currentTurnPlayerId);
        if (activePlayer)
            activePlayer.actionPoints = SharedTypes_1.MAX_ACTION_POINTS;
        console.log(`ðŸŽ® Game started! First turn: ${this.state.currentTurnPlayerId} | starting hand: ${STARTING_HAND_SIZE}`);
        this.broadcast(SharedTypes_1.ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: SharedTypes_1.MAX_ACTION_POINTS
        });
    }
    assignPartyLeaders(participantIds) {
        const leaders = Array.from(this.cardTemplates.values()).filter((t) => {
            const type = String(t.type ?? "").trim().toLowerCase();
            return type === "party_leader" || type === "leader";
        });
        if (leaders.length === 0)
            return;
        for (let i = 0; i < participantIds.length; i++) {
            const playerId = participantIds[i];
            const player = this.state.players.get(playerId);
            if (!player)
                continue;
            const leader = leaders[i % leaders.length];
            const effects = player.activeEffects;
            const leaderTag = `party_leader_${leader.id}`;
            if (!effects.includes(leaderTag))
                effects.push(leaderTag);
            // Apply passive leader effects once at setup.
            try {
                CardEffectParser_1.CardEffectParser.resolve(leader, player, null, this.state);
            }
            catch (err) {
                console.warn("[ROOM] Failed to apply party leader effect:", leader.id, err);
            }
        }
    }
    populateCentralCrises() {
        while (this.state.centralCrises.length > 0) {
            this.state.centralCrises.pop();
        }
        this.refillCentralCrisesToThree();
    }
    refillCentralCrisesToThree() {
        if (this.monsterTemplateIds.length === 0) {
            this.monsterTemplateIds = (0, monsterBoard_1.collectMonsterTemplateIds)(this.cardTemplates.values());
        }
        const maxSlots = 3;
        while (this.state.centralCrises.length < maxSlots) {
            const templateId = (0, monsterBoard_1.drawMonsterTemplateId)(this.monsterBag, this.monsterTemplateIds);
            if (!templateId)
                break;
            const template = this.getTemplate(templateId);
            if (!template)
                continue;
            this.state.centralCrises.push((0, monsterBoard_1.createMonsterCardState)(template, () => this.generateId()));
        }
        console.log(`Central monsters on board: ${this.state.centralCrises.length}`);
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
        if (drawnCard.targetRoll !== undefined)
            card.targetRoll = drawnCard.targetRoll;
        if (drawnCard.modifier !== undefined)
            card.modifier = drawnCard.modifier;
        card.subtype = drawnCard.subtype ?? "none";
        if (drawnCard.shortDesc)
            card.shortDesc = drawnCard.shortDesc;
        const tmpl = this.getTemplate(drawnCard.templateId);
        if (tmpl) {
            card.name = tmpl.name;
            card.shortDesc = tmpl.shortDesc;
            card.description = tmpl.description;
            if (card.subtype === "none" && tmpl.subtype)
                card.subtype = tmpl.subtype;
            if (card.targetRoll === undefined && typeof tmpl.targetRoll === "number")
                card.targetRoll = tmpl.targetRoll;
            if (card.modifier === undefined && typeof tmpl.modifier === "number")
                card.modifier = tmpl.modifier;
        }
        return card;
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Turn Management
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    handleEndTurn(client) {
        if (client.sessionId !== this.state.currentTurnPlayerId) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "NOT_YOUR_TURN", message: "Non Ã¨ il tuo turno." });
            return;
        }
        if (this.state.phase !== SharedTypes_1.GamePhase.PLAYER_TURN) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "WRONG_PHASE", message: "La fase non lo consente." });
            return;
        }
        this.advanceTurn();
    }
    advanceTurn() {
        const next = (0, turnFlow_1.computeNextConnectedTurn)(this.state.playerOrder, this.state.turnIndex, (playerId) => Boolean(this.state.players.get(playerId)?.isConnected));
        if (!next) {
            this.state.currentTurnPlayerId = "";
            this.state.turnIndex = 0;
            this.state.phase = SharedTypes_1.GamePhase.WAITING_FOR_PLAYERS;
            return;
        }
        this.state.turnIndex = next.nextIndex;
        this.state.currentTurnPlayerId = next.nextPlayerId;
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
        console.log(`âž¡ï¸  Turn ${this.state.turnNumber}: ${this.state.currentTurnPlayerId}`);
        this.broadcast(SharedTypes_1.ServerEvents.TURN_STARTED, {
            playerId: this.state.currentTurnPlayerId,
            turnNumber: this.state.turnNumber,
            actionPoints: SharedTypes_1.MAX_ACTION_POINTS
        });
        this.checkWinConditions();
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  DRAW_CARD â€” uses DeckManager.drawCard
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    handleDrawCard(client) {
        if (!this.checkPlayerTurnAction(client, SharedTypes_1.DRAW_CARD_COST))
            return;
        const drawnCard = DeckManager_1.DeckManager.drawCard(this.serverDeck);
        if (!drawnCard) {
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "DECK_EMPTY", message: "Il mazzo Ã¨ vuoto." });
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
        console.log(`ðŸ“¥ DRAW_CARD by ${client.sessionId}. Deck left: ${this.state.deckCount}`);
        client.send(SharedTypes_1.ServerEvents.CARD_DRAWN, {
            card: drawnCard,
            remainingDeck: this.state.deckCount
        });
        this.checkWinConditions();
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  PLAY_EMPLOYEE â€” Reaction Window trigger
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non Ã¨ nella tua mano." });
            return;
        }
        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const typeValue = String(template?.type ?? cardInHand.type ?? "").trim().toLowerCase();
        if (typeValue !== "hero" && typeValue !== "employee") {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "NOT_HERO_CARD",
                message: "Puoi assumere solo carte Hero.",
            });
            return;
        }
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
        console.log(`ðŸƒ PLAY_EMPLOYEE by ${client.sessionId}: ${template?.name} (cost ${cost} PA). Window open.`);
        // Broadcast START_REACTION_TIMER so Phaser shows animated countdown
        this.broadcast(SharedTypes_1.ServerEvents.START_REACTION_TIMER, {
            durationMs: SharedTypes_1.REACTION_WINDOW_MS,
            actionTypeLabel: `Assunzione di "${template?.name ?? cardInHand.templateId}" in corso!`
        });
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  SOLVE_CRISIS â€” Reaction Window trigger
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        console.log(`ðŸ’¼ SOLVE_CRISIS by ${client.sessionId}: ${template?.name}. Window open.`);
        this.broadcast(SharedTypes_1.ServerEvents.START_REACTION_TIMER, {
            durationMs: SharedTypes_1.REACTION_WINDOW_MS,
            actionTypeLabel: `Risoluzione crisi "${template?.name ?? crisis.templateId}" in corso!`
        });
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  PLAY_MAGIC â€” immediate (no Reaction Window)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    handlePlayMagic(client, data) {
        const { cardId, targetPlayerId, targetHeroCardId } = data;
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
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non Ã¨ nella tua mano." });
            return;
        }
        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const typeValue = String(template?.type ?? cardInHand.type ?? "").trim().toLowerCase();
        const subtypeValue = String(template?.subtype ?? cardInHand.subtype ?? "").trim().toLowerCase();
        if (typeValue === "hero" || typeValue === "employee") {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "USE_PLAY_EMPLOYEE",
                message: "Le carte Hero si giocano con l'azione di assunzione.",
            });
            return;
        }
        if (typeValue === "challenge"
            || typeValue === "reaction"
            || typeValue === "modifier"
            || subtypeValue === "reaction"
            || subtypeValue === "modifier") {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "REACTION_ONLY_WINDOW",
                message: "Le carte Reazione possono essere giocate solo durante la finestra di reazione.",
            });
            return;
        }
        const allowedMagicLike = ["magic", "event", "trick", "item", "oggetto"];
        if (!allowedMagicLike.includes(typeValue)) {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
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
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "MISSING_TARGET",
                message: "Questa carta richiede di scegliere un bersaglio."
            });
            return;
        }
        if (needsTarget && targetPlayerId) {
            if (targetPlayerId === client.sessionId) {
                client.send(SharedTypes_1.ServerEvents.ERROR, { code: "SELF_TARGET", message: "Non puoi bersagliare te stesso." });
                return;
            }
            if (!this.state.players.has(targetPlayerId)) {
                client.send(SharedTypes_1.ServerEvents.ERROR, { code: "INVALID_TARGET", message: "Il giocatore bersaglio non esiste." });
                return;
            }
        }
        const isItemCard = typeValue === "item" || typeValue === "oggetto";
        let resolvedTargetHeroCardId = undefined;
        if (isItemCard) {
            const equipTarget = (0, itemEquip_1.resolveHeroEquipTarget)({
                player,
                targetHeroCardId,
                allowFallbackToPlayerLevel: false,
            });
            if (!equipTarget.ok) {
                client.send(SharedTypes_1.ServerEvents.ERROR, {
                    code: equipTarget.errorCode ?? "MISSING_HERO_TARGET",
                    message: equipTarget.errorMessage ?? "Seleziona un Hero valido per equipaggiare l'Item.",
                });
                return;
            }
            resolvedTargetHeroCardId = equipTarget.targetHero?.id;
        }
        const discountPlan = this.peekMagicDiscount(player, isItemCard);
        const effectiveCost = Math.max(0, baseCost - discountPlan.amount);
        if (!this.checkPlayerTurnAction(client, effectiveCost))
            return;
        if (discountPlan.amount > 0) {
            this.consumeMagicDiscount(player, discountPlan);
        }
        // Deduct PA and remove from hand immediately
        const removedCard = handArr.splice(cardIdx, 1)[0];
        // Populate pendingAction 
        const pending = new State_1.PendingActionState();
        pending.id = this.generateId();
        pending.playerId = client.sessionId;
        pending.actionType = SharedTypes_1.ClientMessages.PLAY_MAGIC;
        pending.targetCardId = cardInHand.templateId; // templateId for CardEffectParser
        pending.targetPlayerId = needsTarget ? targetPlayerId : undefined;
        pending.targetHeroCardId = resolvedTargetHeroCardId;
        pending.timestamp = Date.now();
        this.pendingRemovedCards.set(pending.id, this.cloneRuntimeCardData(removedCard));
        this.state.pendingAction = pending;
        this.state.phase = SharedTypes_1.GamePhase.REACTION_WINDOW;
        this.state.reactionEndTime = Date.now() + SharedTypes_1.REACTION_WINDOW_MS;
        this.state.actionStack = [pending];
        if (this.reactionTimeout)
            this.reactionTimeout.clear();
        this.reactionTimeout = this.clock.setTimeout(() => this.resolvePhase(), SharedTypes_1.REACTION_WINDOW_MS);
        console.log(`[PLAY_MAGIC] ${client.sessionId}: ${template?.name}. Window open. Cost ${baseCost} -> ${effectiveCost}`);
        this.broadcast(SharedTypes_1.ServerEvents.START_REACTION_TIMER, {
            durationMs: SharedTypes_1.REACTION_WINDOW_MS,
            actionTypeLabel: `Magheggio "${template?.name ?? cardInHand.templateId}" in corso!`
        });
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  PLAY_REACTION â€” enqueue into action stack
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            client.send(SharedTypes_1.ServerEvents.ERROR, { code: "CARD_NOT_IN_HAND", message: "La carta non Ã¨ nella tua mano." });
            return;
        }
        const cardInHand = handArr[cardIdx];
        const template = this.getTemplate(cardInHand.templateId);
        const typeValue = String(template?.type ?? cardInHand.type ?? "").trim().toLowerCase();
        const subtypeValue = String(cardInHand?.subtype ?? template?.subtype ?? "").trim().toLowerCase();
        const isReactionCard = subtypeValue === "reaction"
            || subtypeValue === "modifier"
            || typeValue === "challenge"
            || typeValue === "reaction"
            || typeValue === "modifier";
        if (!isReactionCard) {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: "NOT_REACTION_CARD",
                message: "Questa carta non e una Reazione valida.",
            });
            return;
        }
        // Reazioni/Modifier non consumano PA nel modello Here-to-Slay Lite.
        handArr.splice(cardIdx, 1);
        // Create IPendingAction for this reaction and push onto stack (LIFO top)
        const reactionPending = {
            id: this.generateId(),
            playerId: client.sessionId,
            actionType: SharedTypes_1.ClientMessages.PLAY_REACTION,
            targetCardId: cardInHand.templateId, // reaction card's templateId for CardEffectParser
            targetPlayerId: this.state.pendingAction?.playerId ?? undefined,
            timestamp: Date.now(),
            isCancelled: false
        };
        // Push BEFORE original action so stack[0] = newest reaction (LIFO)
        this.state.actionStack.unshift(reactionPending);
        console.log(`ðŸ—¡ï¸  PLAY_REACTION by ${client.sessionId}: ${template?.name} queued (stack depth: ${this.state.actionStack.length})`);
        this.broadcast(SharedTypes_1.ServerEvents.REACTION_TRIGGERED, {
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
    resolvePhase() {
        this.state.phase = SharedTypes_1.GamePhase.RESOLUTION;
        console.log(`Reaction Window closed. Resolving stack of ${this.state.actionStack.length} action(s)...`);
        const resolution = (0, reactionResolution_1.resolveReactionQueue)(this.state);
        const originalAction = resolution.originalAction;
        let structuralSuccess = !originalAction?.isCancelled;
        let magicResolution = null;
        let crisisSummary = null;
        if (originalAction && !originalAction.isCancelled) {
            switch (originalAction.actionType) {
                case SharedTypes_1.ClientMessages.PLAY_EMPLOYEE:
                    this.applyEmployeeHire(originalAction.playerId, originalAction.targetCardId);
                    structuralSuccess = true;
                    break;
                case SharedTypes_1.ClientMessages.SOLVE_CRISIS:
                    crisisSummary = this.applyCrisisResolution(originalAction.playerId, originalAction.targetCrisisId);
                    structuralSuccess = crisisSummary.success;
                    break;
                case SharedTypes_1.ClientMessages.PLAY_MAGIC:
                    magicResolution = this.applyMagicResolution(originalAction);
                    structuralSuccess = magicResolution.success;
                    if (!magicResolution.success && magicResolution.restoreCardToHand) {
                        this.restorePendingCardToHand(originalAction.id, originalAction.playerId);
                    }
                    break;
                default:
                    structuralSuccess = true;
                    break;
            }
        }
        const drawnCards = (0, reactionResolution_1.consumePendingDrawTags)(this.state, () => DeckManager_1.DeckManager.drawCard(this.serverDeck), (card) => this.createCardStateFromDeckCard(card));
        if (drawnCards > 0) {
            this.state.deckCount = this.serverDeck.length;
        }
        const success = resolution.parserSuccess && structuralSuccess;
        const log = resolution.log.length > 0
            ? [...resolution.log]
            : (success ? [`Azione originale eseguita con successo.`] : [`Azione annullata.`]);
        if (originalAction && originalAction.actionType === SharedTypes_1.ClientMessages.SOLVE_CRISIS && !originalAction.isCancelled) {
            log.push(success
                ? "Imprevisto risolto con successo."
                : "Tentativo di risoluzione Imprevisto fallito.");
        }
        if (originalAction && originalAction.actionType === SharedTypes_1.ClientMessages.PLAY_MAGIC && magicResolution?.message) {
            log.push(magicResolution.message);
        }
        this.broadcast(SharedTypes_1.ServerEvents.ACTION_RESOLVED, { success, log });
        if (originalAction?.id) {
            this.pendingRemovedCards.delete(originalAction.id);
        }
        this.state.pendingAction = null;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;
        this.reactionTimeout = null;
        this.state.phase = SharedTypes_1.GamePhase.PLAYER_TURN;
        console.log(`Resolution complete. Restored PLAYER_TURN.`);
        this.checkWinConditions();
    }
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
        companyCard.type = SharedTypes_1.CardType.HERO;
        companyCard.costPA = template.cost;
        companyCard.isFaceUp = true;
        companyCard.name = template.name;
        companyCard.shortDesc = template.shortDesc;
        companyCard.description = template.description;
        player.company.push(companyCard);
        console.log(`   ðŸ‘” ${player.username} hired ${template.name}. Company size: ${player.company.length}`);
    }
    /**
     * Server-authoritative crisis resolution:
     * - Roll 2d6 (+ modifiers)
     * - Broadcast DICE_ROLLED
     * - On success: reward + remove crisis
     * - On fail: apply crisis penalty
     */
    applyMagicResolution(action) {
        const player = this.state.players.get(action.playerId);
        if (!player)
            return { success: false, restoreCardToHand: false, message: "Azione annullata: giocatore non trovato." };
        if (!action.targetCardId)
            return { success: true, restoreCardToHand: false };
        const template = this.getTemplate(action.targetCardId);
        if (!template) {
            return {
                success: false,
                restoreCardToHand: true,
                message: "Carta non risolta: template non trovato. Carta restituita in mano.",
            };
        }
        const typeValue = String(template.type ?? "").trim().toLowerCase();
        if (typeValue !== "item" && typeValue !== "oggetto") {
            return { success: true, restoreCardToHand: false };
        }
        const equipTarget = (0, itemEquip_1.resolveHeroEquipTarget)({
            player,
            targetHeroCardId: action.targetHeroCardId,
            allowFallbackToPlayerLevel: false,
        });
        if (!equipTarget.ok || !equipTarget.targetHero) {
            return {
                success: false,
                restoreCardToHand: true,
                message: "Item annullato: Hero bersaglio non valido. Carta restituita in mano.",
            };
        }
        const itemCard = (0, itemEquip_1.createItemCardForEquip)(template, () => this.generateId());
        const equipped = (0, itemEquip_1.equipItemOnHero)(equipTarget.targetHero, itemCard);
        if (!equipped) {
            return {
                success: false,
                restoreCardToHand: true,
                message: "Item annullato: equip fallito. Carta restituita in mano.",
            };
        }
        return { success: true, restoreCardToHand: false };
    }
    applyCrisisResolution(playerId, crisisId) {
        const player = this.state.players.get(playerId);
        if (!player)
            return { success: false };
        const crisisArr = this.state.centralCrises;
        const idx = crisisArr.findIndex((c) => c.id === crisisId);
        if (idx === -1)
            return { success: false };
        const crisis = crisisArr[idx];
        const template = this.getTemplate(crisis.templateId);
        const targetRoll = typeof crisis.targetRoll === "number"
            ? crisis.targetRoll
            : (typeof template?.targetRoll === "number" ? template.targetRoll : 7);
        const rewardCode = typeof template?.effect?.reward === "string" ? template.effect.reward : undefined;
        const penaltyCode = typeof template?.effect?.penalty === "string" ? template.effect.penalty : undefined;
        const modifier = this.getCrisisRollModifier(playerId) + (typeof crisis.modifier === "number" ? crisis.modifier : 0);
        const roll = (0, monsterBoard_1.rollCrisisAttempt)(targetRoll, modifier);
        this.broadcast(SharedTypes_1.ServerEvents.DICE_ROLLED, {
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
            }
            else {
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
    getCrisisRollModifier(playerId) {
        const player = this.state.players.get(playerId);
        if (!player)
            return 0;
        let bonus = 0;
        const company = player.company;
        for (const employee of company) {
            const equippedItems = (employee?.equippedItems ?? []);
            for (const item of equippedItems) {
                if (typeof item?.modifier === "number") {
                    bonus += item.modifier;
                }
            }
        }
        const effects = player.activeEffects;
        for (let i = effects.length - 1; i >= 0; i--) {
            const tag = effects[i];
            if (typeof tag !== "string")
                continue;
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
    applyCrisisPenalty(rawPenalty, solverPlayerId) {
        const penalty = typeof rawPenalty === "string" ? rawPenalty : "";
        if (!penalty)
            return;
        const victims = Array.from(this.state.players.entries())
            .filter(([sessionId]) => sessionId !== solverPlayerId)
            .map(([, p]) => p);
        for (const victim of victims) {
            switch (penalty) {
                case "discard_2":
                    for (let i = 0; i < 2; i++) {
                        const hand = victim.hand;
                        if (hand.length === 0)
                            break;
                        hand.splice(Math.floor(Math.random() * hand.length), 1);
                    }
                    break;
                case "lose_employee":
                    if (victim.company.length > 0) {
                        victim.company.pop();
                    }
                    break;
                case "lock_tricks": {
                    const effects = victim.activeEffects;
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
    checkWinConditions() {
        if (this.state.phase === SharedTypes_1.GamePhase.GAME_OVER)
            return;
        for (const [sessionId, player] of this.state.players) {
            const evaluation = (0, winConditions_1.evaluatePlayerWin)(player, WIN_EMPLOYEES, WIN_CRISES);
            if (!evaluation.won)
                continue;
            this.state.winnerId = sessionId;
            this.state.phase = SharedTypes_1.GamePhase.GAME_OVER;
            this.broadcast(SharedTypes_1.ServerEvents.GAME_WON, {
                winnerId: player.sessionId,
                winnerName: player.username,
                finalScore: player.score,
            });
            console.log(`GAME OVER! Winner: ${player.username} (weighted employees: ${evaluation.weightedEmployeeCount}, crisisVP: ${evaluation.crisisVP})`);
            return;
        }
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Triple Validation Helper
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    checkPlayerTurnAction(client, requiredPA) {
        const player = this.state.players.get(client.sessionId);
        const validation = (0, turnFlow_1.validateAndSpendTurnAction)({
            phase: this.state.phase,
            currentTurnPlayerId: this.state.currentTurnPlayerId,
            requesterPlayerId: client.sessionId,
            requiredPA,
            player,
        });
        if (!validation.ok) {
            client.send(SharedTypes_1.ServerEvents.ERROR, {
                code: validation.code ?? "ACTION_DENIED",
                message: validation.message ?? "Azione non consentita.",
            });
            return false;
        }
        return true;
    }
    peekMagicDiscount(player, isItemCard) {
        if (isItemCard)
            return { amount: 0, sourceTag: null };
        const effects = player.activeEffects;
        let bestAmount = 0;
        let bestTag = null;
        for (const tag of effects) {
            if (typeof tag !== "string")
                continue;
            if (!tag.startsWith("discount_magic_") && !tag.startsWith("discount_trick_"))
                continue;
            const raw = tag.startsWith("discount_magic_")
                ? tag.replace("discount_magic_", "")
                : tag.replace("discount_trick_", "");
            const parsed = parseInt(raw, 10);
            if (!Number.isFinite(parsed) || parsed <= 0)
                continue;
            if (parsed > bestAmount) {
                bestAmount = parsed;
                bestTag = tag;
            }
        }
        return { amount: bestAmount, sourceTag: bestTag };
    }
    consumeMagicDiscount(player, plan) {
        if (!plan.sourceTag || plan.amount <= 0)
            return;
        const effects = player.activeEffects;
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
    cloneRuntimeCardData(card) {
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
    restorePendingCardToHand(pendingId, playerId) {
        const player = this.state.players.get(playerId);
        if (!player)
            return false;
        const hand = player.hand;
        const cached = this.pendingRemovedCards.get(pendingId);
        const fallbackTemplateId = this.state.pendingAction?.targetCardId;
        const templateId = cached?.templateId ?? fallbackTemplateId;
        if (!templateId)
            return false;
        const runtimeId = cached?.id ?? this.generateId();
        if (hand.some((card) => String(card.id) === String(runtimeId))) {
            return false;
        }
        const restored = this.createCardStateFromDeckCard({
            id: runtimeId,
            templateId,
            type: cached?.type ?? SharedTypes_1.CardType.MAGIC,
            costPA: cached?.costPA,
            isFaceUp: false,
            targetRoll: cached?.targetRoll,
            modifier: cached?.modifier,
            subtype: cached?.subtype,
            shortDesc: cached?.shortDesc,
        });
        hand.push(restored);
        this.pendingRemovedCards.delete(pendingId);
        return true;
    }
    removePlayerPermanently(sessionId) {
        this.cleanupPendingForRemovedPlayer(sessionId);
        this.state.players.delete(sessionId);
        const orderIndex = this.state.playerOrder.indexOf(sessionId);
        if (orderIndex !== -1)
            this.state.playerOrder.splice(orderIndex, 1);
        if (this.state.hostSessionId === sessionId) {
            this.assignNextHost();
        }
        if (this.state.currentTurnPlayerId === sessionId) {
            if (this.state.playerOrder.length > 0 && this.state.phase === SharedTypes_1.GamePhase.PLAYER_TURN) {
                this.advanceTurn();
            }
            else if (this.state.playerOrder.length === 0) {
                this.state.currentTurnPlayerId = "";
                this.state.turnIndex = 0;
                this.state.phase = SharedTypes_1.GamePhase.WAITING_FOR_PLAYERS;
            }
            else {
                this.state.currentTurnPlayerId = this.state.playerOrder[this.state.turnIndex] ?? "";
            }
        }
    }
    cleanupPendingForRemovedPlayer(sessionId) {
        const pending = this.state.pendingAction;
        const inReactionFlow = this.state.phase === SharedTypes_1.GamePhase.REACTION_WINDOW || this.state.phase === SharedTypes_1.GamePhase.RESOLUTION;
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
        this.state.pendingAction = null;
        this.state.actionStack = [];
        this.state.reactionEndTime = 0;
        if (inReactionFlow) {
            this.state.phase = SharedTypes_1.GamePhase.PLAYER_TURN;
            this.broadcast(SharedTypes_1.ServerEvents.ACTION_RESOLVED, {
                success: false,
                log: ["Azione annullata: giocatore disconnesso."],
            });
        }
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  Misc
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    handleEmote(client, data) {
        console.log(`ðŸ’¬ Emote from ${client.sessionId}: ${data?.emoteId}`);
        this.broadcast(SharedTypes_1.ServerEvents.EMOTE, { playerId: client.sessionId, emoteId: data?.emoteId });
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