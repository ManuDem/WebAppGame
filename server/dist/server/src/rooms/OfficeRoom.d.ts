import { Room, Client } from "colyseus";
import { OfficeRoomState } from "../State";
export declare class OfficeRoom extends Room<OfficeRoomState> {
    /** Handle to the reaction-window countdown timer */
    private reactionTimeout;
    /** Server-side deck (not synchronized to state) */
    private serverDeck;
    onCreate(_options: any): void;
    onAuth(client: Client, options: any, request: any): {
        ceoName: string;
    };
    onJoin(client: Client, options: any, auth?: {
        ceoName: string;
    }): void;
    onLeave(client: Client, consented: boolean): Promise<void>;
    private startReactionWindow;
    private resolveReactions;
    private advanceTurn;
    private handleJoinGame;
    private startGame;
    private generatePlaceholderDeck;
    private handleEndTurn;
    private handleDrawCard;
    private handlePlayEmployee;
    private handleSolveCrisis;
    private handlePlayMagic;
    private handlePlayReaction;
    private handleEmote;
    private checkPlayerTurnAction;
}
//# sourceMappingURL=OfficeRoom.d.ts.map