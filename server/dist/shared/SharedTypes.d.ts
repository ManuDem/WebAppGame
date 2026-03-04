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
    roomCode: string;
}
/** Punti Azione massimi concessi ad ogni giocatore all'inizio del proprio turno */
export declare const MAX_ACTION_POINTS = 3;
/** Costo in PA dell'azione "Pescare una carta" */
export declare const DRAW_CARD_COST = 1;
/** Numero minimo di giocatori pronti per avviare la partita */
export declare const MIN_PLAYERS_TO_START = 2;
/** Durata della Reaction Window in millisecondi */
export declare const REACTION_WINDOW_MS = 5000;
/** Fasi principali della partita gestite dalla Macchina a Stati del Server */
export declare enum GamePhase {
    PRE_LOBBY = "PRE_LOBBY",// Fase in cui si può selezionare mazzo/personaggio
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
    PLAYER_TURN = "PLAYER_TURN",
    REACTION_WINDOW = "REACTION_WINDOW",// Finestra di 5 secondi per reazioni
    RESOLUTION = "RESOLUTION",// Risoluzione degli effetti in coda
    GAME_OVER = "GAME_OVER"
}
/** Tipi di Messaggio dal Client al Server. Il Server risponderà modificando lo Stato o inviando Errori. */
export declare enum ClientMessages {
    JOIN_GAME = "JOIN_GAME",
    START_MATCH = "START_MATCH",
    DRAW_CARD = "DRAW_CARD",
    PLAY_EMPLOYEE = "PLAY_EMPLOYEE",// Assumere dipendente (Triggera Reaction)
    PLAY_MAGIC = "PLAY_MAGIC",// Magheggio immediato
    SOLVE_CRISIS = "SOLVE_CRISIS",// Risolvere crisi (Triggera Reaction)
    PLAY_REACTION = "PLAY_REACTION",// Giocato durante la Reaction Window dagli avversari
    ROLL_DICE = "ROLL_DICE",// Richiesta di tirare i dadi
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
    DICE_ROLLED = "DICE_ROLLED",// Risultato di un RNG per mostrare il dado in 3D/2D
    SHOW_ANIMATION = "SHOW_ANIMATION",// Riproduce un'animazione specifica tra due o più entità
    TRIGGER_PARTICLES = "TRIGGER_PARTICLES",// Crea effetti particellari su un target specifico
    START_REACTION_TIMER = "START_REACTION_TIMER",// Innesca un timer visivo (es. per la Reaction Window)
    GAME_WON = "GAME_WON",// Broadcast quando un giocatore raggiunge la condizione di vittoria
    VFX_SHAKE = "VFX_SHAKE",// Triggera una scossa (crisi o sabotaggio riuscito)
    VFX_CONFIDENZA = "VFX_CONFIDENZA",// Particelle dorate per assunzioni importanti
    UI_FEEDBACK_DENIED = "UI_FEEDBACK_DENIED"
}
/**
 * Zone di impatto (Drop) logiche e agnostiche rispetto alla risoluzione in pixel.
 * Il Frontend invierà l'intenzione al server basandosi sull'area logica in cui la carta viene rilasciata.
 */
