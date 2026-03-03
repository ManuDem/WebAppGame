/**
 * File: SharedTypes.ts
 * Scopo: Definizione dei "Network Contracts" tra Frontend (Phaser) e Backend (Colyseus).
 * Contiene interfacce, Enumeratori di messaggi, Tipi di carte e Strutture Dati.
 */

// -------------------------------------------------------------------------
// OPZIONI DI CONNESSIONE E LOBBY
// -------------------------------------------------------------------------

/** 
 * Opzioni inviate dal Client al Server durante la richiesta di join.
 * Es: colyseus.joinOrCreate("office_room", JoinOptions)
 */
export interface JoinOptions {
    ceoName: string; // Il nome "CEO" o dell'azienda scelto dal giocatore all'ingresso
}

// -------------------------------------------------------------------------
// COSTANTI DI GIOCO
// -------------------------------------------------------------------------

/** Punti Azione massimi concessi ad ogni giocatore all'inizio del proprio turno */
export const MAX_ACTION_POINTS = 3;

/** Costo in PA dell'azione "Pescare una carta" */
export const DRAW_CARD_COST = 1;

/** Durata della Reaction Window in millisecondi */
export const REACTION_WINDOW_MS = 5000;

// -------------------------------------------------------------------------
// ENUMERATORI DI COMUNICAZIONE E FASI
// -------------------------------------------------------------------------

/** Fasi principali della partita gestite dalla Macchina a Stati del Server */
export enum GamePhase {
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
    PLAYER_TURN = "PLAYER_TURN",
    REACTION_WINDOW = "REACTION_WINDOW", // Finestra di 5 secondi per reazioni
    RESOLUTION = "RESOLUTION",           // Risoluzione degli effetti in coda
    GAME_OVER = "GAME_OVER"
}

/** Tipi di Messaggio dal Client al Server. Il Server risponderà modificando lo Stato o inviando Errori. */
export enum ClientMessages {
    JOIN_GAME = "JOIN_GAME",
    DRAW_CARD = "DRAW_CARD",
    PLAY_EMPLOYEE = "PLAY_EMPLOYEE",     // Assumere dipendente (Triggera Reaction)
    PLAY_MAGIC = "PLAY_MAGIC",           // Magheggio immediato
    SOLVE_CRISIS = "SOLVE_CRISIS",       // Risolvere crisi (Triggera Reaction)
    PLAY_REACTION = "PLAY_REACTION",     // Giocato durante la Reaction Window dagli avversari
    END_TURN = "END_TURN",
    EMOTE = "EMOTE"                      // Eventuali interazioni non-gameplay (BMing)
}

/** Tipi di Messaggio (Eventi) dritti dal Server al Client per triggerare effetti UI */
export enum ServerEvents {
    ERROR = "ERROR",                     // Es. "Non hai abbastanza PA"
    CARD_DRAWN = "CARD_DRAWN",           // Animazione pescata (payload: ICardData per il proprietario)
    TURN_STARTED = "TURN_STARTED",       // Notifica a tutti: è iniziato il turno di X
    PA_UPDATED = "PA_UPDATED",           // Feedback rapido post-azione con i PA rimanenti
    REACTION_TRIGGERED = "REACTION_TRIGGERED", // Qualcuno ha giocato una carta Reazione
    ACTION_RESOLVED = "ACTION_RESOLVED", // L'azione pendente ha avuto successo o è stata annullata
    DICE_ROLLED = "DICE_ROLLED"          // Risultato di un RNG per mostrare il dado in 3D/2D
}

// -------------------------------------------------------------------------
// PAYLOAD DEI MESSAGGI (Strutture dei dati inviati con i Messaggi)
// -------------------------------------------------------------------------

/** Payload inviato dal Client con DRAW_CARD (attualmente vuoto, il server sa chi manda) */
export interface IDrawCardPayload {
    // Nessun dato richiesto: il server identifica il mittente dal sessionId
}

