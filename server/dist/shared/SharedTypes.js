"use strict";
/**
 * File: SharedTypes.ts
 * Scopo: Definizione dei "Network Contracts" tra Frontend (Phaser) e Backend (Colyseus).
 * Contiene interfacce, Enumeratori di messaggi, Tipi di carte e Strutture Dati.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardType = exports.DropZoneArea = exports.ServerEvents = exports.ClientMessages = exports.GamePhase = exports.REACTION_WINDOW_MS = exports.MIN_PLAYERS_TO_START = exports.DRAW_CARD_COST = exports.MAX_ACTION_POINTS = void 0;
// -------------------------------------------------------------------------
// COSTANTI DI GIOCO
// -------------------------------------------------------------------------
/** Punti Azione massimi concessi ad ogni giocatore all'inizio del proprio turno */
exports.MAX_ACTION_POINTS = 3;
/** Costo in PA dell'azione "Pescare una carta" */
exports.DRAW_CARD_COST = 1;
/** Numero minimo di giocatori pronti per avviare la partita */
exports.MIN_PLAYERS_TO_START = 2;
/** Durata della Reaction Window in millisecondi */
exports.REACTION_WINDOW_MS = 5000;
// -------------------------------------------------------------------------
// ENUMERATORI DI COMUNICAZIONE E FASI
// -------------------------------------------------------------------------
/** Fasi principali della partita gestite dalla Macchina a Stati del Server */
var GamePhase;
(function (GamePhase) {
    GamePhase["PRE_LOBBY"] = "PRE_LOBBY";
    GamePhase["WAITING_FOR_PLAYERS"] = "WAITING_FOR_PLAYERS";
    GamePhase["PLAYER_TURN"] = "PLAYER_TURN";
    GamePhase["REACTION_WINDOW"] = "REACTION_WINDOW";
    GamePhase["RESOLUTION"] = "RESOLUTION";
    GamePhase["GAME_OVER"] = "GAME_OVER";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
/** Tipi di Messaggio dal Client al Server. Il Server risponderà modificando lo Stato o inviando Errori. */
var ClientMessages;
(function (ClientMessages) {
    ClientMessages["JOIN_GAME"] = "JOIN_GAME";
    ClientMessages["START_MATCH"] = "START_MATCH";
    ClientMessages["DRAW_CARD"] = "DRAW_CARD";
    ClientMessages["PLAY_EMPLOYEE"] = "PLAY_EMPLOYEE";
    ClientMessages["PLAY_MAGIC"] = "PLAY_MAGIC";
    ClientMessages["SOLVE_CRISIS"] = "SOLVE_CRISIS";
    ClientMessages["PLAY_REACTION"] = "PLAY_REACTION";
    ClientMessages["ROLL_DICE"] = "ROLL_DICE";
    ClientMessages["END_TURN"] = "END_TURN";
    ClientMessages["EMOTE"] = "EMOTE"; // Eventuali interazioni non-gameplay (BMing)
})(ClientMessages || (exports.ClientMessages = ClientMessages = {}));
/** Tipi di Messaggio (Eventi) dritti dal Server al Client per triggerare effetti UI */
var ServerEvents;
(function (ServerEvents) {
    ServerEvents["ERROR"] = "ERROR";
    ServerEvents["CARD_DRAWN"] = "CARD_DRAWN";
    ServerEvents["TURN_STARTED"] = "TURN_STARTED";
    ServerEvents["PA_UPDATED"] = "PA_UPDATED";
    ServerEvents["REACTION_TRIGGERED"] = "REACTION_TRIGGERED";
    ServerEvents["ACTION_RESOLVED"] = "ACTION_RESOLVED";
    ServerEvents["DICE_ROLLED"] = "DICE_ROLLED";
    // -- Eventi Puramente Visivi per la Visual Queue (Miglioramenti UI) --
    ServerEvents["SHOW_ANIMATION"] = "SHOW_ANIMATION";
    ServerEvents["TRIGGER_PARTICLES"] = "TRIGGER_PARTICLES";
    ServerEvents["START_REACTION_TIMER"] = "START_REACTION_TIMER";
    ServerEvents["GAME_WON"] = "GAME_WON";
    // -- Visual Juice Protocol Trigger --
    ServerEvents["VFX_SHAKE"] = "VFX_SHAKE";
    ServerEvents["VFX_CONFIDENZA"] = "VFX_CONFIDENZA";
    ServerEvents["UI_FEEDBACK_DENIED"] = "UI_FEEDBACK_DENIED"; // Animazione di scossa/errore sui bottoni
})(ServerEvents || (exports.ServerEvents = ServerEvents = {}));
// -------------------------------------------------------------------------
// REGOLE DI INTERAZIONE VISIVA (DRAG & DROP)
// -------------------------------------------------------------------------
/**
 * Zone di impatto (Drop) logiche e agnostiche rispetto alla risoluzione in pixel.
 * Il Frontend invierà l'intenzione al server basandosi sull'area logica in cui la carta viene rilasciata.
 */
var DropZoneArea;
(function (DropZoneArea) {
    DropZoneArea["CENTER_TABLE"] = "CENTER_TABLE";
    DropZoneArea["OPPONENT_TERRITORY"] = "OPPONENT_TERRITORY";
    DropZoneArea["DECK_AREA"] = "DECK_AREA";
    DropZoneArea["HAND"] = "HAND"; // Per annullare un drag&drop e resettare la UI
})(DropZoneArea || (exports.DropZoneArea = DropZoneArea = {}));
// -------------------------------------------------------------------------
// STRUTTURE DATI DI BASE (Riflettono logicamente il DB Locale)
// -------------------------------------------------------------------------
var CardType;
(function (CardType) {
    // Modello target Here-to-Slay Lite (5+2)
    CardType["HERO"] = "hero";
    CardType["ITEM"] = "item";
    CardType["MAGIC"] = "magic";
    CardType["MODIFIER"] = "modifier";
    CardType["CHALLENGE"] = "challenge";
    CardType["MONSTER"] = "monster";
    CardType["PARTY_LEADER"] = "party_leader";
    // Alias legacy (compat retroattiva durante la migrazione)
    CardType["EMPLOYEE"] = "hero";
    CardType["IMPREVISTO"] = "monster";
    CardType["OGGETTO"] = "item";
    CardType["EVENTO"] = "magic";
    CardType["CRISIS"] = "monster";
    CardType["REACTION"] = "challenge";
})(CardType || (exports.CardType = CardType = {}));
//# sourceMappingURL=SharedTypes.js.map