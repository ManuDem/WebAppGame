import type { IGameState, IPlayer, ICardTemplate, IPendingAction } from "./SharedTypes";
export interface IResolveQueueResult {
    success: boolean;
    log: string[];
}
export declare class CardEffectParser {
    /**
     * Resolves a single card effect and mutates the provided player / state
     * objects immediately.
     *
     * @param cardData      Template from cards_db.json
     * @param sourcePlayer  Player who played the card
     * @param targetPlayer  Explicit target player (null if effect is self/global)
     * @param gameState     Full game state (needed for pendingAction context)
     * @param pendingAction Optional pendingAction reference for Reaction effects
     * @returns true  if the effect was applied successfully
     * @returns false if preconditions were not met (no-op)
     */
    static resolve(cardData: ICardTemplate, sourcePlayer: IPlayer, targetPlayer: IPlayer | null, gameState: IGameState, pendingAction?: IPendingAction): boolean;
    /**
     * resolveQueue — the authoritative resolver for the Reaction Window.
     *
     * Evaluates a LIFO reaction chain, then applies or discards the original
     * pendingAction depending on whether it ended up cancelled.
     *
     * Contract:
     *   - reactions[0]  = the FIRST reaction played (oldest)
     *   - reactions[N-1] = the LAST  reaction played (newest, resolved first)
     *
     * @param pendingAction   The original action to execute (or cancel)
     * @param reactions       Array of reaction IPendingAction in chronological order
     * @param state           Live IGameState — mutated only after all reactions resolved
     * @returns { success, log } success=false if pendingAction ended up cancelled
     */
    static resolveQueue(pendingAction: IPendingAction, reactions: IPendingAction[], state: IGameState): IResolveQueueResult;
    private static resolveProduce;
    private static resolveStealPA;
    private static resolveStealCard;
    private static resolveDrawCards;
    private static resolveDiscard;
    private static resolveCrisis;
    /**
     * cancel_effect — marks the pendingAction as cancelled.
     * If called outside a reaction queue context (no pendingAction ref),
     * falls back to clearing gameState.pendingAction.
     */
    private static resolveCancelEffect;
    /**
     * protect — adds "protected" tag to the sourcePlayer's activeEffects.
     * Non mutare ancora nulla di permanente, solo segnare il buff.
     */
    private static resolveProtect;
    /**
     * passive_bonus — adds "win_multiplier_X" to sourcePlayer.activeEffects.
     * The win-condition checker on the server reads this tag.
     */
    private static resolvePassiveBonus;
    /**
     * discount_cost — adds "discount_trick_X" to sourcePlayer.activeEffects.
     * The PA cost calculator reads and consumes this tag before play.
     */
    private static resolveDiscountCost;
    /**
     * trade_random — bidirectional random card swap.
     * sourcePlayer takes 1 random card from targetPlayer's hand;
     * targetPlayer receives 1 random card from sourcePlayer's hand.
     */
    private static resolveTradeRandom;
    /**
     * redirect_effect — aggiorna pendingAction.targetPlayerId al nuovo bersaglio.
     */
    private static resolveRedirectEffect;
    /**
     * steal_played_card — segna pendingAction.isCancelled = true e
     * aggiunge la carta alla mano del sourcePlayer.
     */
    private static resolveStealPlayedCard;
}
//# sourceMappingURL=CardEffectParser.d.ts.map