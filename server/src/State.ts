import { Schema, type, ArraySchema, MapSchema, filter } from "@colyseus/schema";
import {
    IGameState,
    IPlayer,
    ICardData,
    IPendingAction,
    GamePhase,
    CardType,
    ClientMessages
} from "../../shared/SharedTypes";

// ═════════════════════════════════════════════════════════
//  CardState — a single card instance (implements ICardData)
// ═════════════════════════════════════════════════════════
export class CardState extends Schema implements ICardData {
    @type("string")
    id: string = "";

    @type("string")
    templateId: string = "";

    @type("string")
    type: CardType = CardType.EMPLOYEE;

    @type("uint8")
    costPA?: number;

    @type("boolean")
    isFaceUp?: boolean;
}

// ═════════════════════════════════════════════════════════
//  PlayerState — one connected player (implements IPlayer)
// ═════════════════════════════════════════════════════════
export class PlayerState extends Schema implements IPlayer {
    @type("string")
    sessionId: string = "";

    @type("string")
    username: string = "";

    @type("boolean")
    isReady: boolean = false;

    @type("boolean")
    isConnected: boolean = true;

    @type("uint8")
    actionPoints: number = 3;

    // ── Hidden from other clients (server-authoritative) ──
    @filter(function (this: PlayerState, client: any, value: any, root: any) {
        return client.sessionId === this.sessionId;
    })
    @type([CardState])
    hand: ICardData[] = new ArraySchema<CardState>() as any;

    // ── Public area — "Azienda" (hired employees visible to all) ──
    @type([CardState])
    company: ICardData[] = new ArraySchema<CardState>() as any;

    @type("uint8")
    score: number = 0;
}

// ═════════════════════════════════════════════════════════
//  PendingActionState — action context for Reaction Window
// ═════════════════════════════════════════════════════════
export class PendingActionState extends Schema implements IPendingAction {
    @type("string")
    playerId: string = "";

    @type("string")
    actionType: ClientMessages = ClientMessages.PLAY_EMPLOYEE;

    @type("string")
    targetCardId?: string;

    @type("string")
    targetCrisisId?: string;

    @type("number")
    timestamp: number = 0;
}

// ═════════════════════════════════════════════════════════
//  OfficeRoomState — ROOT state (implements IGameState)
// ═════════════════════════════════════════════════════════
export class OfficeRoomState extends Schema implements IGameState {

    @type("string")
    phase: GamePhase = GamePhase.WAITING_FOR_PLAYERS;

    @type({ map: PlayerState })
    players: Map<string, IPlayer> = new MapSchema<PlayerState>() as any;

    @type(["string"])
    playerOrder: string[] = new ArraySchema<string>() as any;

    @type("string")
    currentTurnPlayerId: string = "";

    @type([CardState])
    centralCrises: ICardData[] = new ArraySchema<CardState>() as any;

    @type("uint16")
    deckCount: number = 0;

    @type(PendingActionState)
    pendingAction: PendingActionState = new PendingActionState();

    @type("number")
    reactionEndTime: number = 0;

    @type("uint8")
    turnNumber: number = 0;

    @type("uint8")
    turnIndex: number = 0;
}
