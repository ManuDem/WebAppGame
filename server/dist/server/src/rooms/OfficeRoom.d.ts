import { Room, Client } from "colyseus";
import { OfficeRoomState } from "../State";
import { ICardData, JoinOptions } from "../../../shared/SharedTypes";
export declare class OfficeRoom extends Room<OfficeRoomState> {
    private roomCode;
    /** Handle to the reaction-window countdown timer */
    private reactionTimeout;
    /** Server-side deck (not synchronized to state) */
    protected serverDeck: ICardData[];
    /** Card template lookup map (templateId â†’ ICardTemplate) built from cards_db.json */
    private cardTemplates;
    private monsterTemplateIds;
    private monsterBag;
    private pendingRemovedCards;
    onCreate(_options: any): void;
    onAuth(client: Client, options: JoinOptions, _request: any): import("./officeRoomIdentity").JoinRequestContext;
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
    private assignPartyLeaders;
    private populateCentralCrises;
    private refillCentralCrisesToThree;
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
    private applyEmployeeHire;
    /**
     * Server-authoritative crisis resolution:
     * - Roll 2d6 (+ modifiers)
     * - Broadcast DICE_ROLLED
     * - On success: reward + remove crisis
     * - On fail: apply crisis penalty
     */
    private applyMagicResolution;
    private isHeroRuntimeCard;
    private validateSelectedAttackHero;
    private applyCrisisResolution;
    private getCrisisRollModifier;
    private applyCrisisPenalty;
    private checkWinConditions;
    private checkPlayerTurnAction;
    private peekMagicDiscount;
    private consumeMagicDiscount;
    private cloneRuntimeCardData;
    private removePlayerPermanently;
    private cleanupPendingForRemovedPlayer;
    private shouldPreserveDisconnectedSlot;
    private handleEmote;
    private generateId;
    private getConnectedPlayerEntries;
    private assignNextHost;
    private normalizeRoomCode;
    private findPlayerByName;
}
//# sourceMappingURL=OfficeRoom.d.ts.map