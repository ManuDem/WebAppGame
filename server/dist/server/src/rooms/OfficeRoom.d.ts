import { Room, Client } from "colyseus";
import { OfficeRoomState } from "../State";
import { ICardData, JoinOptions } from "../../../shared/SharedTypes";
export declare class OfficeRoom extends Room<OfficeRoomState> {
    private roomCode;
    /** Handle to the reaction-window countdown timer */
    private reactionTimeout;
    /** Server-side deck (not synchronized to state) */
    protected serverDeck: ICardData[];
    /** Card template lookup map (templateId → ICardTemplate) built from cards_db.json */
    private cardTemplates;
    onCreate(_options: any): void;
    onAuth(client: Client, options: JoinOptions, _request: any): {
        ceoName: string;
        rejoinFromSessionId: string | null;
    };
    onJoin(client: Client, options: JoinOptions, auth?: {
        ceoName: string;
        rejoinFromSessionId?: string | null;
    }): void;
    onLeave(client: Client, consented: boolean): Promise<void>;
    private buildCardTemplateLookup;
    private getTemplate;
    private handleJoinGame;
    private handleStartMatch;
    private startGame;
    private populateCentralCrises;
    private dealInitialHands;
    private createCardStateFromDeckCard;
    private handleEndTurn;
    private advanceTurn;
    private handleDrawCard;
    private handlePlayEmployee;
    private handleSolveCrisis;
    private handlePlayMagic;
    private handlePlayReaction;
    private resolvePhase;
    /**
     * Moves the card from pending limbo → player's company (public area).
     * Called by resolveReactions when the PLAY_EMPLOYEE action is not cancelled.
     */
    private applyEmployeeHire;
    /**
     * Removes the resolved crisis from centralCrises.
     * CardEffectParser.resolve already awarded VP via resolveCrisis().
     */
    private applyCrisisRemoval;
    private checkWinConditions;
    private checkPlayerTurnAction;
    private handleEmote;
    private generateId;
    private getConnectedPlayerEntries;
    private assignNextHost;
    private normalizeRoomCode;
    private findPlayerByName;
}
//# sourceMappingURL=OfficeRoom.d.ts.map