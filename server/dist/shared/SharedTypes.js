"use strict";
/**
 * File: SharedTypes.ts
 * Scopo: Definizione dei "Network Contracts" tra Frontend (Phaser) e Backend (Colyseus).
 * Contiene interfacce, Enumeratori di messaggi, Tipi di carte e Strutture Dati.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardType = exports.ServerEvents = exports.ClientMessages = exports.GamePhase = exports.REACTION_WINDOW_MS = exports.DRAW_CARD_COST = exports.MAX_ACTION_POINTS = void 0;
// -------------------------------------------------------------------------
// COSTANTI DI GIOCO
// -------------------------------------------------------------------------
/** Punti Azione massimi concessi ad ogni giocatore all'inizio del proprio turno */
exports.MAX_ACTION_POINTS = 3;
/** Costo in PA dell'azione "Pescare una carta" */
exports.DRAW_CARD_COST = 1;
/** Durata della Reaction Window in millisecondi */
exports.REACTION_WINDOW_MS = 5000;
// -------------------------------------------------------------------------
// ENUMERATORI DI COMUNICAZIONE E FASI
// -------------------------------------------------------------------------
/** Fasi principali della partita gestite dalla Macchina a Stati del Server */
var GamePhase;
(function (GamePhase) {
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
    ClientMessages["DRAW_CARD"] = "DRAW_CARD";
    ClientMessages["PLAY_EMPLOYEE"] = "PLAY_EMPLOYEE";
    ClientMessages["PLAY_MAGIC"] = "PLAY_MAGIC";
    ClientMessages["SOLVE_CRISIS"] = "SOLVE_CRISIS";
    ClientMessages["PLAY_REACTION"] = "PLAY_REACTION";
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
    ServerEvents["DICE_ROLLED"] = "DICE_ROLLED"; // Risultato di un RNG per mostrare il dado in 3D/2D
})(ServerEvents || (exports.ServerEvents = ServerEvents = {}));
// -------------------------------------------------------------------------
// STRUTTURE DATI DI BASE (Riflettono logicamente il DB Locale)
// -------------------------------------------------------------------------
var CardType;
(function (CardType) {
    CardType["EMPLOYEE"] = "EMPLOYEE";
    CardType["MAGIC"] = "MAGIC";
    CardType["CRISIS"] = "CRISIS";
    CardType["REACTION"] = "REACTION";
})(CardType || (exports.CardType = CardType = {}));
//# sourceMappingURL=SharedTypes.js.map