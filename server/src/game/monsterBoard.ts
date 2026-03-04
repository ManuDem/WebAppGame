import { CardType, ICardTemplate } from "../../../shared/SharedTypes";
import { CardState } from "../State";

function shuffleInPlace<T>(input: T[], rng: () => number): T[] {
    const out = [...input];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export function collectMonsterTemplateIds(templates: Iterable<ICardTemplate>): string[] {
    const ids: string[] = [];
    for (const template of templates) {
        const typeValue = String(template.type ?? "").trim().toLowerCase();
        if (typeValue === "monster" || typeValue === "crisis") {
            ids.push(template.id);
        }
    }
    return ids;
}

export function drawMonsterTemplateId(
    monsterBag: string[],
    monsterTemplateIds: string[],
    rng: () => number = Math.random,
): string | null {
    if (monsterTemplateIds.length === 0) return null;

    if (monsterBag.length === 0) {
        const shuffled = shuffleInPlace(monsterTemplateIds, rng);
        monsterBag.push(...shuffled);
    }

    return monsterBag.shift() ?? null;
}

export function createMonsterCardState(template: ICardTemplate, generateId: () => string): CardState {
    const card = new CardState();
    card.id = generateId();
    card.templateId = template.id;
    card.type = CardType.MONSTER;
    card.costPA = template.cost;
    card.isFaceUp = true;
    card.name = template.name;
    card.shortDesc = template.shortDesc;
    card.description = template.description;
    card.targetRoll = typeof template.targetRoll === "number" ? template.targetRoll : 7;
    if (typeof template.modifier === "number") card.modifier = template.modifier;
    card.subtype = template.subtype ?? "monster";
    return card;
}

export interface ICrisisRollResult {
    roll1: number;
    roll2: number;
    total: number;
    success: boolean;
}

export function rollCrisisAttempt(
    targetRoll: number,
    totalModifier: number,
    rng: () => number = Math.random,
): ICrisisRollResult {
    const roll1 = 1 + Math.floor(rng() * 6);
    const roll2 = 1 + Math.floor(rng() * 6);
    const total = roll1 + roll2 + totalModifier;
    const success = total >= targetRoll;
    return { roll1, roll2, total, success };
}


