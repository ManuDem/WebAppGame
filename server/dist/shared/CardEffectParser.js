"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardEffectParser = void 0;
const SharedTypes_1 = require("./SharedTypes");
// @ts-ignore
const cards_db_json_1 = __importDefault(require("./cards_db.json"));
// ---------------------------------------------------------------------------
// CardEffectParser
// Pure logic class — NO dependency on Phaser or Colyseus networking.
// All methods are static. The caller (Colyseus room or server handler) is
// responsible for persisting any mutations to the Colyseus schema.
// ---------------------------------------------------------------------------
class CardEffectParser {
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
    static resolve(cardData, sourcePlayer, targetPlayer, gameState, pendingAction) {
        const effect = cardData.effect;
        if (!effect)
            return false;
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
                return this.resolvePassiveBonus(effect, sourcePlayer, targetPlayer);
            case "discount_cost":
                return this.resolveDiscountCost(effect, sourcePlayer);
            case "roll_modifier":
                return this.resolveRollModifier(effect, sourcePlayer, targetPlayer);
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
    static resolveQueue(pendingAction, reactions, state) {
        const log = [];
        if (!Array.isArray(cards_db_json_1.default) || cards_db_json_1.default.length === 0) {
            const msg = "[resolveQueue] FATAL: cards_db.json is missing, invalid or empty. Aborting resolution.";
            console.error(msg);
            log.push(msg);
            return { success: false, log };
        }
        log.push(`[resolveQueue] Starting resolution. Original action: ${pendingAction.id}`);
        log.push(`[resolveQueue] ${reactions.length} reaction(s) in queue.`);
        // Helper locale per cercare le carte nel DB JSON
        const cardLookup = (templateId) => {
            const entry = cards_db_json_1.default.find((c) => c && c.id === templateId);
            if (!entry) {
                log.push(`[resolveQueue] WARN: card template '${templateId}' not found in cards_db.json.`);
                return undefined;
            }
            return entry;
        };
        // --- PHASE 1: Process reactions in LIFO order (newest first) ---
        // Reactions only mutate the *pendingAction* flag; they do NOT touch
        // live player/game state yet.
        for (let i = reactions.length - 1; i >= 0; i--) {
            const reactionPA = reactions[i];
            if (!reactionPA)
                continue;
            const sourcePlayer = state.players.get(reactionPA.playerId);
            if (!sourcePlayer) {
                log.push(`[resolveQueue] WARN: reaction player '${reactionPA.playerId}' not found, skipping.`);
                continue;
            }
            const templateId = reactionPA.targetCardId;
            if (!templateId)
                continue;
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
        // --- PHASE 4: No longer apply structural effects here ---
        // Structural effects (Employee Hire, Crisis Removal) are delegated to OfficeRoom.ts
        // so that Colyseus Schemas are mutated correctly and not duplicated.
        if (success && !pendingAction.isCancelled) {
            log.push(`[resolveQueue] Action successful, delegating structural changes to main Room.`);
        }
        // --- Cleanup ---
        state.actionStack = [];
        state.pendingAction = null;
        return { success, log };
    }
    // -----------------------------------------------------------------------
    // PRIVATE — Individual effect resolvers
    // -----------------------------------------------------------------------
    static resolveProduce(effect, sourcePlayer) {
        if (effect.resource === "pa" && effect.amount) {
            sourcePlayer.actionPoints += effect.amount;
            console.log(`[CardEffectParser] produce: +${effect.amount} PA → ${sourcePlayer.username}`);
            return true;
        }
        return false;
    }
    static resolveStealPA(effect, sourcePlayer, targetPlayer) {
        if (!targetPlayer || !effect.amount)
            return false;
        if (this.consumeProtectionTag(sourcePlayer, targetPlayer, "steal_pa")) {
            return true;
        }
        // Clamp to available PA — cannot go negative
        const stolen = Math.min(targetPlayer.actionPoints, effect.amount);
        targetPlayer.actionPoints -= stolen;
        sourcePlayer.actionPoints += stolen;
        console.log(`[CardEffectParser] steal_pa: ${sourcePlayer.username} stole ${stolen} PA from ${targetPlayer.username}`);
        return true;
    }
    static resolveStealCard(effect, sourcePlayer, targetPlayer) {
        // Guard: empty hand is a valid no-op, not an error
        if (!targetPlayer || targetPlayer.hand.length === 0 || !effect.amount)
            return false;
        if (this.consumeProtectionTag(sourcePlayer, targetPlayer, "steal_card")) {
            return true;
        }
        for (let i = 0; i < effect.amount; i++) {
            if (targetPlayer.hand.length === 0)
                break;
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            const taken = targetPlayer.hand.splice(idx, 1);
            if (taken.length > 0 && taken[0] !== undefined) {
                sourcePlayer.hand.push(taken[0]);
            }
        }
        console.log(`[CardEffectParser] steal_card: ${sourcePlayer.username} stole ${effect.amount} card(s) from ${targetPlayer.username}`);
        return true;
    }
    static resolveDrawCards(effect, sourcePlayer) {
        if (!effect.amount)
            return false;
        if (!sourcePlayer.activeEffects)
            sourcePlayer.activeEffects = [];
        // Il server leggerà questo tag e pescherà N carte dal deck reale
        sourcePlayer.activeEffects.push(`pending_draw_${effect.amount}`);
        console.log(`[CardEffectParser] draw_cards: tagged ${sourcePlayer.username} with pending_draw_${effect.amount}`);
        return true;
    }
    static resolveDiscard(effect, targetPlayer) {
        if (!targetPlayer || !effect.amount)
            return false;
        if (this.consumeProtectionTag(null, targetPlayer, "discard")) {
            return true;
        }
        for (let i = 0; i < effect.amount; i++) {
            if (targetPlayer.hand.length === 0)
                break;
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            targetPlayer.hand.splice(idx, 1);
        }
        console.log(`[CardEffectParser] discard: ${targetPlayer.username} discarded ${effect.amount} card(s)`);
        return true;
    }
    static resolveCrisis(effect, sourcePlayer, gameState) {
        // Crisis structural resolution is server-authoritative in OfficeRoom:
        // - dice roll
        // - success/fail check
        // - reward/penalty application
        // The parser only acknowledges the DSL action branch.
        void effect;
        void sourcePlayer;
        void gameState;
        return true;
    }
    /**
     * cancel_effect — marks the pendingAction as cancelled.
     * If called outside a reaction queue context (no pendingAction ref),
     * falls back to clearing gameState.pendingAction.
     */
    static resolveCancelEffect(gameState, pendingAction) {
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
    static resolveProtect(sourcePlayer, targetPlayer) {
        // Se non c'è un targetPlayer esplicito, fall-back sul sourcePlayer (es. "Dipendente del Mese")
        const target = targetPlayer || sourcePlayer;
        if (!target.activeEffects)
            target.activeEffects = [];
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
    static resolvePassiveBonus(effect, sourcePlayer, targetPlayer) {
        const target = String(effect.target ?? "win_condition").toLowerCase();
        if (target === "win_condition") {
            const multiplier = effect.multiplier ?? effect.amount ?? 1;
            if (!sourcePlayer.activeEffects)
                sourcePlayer.activeEffects = [];
            const tag = `win_multiplier_${multiplier}`;
            sourcePlayer.activeEffects.push(tag);
            console.log(`[CardEffectParser] passive_bonus: "${tag}" added to ${sourcePlayer.username}`);
            return true;
        }
        if (target === "employee" || target === "hero") {
            const amount = effect.amount ?? effect.multiplier ?? 1;
            const owner = targetPlayer ?? sourcePlayer;
            if (!owner.activeEffects)
                owner.activeEffects = [];
            const tag = `roll_bonus_${amount}`;
            owner.activeEffects.push(tag);
            console.log(`[CardEffectParser] passive_bonus: "${tag}" added to ${owner.username}`);
            return true;
        }
        return false;
    }
    /**
     * discount_cost — adds "discount_trick_X" to sourcePlayer.activeEffects.
     * The PA cost calculator reads and consumes this tag before play.
     */
    static resolveDiscountCost(effect, sourcePlayer) {
        const amount = effect.amount ?? 1;
        if (!sourcePlayer.activeEffects)
            sourcePlayer.activeEffects = [];
        const target = String(effect.target ?? "magic").toLowerCase();
        const tag = target === "trick"
            ? `discount_trick_${amount}` // legacy support
            : `discount_magic_${amount}`;
        sourcePlayer.activeEffects.push(tag);
        if (tag !== `discount_trick_${amount}`) {
            sourcePlayer.activeEffects.push(`discount_trick_${amount}`);
        }
        console.log(`[CardEffectParser] discount_cost: "${tag}" added to ${sourcePlayer.username}`);
        return true;
    }
    /**
     * roll_modifier - one-shot bonus/malus consumed by the next dice roll.
     */
    static resolveRollModifier(effect, sourcePlayer, targetPlayer) {
        const amount = Number(effect.amount ?? 0);
        if (!Number.isFinite(amount) || amount === 0)
            return false;
        const target = String(effect.target ?? "self").toLowerCase();
        const owner = (target === "opponent" || target === "another_opponent")
            ? (targetPlayer ?? sourcePlayer)
            : sourcePlayer;
        if (!owner.activeEffects)
            owner.activeEffects = [];
        const tag = `next_roll_mod_${amount}`;
        owner.activeEffects.push(tag);
        console.log(`[CardEffectParser] roll_modifier: "${tag}" added to ${owner.username}`);
        return true;
    }
    /**
     * trade_random — bidirectional random card swap.
     * sourcePlayer takes 1 random card from targetPlayer's hand;
     * targetPlayer receives 1 random card from sourcePlayer's hand.
     */
    static resolveTradeRandom(sourcePlayer, targetPlayer) {
        if (!targetPlayer)
            return false;
        if (this.consumeProtectionTag(sourcePlayer, targetPlayer, "trade_random")) {
            return true;
        }
        // Se entrambi hanno carte, facciamo uno swap atomico (puro)
        let fromTarget = null;
        let fromSource = null;
        if (targetPlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * targetPlayer.hand.length);
            fromTarget = targetPlayer.hand.splice(idx, 1)[0];
        }
        if (sourcePlayer.hand.length > 0) {
            const idx = Math.floor(Math.random() * sourcePlayer.hand.length);
            fromSource = sourcePlayer.hand.splice(idx, 1)[0];
        }
        // Ora aggiungiamo le carte (se estratte) alle mani opposte
        if (fromTarget)
            sourcePlayer.hand.push(fromTarget);
        if (fromSource)
            targetPlayer.hand.push(fromSource);
        console.log(`[CardEffectParser] trade_random: ${sourcePlayer.username} ↔ ${targetPlayer.username} (swap complete)`);
        return true;
    }
    /**
     * redirect_effect — aggiorna pendingAction.targetPlayerId al nuovo bersaglio.
     */
    static resolveRedirectEffect(targetPlayer, gameState, pendingAction) {
        const target = pendingAction ?? gameState.pendingAction;
        if (!target || !targetPlayer)
            return false;
        target.targetPlayerId = targetPlayer.sessionId;
        console.log(`[CardEffectParser] redirect_effect: targetPlayerId aggiornato a ${targetPlayer.username}`);
        return true;
    }
    /**
     * steal_played_card — segna pendingAction.isCancelled = true e
     * aggiunge la carta alla mano del sourcePlayer.
     */
    static resolveStealPlayedCard(sourcePlayer, gameState, pendingAction) {
        const target = pendingAction ?? gameState.pendingAction;
        if (!target || !target.targetCardId)
            return false;
        target.isCancelled = true;
        const template = cards_db_json_1.default.find((entry) => entry?.id === target.targetCardId);
        const runtimeType = this.resolveRuntimeCardType(template?.type, target);
        sourcePlayer.hand.push({
            id: `stolen_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            templateId: target.targetCardId,
            type: runtimeType,
            costPA: typeof template?.cost === "number" ? template.cost : undefined,
            name: template?.name,
            shortDesc: template?.shortDesc,
            description: template?.description,
            targetRoll: typeof template?.targetRoll === "number" ? template.targetRoll : undefined,
            modifier: typeof template?.modifier === "number" ? template.modifier : undefined,
            subtype: template?.subtype ?? "none",
        });
        console.log(`[CardEffectParser] steal_played_card: action ${target.id} cancelled; card added to ${sourcePlayer.username}'s hand`);
        return true;
    }
    static consumeProtectionTag(sourcePlayer, targetPlayer, context) {
        if (sourcePlayer && sourcePlayer.sessionId === targetPlayer.sessionId)
            return false;
        if (!targetPlayer.activeEffects)
            return false;
        const index = targetPlayer.activeEffects.indexOf("protected");
        if (index === -1)
            return false;
        targetPlayer.activeEffects.splice(index, 1);
        console.log(`[CardEffectParser] ${context}: blocked by protection on ${targetPlayer.username}`);
        return true;
    }
    static resolveRuntimeCardType(templateType, pendingAction) {
        const normalizedType = String(templateType ?? "").trim().toLowerCase();
        if (normalizedType === "hero" || normalizedType === "employee")
            return SharedTypes_1.CardType.HERO;
        if (normalizedType === "monster" || normalizedType === "crisis" || normalizedType === "imprevisto")
            return SharedTypes_1.CardType.MONSTER;
        if (normalizedType === "item" || normalizedType === "oggetto")
            return SharedTypes_1.CardType.ITEM;
        if (normalizedType === "modifier")
            return SharedTypes_1.CardType.MODIFIER;
        if (normalizedType === "challenge" || normalizedType === "reaction")
            return SharedTypes_1.CardType.CHALLENGE;
        if (normalizedType === "party_leader" || normalizedType === "partyleader" || normalizedType === "leader")
            return SharedTypes_1.CardType.PARTY_LEADER;
        if (normalizedType === "magic" || normalizedType === "event" || normalizedType === "trick" || normalizedType === "evento")
            return SharedTypes_1.CardType.MAGIC;
        if (pendingAction.actionType === SharedTypes_1.ClientMessages.PLAY_EMPLOYEE)
            return SharedTypes_1.CardType.HERO;
        if (pendingAction.actionType === SharedTypes_1.ClientMessages.SOLVE_CRISIS)
            return SharedTypes_1.CardType.MONSTER;
        if (pendingAction.actionType === SharedTypes_1.ClientMessages.PLAY_REACTION)
            return SharedTypes_1.CardType.CHALLENGE;
        return SharedTypes_1.CardType.MAGIC;
    }
}
exports.CardEffectParser = CardEffectParser;
//# sourceMappingURL=CardEffectParser.js.map