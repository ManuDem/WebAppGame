import { Schema } from "@colyseus/schema";
import { IGameState, IPlayer, ICardData, IPendingAction, GamePhase, CardType, ClientMessages } from "../../shared/SharedTypes";
export declare class CardState extends Schema implements ICardData {
    id: string;
    templateId: string;
    type: CardType;
    costPA?: number;
    isFaceUp?: boolean;
    name?: string;
    description?: string;
}
export declare class PendingActionState extends Schema implements IPendingAction {
    id: string;
    playerId: string;
    actionType: ClientMessages;
    targetCardId?: string;
    targetCrisisId?: string;
    targetPlayerId?: string;
    timestamp: number;
    isCancelled?: boolean;
}
export declare class PlayerState extends Schema implements IPlayer {
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
export declare class OfficeRoomState extends Schema implements IGameState {
    phase: GamePhase;
    players: Map<string, IPlayer>;
    playerOrder: string[];
    currentTurnPlayerId: string;
    centralCrises: ICardData[];
    deckCount: number;
    pendingAction: PendingActionState;
    reactionEndTime: number;
    turnNumber: number;
    turnIndex: number;
    winnerId?: string;
    actionStack: IPendingAction[];
}
//# sourceMappingURL=State.d.ts.map