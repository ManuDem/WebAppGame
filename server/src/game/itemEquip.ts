import { CardType, ICardTemplate, IPlayer } from "../../../shared/SharedTypes";
import { CardState } from "../State";

export interface IResolveHeroEquipTargetInput {
    player: IPlayer;
    targetHeroCardId?: string;
    allowFallbackToPlayerLevel?: boolean;
}

export interface IResolveHeroEquipTargetResult {
    ok: boolean;
    targetHero: CardState | null;
    usedFallback: boolean;
    errorCode?: string;
    errorMessage?: string;
}

function isHeroCard(card: unknown): card is CardState {
    const typeValue = String((card as any)?.type ?? "").trim().toLowerCase();
    return typeValue === "hero" || typeValue === "employee";
}

export function resolveHeroEquipTarget(input: IResolveHeroEquipTargetInput): IResolveHeroEquipTargetResult {
    const company = (input.player.company as unknown as CardState[]).filter(isHeroCard);
    const allowFallback = input.allowFallbackToPlayerLevel ?? true;

    if (company.length === 0) {
        if (allowFallback) return { ok: true, targetHero: null, usedFallback: true };
        return {
            ok: false,
            targetHero: null,
            usedFallback: false,
            errorCode: "NO_HERO_FOR_ITEM",
            errorMessage: "Serve almeno un Hero in azienda per equipaggiare un Item.",
        };
    }

    if (input.targetHeroCardId) {
        const explicit = company.find((card) => card.id === input.targetHeroCardId) ?? null;
        if (explicit) return { ok: true, targetHero: explicit, usedFallback: false };
        if (allowFallback) return { ok: true, targetHero: null, usedFallback: true };
        return {
            ok: false,
            targetHero: null,
            usedFallback: false,
            errorCode: "INVALID_HERO_TARGET",
            errorMessage: "L'Hero selezionato per l'Item non esiste nella tua azienda.",
        };
    }

    if (company.length === 1) {
        return { ok: true, targetHero: company[0] ?? null, usedFallback: false };
    }

    if (allowFallback) return { ok: true, targetHero: null, usedFallback: true };
    return {
        ok: false,
        targetHero: null,
        usedFallback: false,
        errorCode: "MISSING_HERO_TARGET",
        errorMessage: "Seleziona un Hero da equipaggiare con l'Item.",
    };
}

export function createItemCardForEquip(
    template: ICardTemplate,
    generateId: () => string,
): CardState {
    const card = new CardState();
    card.id = generateId();
    card.templateId = template.id;
    card.type = CardType.ITEM;
    card.costPA = template.cost;
    card.isFaceUp = true;
    card.name = template.name;
    card.shortDesc = template.shortDesc;
    card.description = template.description;
    card.subtype = template.subtype ?? "equipment";
    if (typeof template.modifier === "number") card.modifier = template.modifier;
    return card;
}

export function equipItemOnHero(hero: CardState, itemCard: CardState): boolean {
    const equipped = (hero.equippedItems ?? []) as CardState[];
    equipped.push(itemCard);
    hero.equippedItems = equipped as any;
    return true;
}

