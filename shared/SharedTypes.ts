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
    roomCode: string; // Codice stanza a 4 cifre
}

// -------------------------------------------------------------------------
// COSTANTI DI GIOCO
// -------------------------------------------------------------------------

/** Punti Azione massimi concessi ad ogni giocatore all'inizio del proprio turno */
export const MAX_ACTION_POINTS = 3;

/** Costo in PA dell'azione "Pescare una carta" */
export const DRAW_CARD_COST = 1;

/** Numero minimo di giocatori pronti per avviare la partita */
export const MIN_PLAYERS_TO_START = 2;

/** Durata della Reaction Window in millisecondi */
export const REACTION_WINDOW_MS = 5000;

// -------------------------------------------------------------------------
// ENUMERATORI DI COMUNICAZIONE E FASI
// -------------------------------------------------------------------------

/** Fasi principali della partita gestite dalla Macchina a Stati del Server */
export enum GamePhase {
    PRE_LOBBY = "PRE_LOBBY",             // Fase in cui si può selezionare mazzo/personaggio
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
    PLAYER_TURN = "PLAYER_TURN",
    REACTION_WINDOW = "REACTION_WINDOW", // Finestra di 5 secondi per reazioni
    RESOLUTION = "RESOLUTION",           // Risoluzione degli effetti in coda
    GAME_OVER = "GAME_OVER"
}

/** Tipi di Messaggio dal Client al Server. Il Server risponderà modificando lo Stato o inviando Errori. */
export enum ClientMessages {
    JOIN_GAME = "JOIN_GAME",
    START_MATCH = "START_MATCH",
    DRAW_CARD = "DRAW_CARD",
    PLAY_EMPLOYEE = "PLAY_EMPLOYEE",     // Assumere dipendente (Triggera Reaction)
    PLAY_MAGIC = "PLAY_MAGIC",           // Magheggio immediato
    SOLVE_CRISIS = "SOLVE_CRISIS",       // Risolvere crisi (Triggera Reaction)
    PLAY_REACTION = "PLAY_REACTION",     // Giocato durante la Reaction Window dagli avversari
    ROLL_DICE = "ROLL_DICE",             // Richiesta di tirare i dadi
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
    DICE_ROLLED = "DICE_ROLLED",         // Risultato di un RNG per mostrare il dado in 3D/2D

    // -- Eventi Puramente Visivi per la Visual Queue (Miglioramenti UI) --
    SHOW_ANIMATION = "SHOW_ANIMATION",   // Riproduce un'animazione specifica tra due o più entità
    TRIGGER_PARTICLES = "TRIGGER_PARTICLES", // Crea effetti particellari su un target specifico
    START_REACTION_TIMER = "START_REACTION_TIMER", // Innesca un timer visivo (es. per la Reaction Window)
    GAME_WON = "GAME_WON",                // Broadcast quando un giocatore raggiunge la condizione di vittoria

    // -- Visual Juice Protocol Trigger --
    VFX_SHAKE = "VFX_SHAKE",             // Triggera una scossa (crisi o sabotaggio riuscito)
    VFX_CONFIDENZA = "VFX_CONFIDENZA",   // Particelle dorate per assunzioni importanti
    UI_FEEDBACK_DENIED = "UI_FEEDBACK_DENIED" // Animazione di scossa/errore sui bottoni
}

// -------------------------------------------------------------------------
// REGOLE DI INTERAZIONE VISIVA (DRAG & DROP)
// -------------------------------------------------------------------------

/** 
 * Zone di impatto (Drop) logiche e agnostiche rispetto alla risoluzione in pixel.
 * Il Frontend invierà l'intenzione al server basandosi sull'area logica in cui la carta viene rilasciata.
 */
