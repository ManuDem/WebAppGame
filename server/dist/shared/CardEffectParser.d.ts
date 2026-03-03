import { IGameState, IPlayer } from "./SharedTypes";
/**
 * Interface representing the standardized effect object from cards_db.json
 */
export interface ICardEffect {
    action: string;
    target?: string;
    amount?: number;
    resource?: string;
    penalty?: string;
    reward?: string;
    multiplier?: number;
}
/**
 * Interface representing a card template from cards_db.json
 */
export interface ICardTemplate {
    id: string;
    name: string;
    type: string;
    cost: number;
    description: string;
    effect: ICardEffect;
}
/**
 * CardEffectParser
 *
 * Pure logic class responsible for parsing and applying card effects to the GameState.
 * Completely decoupled from Phaser (Frontend) and Colyseus (Backend) specific implementations.
 */
export declare class CardEffectParser {
    /**
     * Resolves a card's effect and modifies the game state accordingly.
     *
     * @param cardData The card template data from cards_db.json
     * @param sourcePlayer The player who played the card
     * @param targetPlayer The player targeted by the card (can be null if target is self or global)
     * @param gameState The current global game state
     * @returns boolean true if the effect was applied successfully, false otherwise
     */
    static resolve(cardData: ICardTemplate, sourcePlayer: IPlayer, targetPlayer: IPlayer | null, gameState: IGameState): boolean;
    private static resolveProduce;
    private static resolveStealPA;
    private static resolveStealCard;
    private static resolveDrawCards;
    private static resolveDiscard;
    private static resolveCrisis;
    private static resolveCancelEffect;
}
//# sourceMappingURL=CardEffectParser.d.ts.map