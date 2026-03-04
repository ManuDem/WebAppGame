import type { IGameState, IPlayer, ICardEffect, ICardTemplate, IPendingAction } from "./SharedTypes";
import { CardType } from "./SharedTypes";
// @ts-ignore
import cardsDbRaw from "./cards_db.json";

// ---------------------------------------------------------------------------
// RESULT TYPE — returned by resolveQueue
// ---------------------------------------------------------------------------

export interface IResolveQueueResult {
    success: boolean;
    log: string[];
}

// ---------------------------------------------------------------------------
// CardEffectParser
// Pure logic class — NO dependency on Phaser or Colyseus networking.
// All methods are static. The caller (Colyseus room or server handler) is
// responsible for persisting any mutations to the Colyseus schema.
// ---------------------------------------------------------------------------

export class CardEffectParser {

    // -----------------------------------------------------------------------
    // PUBLIC API — single card resolution
    // -----------------------------------------------------------------------

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
    public static resolve(
        cardData: ICardTemplate,
        sourcePlayer: IPlayer,
        targetPlayer: IPlayer | null,
        gameState: IGameState,
        pendingAction?: IPendingAction
    ): boolean {

        const effect = cardData.effect;
        if (!effect) return false;

        console.log(`[CardEffectParser] Resolving '${effect.action}' from card: ${cardData.name}`);

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
                return this.resolveCancelEffect(gameState, pendingAction);

            case "protect":
                return this.resolveProtect(sourcePlayer, targetPlayer);

            case "passive_bonus":
                return this.resolvePassiveBonus(effect, sourcePlayer);

            case "discount_cost":
                return this.resolveDiscountCost(effect, sourcePlayer);

            case "trade_random":
                return this.resolveTradeRandom(sourcePlayer, targetPlayer);

            case "redirect_effect":
                return this.resolveRedirectEffect(targetPlayer, gameState, pendingAction);

            case "steal_played_card":
                return this.resolveStealPlayedCard(sourcePlayer, gameState, pendingAction);

            default:
                console.warn(`[CardEffectParser] Unknown action: ${effect.action}`);
                return false;
        }
    }

    // -----------------------------------------------------------------------
    // PUBLIC API — reaction queue resolution (LIFO)
    // -----------------------------------------------------------------------

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
    public static resolveQueue(
        pendingAction: IPendingAction,
        reactions: IPendingAction[],
        state: IGameState
    ): IResolveQueueResult {
        const log: string[] = [];

        if (!Array.isArray(cardsDbRaw) || cardsDbRaw.length === 0) {
            const msg = "[resolveQueue] FATAL: cards_db.json is missing, invalid or empty. Aborting resolution.";
            console.error(msg);
            log.push(msg);
            return { success: false, log };
        }

        log.push(`[resolveQueue] Starting resolution. Original action: ${pendingAction.id}`);
        log.push(`[resolveQueue] ${reactions.length} reaction(s) in queue.`);

        // Helper locale per cercare le carte nel DB JSON
        const cardLookup = (templateId: string): ICardTemplate | undefined => {
            const entry = (cardsDbRaw as any[]).find((c: any) => c && c.id === templateId);
            if (!entry) {
                log.push(`[resolveQueue] WARN: card template '${templateId}' not found in cards_db.json.`);
                return undefined;
            }
            return entry as ICardTemplate;
        };

        // --- PHASE 1: Process reactions in LIFO order (newest first) ---
        // Reactions only mutate the *pendingAction* flag; they do NOT touch
        // live player/game state yet.
        for (let i = reactions.length - 1; i >= 0; i--) {
            const reactionPA = reactions[i];
            if (!reactionPA) continue;

            const sourcePlayer = state.players.get(reactionPA.playerId);
            if (!sourcePlayer) {
                log.push(`[resolveQueue] WARN: reaction player '${reactionPA.playerId}' not found, skipping.`);
                continue;
            }

            const templateId = reactionPA.targetCardId;
            if (!templateId) continue;

            const cardTemplate = cardLookup(templateId);
            if (!cardTemplate) {
                log.push(`[resolveQueue] WARN: card template '${templateId}' not found, skipping.`);
                continue;
            }

            const targetPlayer = reactionPA.targetPlayerId
                ? state.players.get(reactionPA.targetPlayerId) ?? null
                : null;

            const msg = `[resolveQueue] Reaction[${i}] '${cardTemplate.name}' (${cardTemplate.effect.action}) by ${sourcePlayer.username}`;
            log.push(msg);
            console.log(msg);

            // Reactions can operate on the pendingAction reference directly
            this.resolve(cardTemplate, sourcePlayer, targetPlayer, state, pendingAction);
        }

        // --- PHASE 2: Check whether the original action survived ---
        if (pendingAction.isCancelled) {
            const msg = `[resolveQueue] Original action ${pendingAction.id} was CANCELLED by reactions. No effect applied.`;
            log.push(msg);
            console.log(msg);

            // Clear stack
            state.actionStack = [];
            state.pendingAction = null;
            return { success: false, log };
        }

        // --- PHASE 3: Execute the original action ---
        const originalSourcePlayer = state.players.get(pendingAction.playerId);
        if (!originalSourcePlayer) {
            log.push(`[resolveQueue] ERROR: Original action player '${pendingAction.playerId}' not found.`);
            state.actionStack = [];
            state.pendingAction = null;
            return { success: false, log };
        }

        const originalTemplateId = pendingAction.targetCardId;
        if (!originalTemplateId) {
            log.push(`[resolveQueue] WARN: Original action has no targetCardId. Skipping card effect.`);
            state.actionStack = [];
            state.pendingAction = null;
            return { success: true, log };
        }

        const originalCard = cardLookup(originalTemplateId);
        if (!originalCard) {
            log.push(`[resolveQueue] ERROR: Card '${originalTemplateId}' not found in DB.`);
            state.actionStack = [];
            state.pendingAction = null;
            return { success: false, log };
        }

        const originalTargetPlayer = pendingAction.targetPlayerId
            ? state.players.get(pendingAction.targetPlayerId) ?? null
            : null;

        log.push(`[resolveQueue] Executing original action: ${originalCard.name} by ${originalSourcePlayer.username}.`);
        const success = this.resolve(originalCard, originalSourcePlayer, originalTargetPlayer, state, pendingAction);
        log.push(`[resolveQueue] Result: ${success ? "SUCCESS" : "FAILED (preconditions not met)"}`);

        // --- PHASE 4: Apply Structural Effects if no cancellation ---
        if (success && !pendingAction.isCancelled) {
            if (pendingAction.actionType === "PLAY_EMPLOYEE" && originalTemplateId) {
                // Sposta la carta virtualmente nella company (il server aggiornerà le chiavi corrette)
                const companyCard = {
                    id: pendingAction.id,          // Usa l'ID azione momentaneamente
                    templateId: originalTemplateId,
                    type: originalCard.type as CardType,
                    costPA: originalCard.cost,
                    isFaceUp: true,
                    name: originalCard.name
                };
                if (!originalSourcePlayer.company) originalSourcePlayer.company = [];
                originalSourcePlayer.company.push(companyCard);
                originalSourcePlayer.score = originalSourcePlayer.company.length;
                log.push(`[resolveQueue] Structural: ${originalCard.name} added to ${originalSourcePlayer.username}'s company.`);
                console.log(`[resolveQueue] Structural: added to company.`);
            } else if (pendingAction.actionType === "SOLVE_CRISIS" && pendingAction.targetCrisisId) {
                // Rimuove la crisi dal tavolo (il server farà lo schema sync corretto)
                const crisisArr = state.centralCrises as any[];
                const idx = crisisArr.findIndex((c: any) => c.id === pendingAction.targetCrisisId);
                if (idx !== -1) {
                    crisisArr.splice(idx, 1);
                    log.push(`[resolveQueue] Structural: Crisis ${pendingAction.targetCrisisId} removed from central table.`);
                }
            }
        }

        // --- Cleanup ---
        state.actionStack = [];
        state.pendingAction = null;
        return { success, log };
    }

    // -----------------------------------------------------------------------
    // PRIVATE — Individual effect resolvers
    // -----------------------------------------------------------------------

    private static resolveProduce(effect: ICardEffect, sourcePlayer: IPlayer): boolean {
        if (effect.resource === "pa" && effect.amount) {
            sourcePlayer.actionPoints += effect.amount;
            console.log(`[CardEffectParser] produce: +${effect.amount} PA → ${sourcePlayer.username}`);
            return true;
        }
        return false;
    }

    private static resolveStealPA(
        effect: ICardEffect,
        sourcePlayer: IPlayer,
        targetPlayer: IPlayer | null
    ): boolean {
        if (!targetPlayer || !effect.amount) return false;
        // Clamp to available PA — cannot go negative
        const stolen = Math.min(targetPlayer.actionPoints, effect.amount);
        targetPlayer.actionPoints -= stolen;
        sourcePlayer.actionPoints += stolen;
        console.log(`[CardEffectParser] steal_pa: ${sourcePlayer.username} stole ${stolen} PA from ${targetPlayer.username}`);
        return true;
    }

    private static resolveStealCard(
        effect: ICardEffect,
        sourcePlayer: IPlayer,
        targetPlayer: IPlayer | null
    ): boolean {
        // Guard: empty hand is a valid no-op, not an error
        if (!targetPlayer || targetPlayer.hand.length === 0 || !effect.amount) return false;

        for (let i = 0; i < effect.amount; i++) {
            if (targetPlayer.hand.length === 0) break;
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            const taken = targetPlayer.hand.splice(idx, 1);
            if (taken.length > 0 && taken[0] !== undefined) {
                sourcePlayer.hand.push(taken[0]!);
            }
        }
        console.log(`[CardEffectParser] steal_card: ${sourcePlayer.username} stole ${effect.amount} card(s) from ${targetPlayer.username}`);
        return true;
    }

    private static resolveDrawCards(effect: ICardEffect, sourcePlayer: IPlayer): boolean {
        if (!effect.amount) return false;
        // Actual deck pop handled by the server caller; we just signal intent.
        console.log(`[CardEffectParser] draw_cards: ${sourcePlayer.username} should draw ${effect.amount} card(s) — caller handles deck pop.`);
        return true;
    }

    private static resolveDiscard(effect: ICardEffect, targetPlayer: IPlayer | null): boolean {
        if (!targetPlayer || !effect.amount) return false;
        for (let i = 0; i < effect.amount; i++) {
            if (targetPlayer.hand.length === 0) break;
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            targetPlayer.hand.splice(idx, 1);
        }
        console.log(`[CardEffectParser] discard: ${targetPlayer.username} discarded ${effect.amount} card(s)`);
        return true;
    }

    private static resolveCrisis(
        effect: ICardEffect,
        sourcePlayer: IPlayer,
        _gameState: IGameState
    ): boolean {
        if (effect.reward === "vp_1") {
            sourcePlayer.score += 1;
            console.log(`[CardEffectParser] crisis_resolve: +1 VP to ${sourcePlayer.username}`);
        }
        return true;
    }



    /**
     * cancel_effect — marks the pendingAction as cancelled.
     * If called outside a reaction queue context (no pendingAction ref),
     * falls back to clearing gameState.pendingAction.
     */
    private static resolveCancelEffect(
        gameState: IGameState,
        pendingAction?: IPendingAction
    ): boolean {
        if (pendingAction) {
            pendingAction.isCancelled = true;
            console.log(`[CardEffectParser] cancel_effect: pendingAction ${pendingAction.id} marked isCancelled=true`);
            return true;
        }
        // Legacy single-action context
        if (gameState.pendingAction) {
            gameState.pendingAction.isCancelled = true;
            console.log(`[CardEffectParser] cancel_effect: gameState.pendingAction cancelled`);
            return true;
        }
        return false;
    }

    /**
     * protect — adds "protected" tag to the sourcePlayer's activeEffects.
     * Non mutare ancora nulla di permanente, solo segnare il buff.
     */
    private static resolveProtect(
        sourcePlayer: IPlayer,
        targetPlayer: IPlayer | null
    ): boolean {
        // Se non c'è un targetPlayer esplicito, fall-back sul sourcePlayer (es. "Dipendente del Mese")
        const target = targetPlayer || sourcePlayer;
        if (!target.activeEffects) target.activeEffects = [];
        if (!target.activeEffects.includes("protected")) {
            target.activeEffects.push("protected");
        }
        console.log(`[CardEffectParser] protect: "protected" tag added to ${target.username}`);
        return true;
    }

    /**
     * passive_bonus — adds "win_multiplier_X" to sourcePlayer.activeEffects.
     * The win-condition checker on the server reads this tag.
     */
    private static resolvePassiveBonus(effect: ICardEffect, sourcePlayer: IPlayer): boolean {
        const multiplier = effect.multiplier ?? 1;
        if (!sourcePlayer.activeEffects) sourcePlayer.activeEffects = [];
        const tag = `win_multiplier_${multiplier}`;
        sourcePlayer.activeEffects.push(tag);
        console.log(`[CardEffectParser] passive_bonus: "${tag}" added to ${sourcePlayer.username}`);
        return true;
    }

    /**
     * discount_cost — adds "discount_trick_X" to sourcePlayer.activeEffects.
     * The PA cost calculator reads and consumes this tag before play.
     */
    private static resolveDiscountCost(effect: ICardEffect, sourcePlayer: IPlayer): boolean {
        const amount = effect.amount ?? 1;
        if (!sourcePlayer.activeEffects) sourcePlayer.activeEffects = [];
        const tag = `discount_trick_${amount}`;
        sourcePlayer.activeEffects.push(tag);
        console.log(`[CardEffectParser] discount_cost: "${tag}" added to ${sourcePlayer.username}`);
        return true;
    }

    /**
     * trade_random — bidirectional random card swap.
     * sourcePlayer takes 1 random card from targetPlayer's hand;
     * targetPlayer receives 1 random card from sourcePlayer's hand.
     */
    private static resolveTradeRandom(
        sourcePlayer: IPlayer,
        targetPlayer: IPlayer | null
    ): boolean {
        if (!targetPlayer) return false;

        // Se entrambi hanno carte, facciamo uno swap atomico (puro)
        let fromTarget: any = null;
        let fromSource: any = null;

        if (targetPlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            fromTarget = targetPlayer.hand.splice(idx, 1)[0];
        }

        if (sourcePlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * sourcePlayer.hand.length);
            fromSource = sourcePlayer.hand.splice(idx, 1)[0];
        }

        // Ora aggiungiamo le carte (se estratte) alle mani opposte
        if (fromTarget) sourcePlayer.hand.push(fromTarget);
        if (fromSource) targetPlayer.hand.push(fromSource);

        console.log(`[CardEffectParser] trade_random: ${sourcePlayer.username} ↔ ${targetPlayer.username} (swap complete)`);
        return true;
    }

    /**
     * redirect_effect — aggiorna pendingAction.targetPlayerId al nuovo bersaglio.
     */
    private static resolveRedirectEffect(
        targetPlayer: IPlayer | null,
        gameState: IGameState,
        pendingAction?: IPendingAction
    ): boolean {
        const target = pendingAction ?? gameState.pendingAction;
        if (!target || !targetPlayer) return false;

        target.targetPlayerId = targetPlayer.sessionId;
        console.log(`[CardEffectParser] redirect_effect: targetPlayerId aggiornato a ${targetPlayer.username}`);
        return true;
    }

    /**
     * steal_played_card — segna pendingAction.isCancelled = true e
     * aggiunge la carta alla mano del sourcePlayer.
     */
    private static resolveStealPlayedCard(
        sourcePlayer: IPlayer,
        gameState: IGameState,
        pendingAction?: IPendingAction
    ): boolean {
        const target = pendingAction ?? gameState.pendingAction;
        if (!target || !target.targetCardId) return false;

        target.isCancelled = true;
        // Creiamo una struct ICardData fittizia o recuperiamo i dati dal template per aggiungerla in mano
        sourcePlayer.hand.push({
            id: `stolen_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            templateId: target.targetCardId,
            type: CardType.MAGIC // Semplificazione: il server la sovrascriverà se necessario
        });

        console.log(`[CardEffectParser] steal_played_card: action ${target.id} cancelled; card added to ${sourcePlayer.username}'s hand`);
        return true;
    }
}