export enum DropZoneArea {
    CENTER_TABLE = "CENTER_TABLE",         // Per giocare generici Employee o Crisi
    OPPONENT_TERRITORY = "OPPONENT_TERRITORY", // Per attacchi/Trick diretti
    DECK_AREA = "DECK_AREA",              // (Risolto nel click, ma utile per scarti)
    HAND = "HAND"                         // Per annullare un drag&drop e resettare la UI
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

/** Payload inviato dal Client con PLAY_EMPLOYEE */
export interface IPlayEmployeePayload {
    cardId: string;         // ID runtime della carta da giocare dalla mano
}

/** Payload inviato dal Client con SOLVE_CRISIS */
export interface ISolveCrisisPayload {
    crisisId: string;       // ID runtime della carta crisi sulla plancia centrale
}

/** Payload inviato dal Client con PLAY_MAGIC */
export interface IPlayMagicPayload {
    cardId: string;         // ID runtime della carta Magheggio
    targetPlayerId?: string; // SessionId del bersaglio (opzionale, dipende dal tipo di Magheggio)
    targetHeroCardId?: string; // ID runtime dell'Hero bersaglio per Item equip
}

/** Payload inviato dal Client con PLAY_REACTION */
export interface IPlayReactionPayload {
    cardId: string;         // ID runtime della carta Reazione da giocare
}

/** Payload inviato dal Client con EMOTE */
export interface IEmotePayload {
    emoteId: string;        // Identificativo dell'emote (es. "thumbs_up", "crying")
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

/** Payload broadcast dal Server con GAME_WON */
export interface IGameWonEvent {
    winnerId: string;       // SessionId del vincitore
    winnerName: string;     // Nome leggibile del CEO vincitore
    finalScore: number;     // Punteggio finale del vincitore
}

/** Payload broadcast dal Server con DICE_ROLLED */
export interface IDiceRolledEvent {
    playerId: string;       // Chi ha tirato
    cardId?: string;        // Quale carta ha scatenato il tiro (opzionale)
    roll1: number;          // Valore del primo dado (es. d6)
    roll2: number;          // Valore del secondo dado (es. d6)
    total: number;          // Somma inclusi modificatori attivi
    success: boolean;       // Se il tiro ha superato la targetRoll (imprevisto/evento)
}

// -- PAYLOAD EVENTI PURAMENTE VISIVI --

/** Payload per ServerEvents.SHOW_ANIMATION */
export interface IVisualAnimationPayload {
    animationId: string;        // ID dell'animazione (es. "card_throw", "slash", "explosion")
    sourceEntityId?: string;    // Opzionale: chi origiona l'animazione
    targetEntityId?: string;    // Opzionale: il target visivo
    durationMs?: number;        // Opzionale: può sovrascrivere la durata standard del tween
}

/** Payload per ServerEvents.TRIGGER_PARTICLES */
export interface IVisualParticlesPayload {
    particleType: string;       // Es. "sparks", "smoke", "confetti"
    targetEntityId: string;     // L'entità su cui spawnare (card id o player avatar)
    intensity?: number;         // Valore da 1 a 10 per l'intensità
}

/** Payload per ServerEvents.START_REACTION_TIMER */
export interface IStartReactionTimerPayload {
    durationMs: number;         // Durata del countdown (es. 5000 ms)
    actionTypeLabel: string;    // Testo da mostrare (es. "Reazione all'assunzione in corso!")
}

// -------------------------------------------------------------------------
// STRUTTURE DATI DI BASE (Riflettono logicamente il DB Locale)
// -------------------------------------------------------------------------

export enum CardType {
    // Modello target Here-to-Slay Lite (5+2)
    HERO = "hero",
    ITEM = "item",
    MAGIC = "magic",
    MODIFIER = "modifier",
    CHALLENGE = "challenge",
    MONSTER = "monster",
    PARTY_LEADER = "party_leader",