/** Payload inviato dal Client con END_TURN */
export interface IEndTurnPayload {
    // Nessun dato richiesto: il server avanza al prossimo giocatore
}

/** Payload inviato dal Server con CARD_DRAWN (solo al proprietario) */
export interface ICardDrawnEvent {
    card: ICardData;         // La carta pescata (visibile solo al proprietario)
    remainingDeck: number;   // Carte rimanenti nel mazzo
}

/** Payload inviato dal Server con TURN_STARTED (broadcast a tutti) */
export interface ITurnStartedEvent {
    playerId: string;        // SessionId del giocatore di turno
    turnNumber: number;      // Numero del turno corrente
    actionPoints: number;    // PA assegnati (sempre MAX_ACTION_POINTS)
}

/** Payload inviato dal Server con ERROR */
export interface IErrorEvent {
    code: string;            // Codice errore macchina (es. "NOT_YOUR_TURN", "NO_PA")
    message: string;         // Messaggio leggibile dall'utente
}

// -------------------------------------------------------------------------
// STRUTTURE DATI DI BASE (Riflettono logicamente il DB Locale)
// -------------------------------------------------------------------------

export enum CardType {
    EMPLOYEE = "EMPLOYEE",
    MAGIC = "MAGIC",
    CRISIS = "CRISIS",
    REACTION = "REACTION"
}

/** Dati essenziali pubblici di una carta in gioco */
export interface ICardData {
    id: string;              // UUID in-game della singola carta istanziata
    templateId: string;      // ID dal cards_db.json (es. "emp_01")
    type: CardType;          // Tipo della carta
    costPA?: number;         // Costo in Punti Azione
    isFaceUp?: boolean;      // Per sapere se è visibile agli altri
}

// -------------------------------------------------------------------------
// INTERFACCE DELLO STATO (I contratti per lo Schema Colyseus)
// -------------------------------------------------------------------------

/** Stato del singolo Giocatore */
export interface IPlayer {
    sessionId: string;
    username: string;
    isReady: boolean;
    isConnected: boolean;

    actionPoints: number;    // PA Rimanenti in questo turno (max 3 base)

    // Le carte. 'hand' potrebbe essere mascherata dal server (ArraySchema Colyseus o Schema Array)
    hand: ICardData[];
    company: ICardData[];    // I Dipendenti assunti nell'Area Personale (Pubblici)

    score: number;           // Dipendenti unici o Crisi risolte
}

/** 
 * Contesto dell'Azione in Sospeso 
 * Se un giocatore tenta un'azione criticata da REACTION_WINDOW, il server salva qui l'intenzione.
 */
export interface IPendingAction {
    playerId: string;        // Chi sta eseguendo l'azione
    actionType: ClientMessages; // Che tipo di azione (PLAY_EMPLOYEE, SOLVE_CRISIS)
    targetCardId?: string;   // Se stava giocando una carta, quale?
    targetCrisisId?: string; // Se stava risolvendo una crisi, quale?
    timestamp: number;       // Quando è iniziata la finestra
}

/** Lo Stato Globale della Room (Sincronizzato a tutti i Client) */
export interface IGameState {
    phase: GamePhase;
    players: Map<string, IPlayer>;     // Map<sessionId, PlayerState>
    playerOrder: string[];             // Array di SessionId per determinare l'ordine dei turni
    currentTurnPlayerId: string;       // Chi è di turno ora
    turnIndex: number;                 // Indice corrente nell'array playerOrder (round-robin)

    centralCrises: ICardData[];        // Crisi pubbliche a centro tavola (max 3)
    deckCount: number;                 // Quante carte rimangono nel mazzo principale

    // Gestione Reaction Window
    pendingAction: IPendingAction | null;
    reactionEndTime: number;           // Timestamp (ms) in cui la finestra si chiude e l'azione si risolve

    turnNumber: number;                // Contatore globale dei turni completati
}