export declare enum DropZoneArea {
    CENTER_TABLE = "CENTER_TABLE",// Per giocare generici Employee o Crisi
    OPPONENT_TERRITORY = "OPPONENT_TERRITORY",// Per attacchi/Trick diretti
    DECK_AREA = "DECK_AREA",// (Risolto nel click, ma utile per scarti)
    HAND = "HAND"
}
/** Payload inviato dal Client con DRAW_CARD (attualmente vuoto, il server sa chi manda) */
export interface IDrawCardPayload {
}
/** Payload inviato dal Client con END_TURN */
export interface IEndTurnPayload {
}
/** Payload inviato dal Client con PLAY_EMPLOYEE */
export interface IPlayEmployeePayload {
    cardId: string;
}
/** Payload inviato dal Client con SOLVE_CRISIS */
export interface ISolveCrisisPayload {
    crisisId: string;
}
/** Payload inviato dal Client con PLAY_MAGIC */
export interface IPlayMagicPayload {
    cardId: string;
    targetPlayerId?: string;
    targetHeroCardId?: string;
}
/** Payload inviato dal Client con PLAY_REACTION */
export interface IPlayReactionPayload {
    cardId: string;
}
/** Payload inviato dal Client con EMOTE */
export interface IEmotePayload {
    emoteId: string;
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
/** Payload broadcast dal Server con GAME_WON */
export interface IGameWonEvent {
    winnerId: string;
    winnerName: string;
    finalScore: number;
}
/** Payload broadcast dal Server con DICE_ROLLED */
export interface IDiceRolledEvent {
    playerId: string;
    cardId?: string;
    roll1: number;
    roll2: number;
    total: number;
    success: boolean;
}
/** Payload per ServerEvents.SHOW_ANIMATION */
export interface IVisualAnimationPayload {
    animationId: string;
    sourceEntityId?: string;
    targetEntityId?: string;
    durationMs?: number;
}
/** Payload per ServerEvents.TRIGGER_PARTICLES */
export interface IVisualParticlesPayload {
    particleType: string;
    targetEntityId: string;
    intensity?: number;
}
/** Payload per ServerEvents.START_REACTION_TIMER */
export interface IStartReactionTimerPayload {
    durationMs: number;
    actionTypeLabel: string;
}
export declare enum CardType {
    HERO = "hero",
    ITEM = "item",
    MAGIC = "magic",
    MODIFIER = "modifier",
    CHALLENGE = "challenge",
    MONSTER = "monster",
    PARTY_LEADER = "party_leader",
    EMPLOYEE = "hero",
    IMPREVISTO = "monster",
    OGGETTO = "item",
    EVENTO = "magic",
    CRISIS = "monster",
    REACTION = "challenge"
}
export type CardSubtype = "none" | "spell" | "challenge" | "debuff" | "reaction" | "equipment" | "modifier" | "leader" | "monster";
/** Dati essenziali pubblici di una carta in gioco */
export interface ICardData {
    id: string;
    templateId: string;
    type: CardType;
    costPA?: number;
    isFaceUp?: boolean;
    name?: string;
    description?: string;
    targetRoll?: number;
    modifier?: number;
    equippedItems?: ICardData[];
    subtype?: CardSubtype;
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
/** Union of all valid target strings in the DSL */
export type TargetType = "self" | "opponent" | "opponent_hand" | "hero" | "employee" | "monster" | "win_condition" | "magic" | "trick" | "another_opponent" | "played_card";
/** Union of all valid action strings in the DSL */
export type ActionType = "produce" | "protect" | "passive_bonus" | "discount_cost" | "roll_modifier" | "draw_cards" | "steal_pa" | "steal_card" | "discard" | "trade_random" | "crisis_resolve" | "redirect_effect" | "steal_played_card" | "cancel_effect";
/** Strongly-typed Effect DSL used in cards_db.json and resolved by CardEffectParser */
export interface ICardEffectDSL {
    action: ActionType;
    target?: TargetType;
    amount?: number;
    resource?: string;
    penalty?: string;
    reward?: string;
    multiplier?: number;
}
/** Interface representing a card template from cards_db.json */
export interface ICardTemplate {
    id: string;
    name: string;
    type: string;
    cost: number;
    shortDesc: string;
    description: string;
    effect: ICardEffect;
    visuals: ICardVisuals;
    targetRoll?: number;
    modifier?: number;
    subtype?: CardSubtype;
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
    victories: number;
    activeEffects: string[];
}
/**
 * Contesto dell'Azione in Sospeso
 * Se un giocatore tenta un'azione criticata da REACTION_WINDOW, il server salva qui l'intenzione.
 */
export interface IPendingAction {
    id: string;
    playerId: string;
    actionType: ClientMessages;
    targetCardId?: string;
    targetCrisisId?: string;
    targetPlayerId?: string;
    targetHeroCardId?: string;
    timestamp: number;
    isCancelled?: boolean;
}
/** Lo Stato Globale della Room (Sincronizzato a tutti i Client) */
export interface IGameState {
    phase: GamePhase;
    players: Map<string, IPlayer>;
    hostSessionId: string;
    playerOrder: string[];
    currentTurnPlayerId: string;
    turnIndex: number;
    centralCrises: ICardData[];
    deckCount: number;
    actionStack: IPendingAction[];
    pendingAction: IPendingAction | null;
    reactionEndTime: number;
    turnNumber: number;
    winnerId?: string;
}
//# sourceMappingURL=SharedTypes.d.ts.map