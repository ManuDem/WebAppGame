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
export class CardEffectParser {

    /**
     * Resolves a card's effect and modifies the game state accordingly.
     * 
     * @param cardData The card template data from cards_db.json
     * @param sourcePlayer The player who played the card
     * @param targetPlayer The player targeted by the card (can be null if target is self or global)
     * @param gameState The current global game state
     * @returns boolean true if the effect was applied successfully, false otherwise
     */
    public static resolve(
        cardData: ICardTemplate,
        sourcePlayer: IPlayer,
        targetPlayer: IPlayer | null,
        gameState: IGameState
    ): boolean {

        const effect = cardData.effect;
        if (!effect) return false;

        console.log(`[CardEffectParser] Resolving effect '${effect.action}' for card: ${cardData.name}`);

        switch (effect.action) {
            case "produce":
                return this.resolveProduce(effect, sourcePlayer);

            case "steal_pa":
                return this.resolveStealPA(effect, sourcePlayer, targetPlayer);

            case "steal_card":
                return this.resolveStealCard(effect, sourcePlayer, targetPlayer);

            case "draw_cards":
                return this.resolveDrawCards(effect, sourcePlayer);

            case "discard":
                return this.resolveDiscard(effect, targetPlayer);

            case "crisis_resolve":
                return this.resolveCrisis(effect, sourcePlayer, gameState);

            case "cancel_effect":
                return this.resolveCancelEffect(gameState);

            case "protect":
            case "passive_bonus":
            case "discount_cost":
            case "trade_random":
            case "redirect_effect":
            case "steal_played_card":
                // TODO: Implement advanced effect logic for Phase 3/4
                console.log(`[CardEffectParser] Effect '${effect.action}' is stubbed for future implementation.`);
                return true;

            default:
                console.warn(`[CardEffectParser] Unknown effect action: ${effect.action}`);
                return false;
        }
    }

    private static resolveProduce(effect: ICardEffect, sourcePlayer: IPlayer): boolean {
        if (effect.resource === "pa" && effect.amount) {
            // In a real scenario, this might need to apply next turn, 
            // but for simplicity we modify actionPoints immediately or add a buff.
            sourcePlayer.actionPoints += effect.amount;
            return true;
        }
        return false;
    }

    private static resolveStealPA(effect: ICardEffect, sourcePlayer: IPlayer, targetPlayer: IPlayer | null): boolean {
        if (!targetPlayer || !effect.amount) return false;

        let stolen = Math.min(targetPlayer.actionPoints, effect.amount);
        targetPlayer.actionPoints -= stolen;
        sourcePlayer.actionPoints += stolen;
        return true;
    }

    private static resolveStealCard(effect: ICardEffect, sourcePlayer: IPlayer, targetPlayer: IPlayer | null): boolean {
        if (!targetPlayer || targetPlayer.hand.length === 0 || !effect.amount) return false;

        for (let i = 0; i < effect.amount; i++) {
            if (targetPlayer.hand.length === 0) break;
            const randomIndex = Math.floor(Math.random() * targetPlayer.hand.length);
            const stolenCard = targetPlayer.hand.splice(randomIndex, 1)[0];
            sourcePlayer.hand.push(stolenCard);
        }
        return true;
    }

    private static resolveDrawCards(effect: ICardEffect, sourcePlayer: IPlayer): boolean {
        if (!effect.amount) return false;
        // Logic to draw cards from gameState.deck would go here.
        // Assuming the caller handles the actual server-side deck pop.
        console.log(`[CardEffectParser] Player ${sourcePlayer.username} draws ${effect.amount} cards.`);
        return true;
    }

    private static resolveDiscard(effect: ICardEffect, targetPlayer: IPlayer | null): boolean {
        if (!targetPlayer || !effect.amount) return false;

        for (let i = 0; i < effect.amount; i++) {
            if (targetPlayer.hand.length > 0) {
                const randomIndex = Math.floor(Math.random() * targetPlayer.hand.length);
                targetPlayer.hand.splice(randomIndex, 1);
            }
        }
        return true;
    }

    private static resolveCrisis(effect: ICardEffect, sourcePlayer: IPlayer, _gameState: IGameState): boolean {
        if (effect.reward === "vp_1") {
            sourcePlayer.score += 1;
        }
        // Remove crisis from central table logic would be handled by the caller or here
        return true;
    }

    private static resolveCancelEffect(gameState: IGameState): boolean {
        // Clear the pending action
        gameState.pendingAction = null;
        console.log(`[CardEffectParser] Pending action cancelled by reaction!`);
        return true;
    }
}
