/**
 * File: SharedTypes.ts
 * Scopo: Definizione dei "Network Contracts" tra Frontend (Phaser) e Backend (Colyseus).
 * Contiene interfacce, Enumeratori di messaggi, Tipi di carte e Strutture Dati.
 */
/**
 * Opzioni inviate dal Client al Server durante la richiesta di join.
 * Es: colyseus.joinOrCreate("office_room", JoinOptions)
 */
export interface JoinOptions {
    ceoName: string;
}
/** Punti Azione massimi concessi ad ogni giocatore all'inizio del proprio turno */
export declare const MAX_ACTION_POINTS = 3;
/** Costo in PA dell'azione "Pescare una carta" */
export declare const DRAW_CARD_COST = 1;
/** Durata della Reaction Window in millisecondi */
export declare const REACTION_WINDOW_MS = 5000;
/** Fasi principali della partita gestite dalla Macchina a Stati del Server */
export declare enum GamePhase {
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
    PLAYER_TURN = "PLAYER_TURN",
    REACTION_WINDOW = "REACTION_WINDOW",// Finestra di 5 secondi per reazioni
    RESOLUTION = "RESOLUTION",// Risoluzione degli effetti in coda
    GAME_OVER = "GAME_OVER"
}
/** Tipi di Messaggio dal Client al Server. Il Server risponderà modificando lo Stato o inviando Errori. */
export declare enum ClientMessages {
    JOIN_GAME = "JOIN_GAME",
    DRAW_CARD = "DRAW_CARD",
    PLAY_EMPLOYEE = "PLAY_EMPLOYEE",// Assumere dipendente (Triggera Reaction)
    PLAY_MAGIC = "PLAY_MAGIC",// Magheggio immediato
    SOLVE_CRISIS = "SOLVE_CRISIS",// Risolvere crisi (Triggera Reaction)
    PLAY_REACTION = "PLAY_REACTION",// Giocato durante la Reaction Window dagli avversari
    END_TURN = "END_TURN",
    EMOTE = "EMOTE"
}
/** Tipi di Messaggio (Eventi) dritti dal Server al Client per triggerare effetti UI */
export declare enum ServerEvents {
    ERROR = "ERROR",// Es. "Non hai abbastanza PA"
    CARD_DRAWN = "CARD_DRAWN",// Animazione pescata (payload: ICardData per il proprietario)
    TURN_STARTED = "TURN_STARTED",// Notifica a tutti: è iniziato il turno di X
    PA_UPDATED = "PA_UPDATED",// Feedback rapido post-azione con i PA rimanenti
    REACTION_TRIGGERED = "REACTION_TRIGGERED",// Qualcuno ha giocato una carta Reazione
    ACTION_RESOLVED = "ACTION_RESOLVED",// L'azione pendente ha avuto successo o è stata annullata
    DICE_ROLLED = "DICE_ROLLED"
}
/** Payload inviato dal Client con DRAW_CARD (attualmente vuoto, il server sa chi manda) */
export interface IDrawCardPayload {
}
/** Payload inviato dal Client con END_TURN */
export interface IEndTurnPayload {
}
/** Payload inviato dal Server con CARD_DRAWN (solo al proprietario) */
export interface ICardDrawnEvent {
    card: ICardData;
    remainingDeck: number;
}
/** Payload inviato dal Server con TURN_STARTED (broadcast a tutti) */
export interface ITurnStartedEvent {
    playerId: string;
    turnNumber: number;
    actionPoints: number;
}
/** Payload inviato dal Server con ERROR */
export interface IErrorEvent {
    code: string;
    message: string;
}
export declare enum CardType {
    EMPLOYEE = "EMPLOYEE",
    MAGIC = "MAGIC",
    CRISIS = "CRISIS",
    REACTION = "REACTION"
}
/** Dati essenziali pubblici di una carta in gioco */
export interface ICardData {
    id: string;
    templateId: string;
    type: CardType;
    costPA?: number;
    isFaceUp?: boolean;
}
/** Stato del singolo Giocatore */
export interface IPlayer {
    sessionId: string;
    username: string;
    isReady: boolean;
    isConnected: boolean;
    actionPoints: number;
    hand: ICardData[];
    company: ICardData[];
    score: number;
}
/**
 * Contesto dell'Azione in Sospeso
 * Se un giocatore tenta un'azione criticata da REACTION_WINDOW, il server salva qui l'intenzione.
 */
export interface IPendingAction {
    playerId: string;
    actionType: ClientMessages;
    targetCardId?: string;
    targetCrisisId?: string;
    timestamp: number;
}
/** Lo Stato Globale della Room (Sincronizzato a tutti i Client) */
export interface IGameState {
    phase: GamePhase;
    players: Map<string, IPlayer>;
    playerOrder: string[];
    currentTurnPlayerId: string;
    turnIndex: number;
    centralCrises: ICardData[];
    deckCount: number;
    pendingAction: IPendingAction | null;
    reactionEndTime: number;
    turnNumber: number;
}
//# sourceMappingURL=SharedTypes.d.ts.map