    // Alias legacy (compat retroattiva durante la migrazione)
    EMPLOYEE = "hero",
    IMPREVISTO = "monster",
    OGGETTO = "item",
    EVENTO = "magic",
    CRISIS = "monster",
    REACTION = "challenge",
}

export type CardSubtype =
    | "none"
    | "spell"
    | "challenge"
    | "debuff"
    | "reaction"
    | "equipment"
    | "modifier"
    | "leader"
    | "monster";

/** Dati essenziali pubblici di una carta in gioco */
export interface ICardData {
    id: string;              // UUID in-game della singola carta istanziata
    templateId: string;      // ID dal cards_db.json (es. "emp_01")
    type: CardType;          // Tipo della carta
    costPA?: number;         // Costo in Punti Azione
    isFaceUp?: boolean;      // Per sapere se è visibile agli altri
    name?: string;           // Nome leggibile della carta (popolato dal server dal DB)
    description?: string;    // Descrizione breve della carta (popolato dal server dal DB)
    targetRoll?: number;     // Target roll (es. 8+) necessario per affrontare la carta/evento
    modifier?: number;       // Bonus/malus al tiro (+1, -1) fornito passivamente
    equippedItems?: ICardData[]; // Oggetti equipaggiati a questo impiegato
    subtype?: CardSubtype;   // Sottocategoria per distinguere eventi/oggetti
}

/** Visual metadata per representation in the Phaser client */
export interface ICardVisuals {
    bgColorHex: string;
    iconName: string;
    particleColor: string;
}

/** Interface representing the standardized effect object from cards_db.json.
 *  @deprecated Use ICardEffectDSL for strongly-typed effects. This alias is kept for retro-compatibility.
 */
export type ICardEffect = ICardEffectDSL;

// -------------------------------------------------------------------------
// CARD EFFECT DSL (Data Layer — Agente 3)
// -------------------------------------------------------------------------

/** Union of all valid target strings in the DSL */
export type TargetType =
    | "self"
    | "opponent"
    | "opponent_hand"
    | "hero"
    | "employee"
    | "monster"
    | "win_condition"
    | "magic"
    | "trick"
    | "another_opponent"
    | "played_card";

/** Union of all valid action strings in the DSL */
export type ActionType =
    | "produce"
    | "protect"
    | "passive_bonus"
    | "discount_cost"
    | "roll_modifier"
    | "draw_cards"
    | "steal_pa"
    | "steal_card"
    | "discard"
    | "trade_random"
    | "crisis_resolve"
    | "redirect_effect"
    | "steal_played_card"
    | "cancel_effect";

/** Strongly-typed Effect DSL used in cards_db.json and resolved by CardEffectParser */
export interface ICardEffectDSL {
    action: ActionType;
    target?: TargetType;
    amount?: number;
    resource?: string;
    penalty?: string;    // Es. "discard_2"
    reward?: string;     // Es. "vp_1"
    multiplier?: number;
}

/** Interface representing a card template from cards_db.json */
export interface ICardTemplate {
    id: string;
    name: string;
    type: string;
    cost: number;
    shortDesc: string;       // ≤50 chars satirical summary for the card UI (used by Phaser client)
    description: string;
    effect: ICardEffect;
    visuals: ICardVisuals;
    targetRoll?: number;     // Es. 8+ per avere successo conto l'imprevisto o evento
    modifier?: number;       // Bonus passivo ai dadi o altro
    subtype?: CardSubtype;   // Sottocategoria event/item per UI e logica
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

    score: number;           // Punti Vittoria: Dipendenti assunti + Crisi risolte
    victories: number;       // Numero di round/partite vinti (per multi-match o future estensioni)
    activeEffects: string[]; // Effetti temporanei o tag applicati al giocatore (es. buff, debuff, sconti)
}

/** 
 * Contesto dell'Azione in Sospeso 
 * Se un giocatore tenta un'azione criticata da REACTION_WINDOW, il server salva qui l'intenzione.
 */
export interface IPendingAction {
    id: string;              // UUID for the pending action in the stack
    playerId: string;        // Chi sta eseguendo l'azione
    actionType: ClientMessages; // Che tipo di azione (PLAY_EMPLOYEE, SOLVE_CRISIS)
    targetCardId?: string;   // Se stava giocando una carta, quale? (es. employee card, o target trick)
    targetCrisisId?: string; // Se stava risolvendo una crisi, quale?
    targetPlayerId?: string; // Se il target era un giocatore
    targetHeroCardId?: string; // Hero bersaglio per equip Item
    timestamp: number;       // Quando è iniziata la finestra
    isCancelled?: boolean;   // Flag to neutralize action via cancel reactions
}

/** Lo Stato Globale della Room (Sincronizzato a tutti i Client) */
export interface IGameState {
    phase: GamePhase;
    players: Map<string, IPlayer>;     // Map<sessionId, PlayerState>
    hostSessionId: string;             // SessionId dell'host della lobby/partita
    playerOrder: string[];             // Array di SessionId per determinare l'ordine dei turni
    currentTurnPlayerId: string;       // Chi è di turno ora
    turnIndex: number;                 // Indice corrente nell'array playerOrder (round-robin)

    centralCrises: ICardData[];        // Crisi pubbliche a centro tavola (max 3)
    deckCount: number;                 // Quante carte rimangono nel mazzo principale

    // Gestione Reaction Window
    actionStack: IPendingAction[];     // LIFO Stack of actions played in current window
    pendingAction: IPendingAction | null; // (Legacy) or Top Action tracker
    reactionEndTime: number;           // Timestamp (ms) in cui la finestra si chiude e l'azione si risolve

    turnNumber: number;                // Contatore globale dei turni completati

    // Gestione Vittoria
    winnerId?: string;                 // SessionId del vincitore; nil finché la partita è in corso
}

