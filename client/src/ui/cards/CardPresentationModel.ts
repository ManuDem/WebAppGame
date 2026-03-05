import { CardType, ICardData } from '../../../../shared/SharedTypes';
import { getCardLocalizedText } from '../../../../shared/CardTextCatalog';
import { SupportedLanguage } from '../../i18n';

export type CardTranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface InspectPresentation {
    title: string;
    meta: string;
    lines: string[];
}

export function localizeCardType(card: ICardData, tr: CardTranslateFn): string {
    const type = String(card.type ?? '').toLowerCase();
    if (type === CardType.HERO || type === CardType.EMPLOYEE) return tr('card_type_hero');
    if (type === CardType.ITEM || type === CardType.OGGETTO) return tr('card_type_item');
    if (type === CardType.MAGIC || type === CardType.EVENTO) return tr('card_type_magic');
    if (type === CardType.MODIFIER) return tr('card_type_modifier');
    if (type === CardType.CHALLENGE) return tr('card_type_challenge');
    if (type === CardType.MONSTER || type === CardType.IMPREVISTO || type === CardType.CRISIS) return tr('card_type_monster');
    return tr('card_type_unknown');
}

export function getCardDisplayName(card: ICardData, lang: SupportedLanguage, tr: CardTranslateFn): string {
    return getLocalizedCardTexts(card, lang).name || tr('game_card_unknown');
}

export function buildMiniCardInfo(card: ICardData, lang: SupportedLanguage, tr: CardTranslateFn): string {
    const shortDesc = getCompactSource(card, lang);
    const type = String(card.type ?? '').toLowerCase();

    if (type === CardType.HERO || type === CardType.EMPLOYEE) {
        if (typeof card.targetRoll === 'number') return clampMiniText(tr('card_mini_hero_roll', { value: card.targetRoll }));
        return clampMiniText(shortDesc ? tr('card_mini_hero_source', { value: shortDesc }) : tr('card_mini_hero_default'));
    }
    if (type === CardType.MONSTER || type === CardType.IMPREVISTO || type === CardType.CRISIS) {
        const rollText = typeof card.targetRoll === 'number'
            ? tr('card_roll_target', { value: card.targetRoll })
            : tr('card_roll_unknown');
        return clampMiniText(shortDesc
            ? tr('card_mini_monster_source', { roll: rollText, value: shortDesc })
            : tr('card_mini_monster_default', { roll: rollText }));
    }
    if (type === CardType.ITEM || type === CardType.OGGETTO) {
        return clampMiniText(shortDesc ? tr('card_mini_item_source', { value: shortDesc }) : tr('card_mini_item_default'));
    }
    if (type === CardType.CHALLENGE || type === CardType.MODIFIER) {
        return clampMiniText(shortDesc ? tr('card_mini_reaction_source', { value: shortDesc }) : tr('card_mini_reaction_default'));
    }
    if (type === CardType.MAGIC || type === CardType.EVENTO) {
        return clampMiniText(shortDesc ? tr('card_mini_magic_source', { value: shortDesc }) : tr('card_mini_magic_default'));
    }
    return clampMiniText(shortDesc || tr('card_mini_special'));
}

export function buildMiniCardFooter(card: ICardData, tr: CardTranslateFn): string {
    const parts: string[] = [localizeCardType(card, tr)];
    if (typeof card.targetRoll === 'number') {
        parts.push(tr('card_footer_roll', { value: card.targetRoll }));
    }
    if (typeof card.modifier === 'number' && card.modifier !== 0) {
        parts.push(tr('card_footer_modifier', { value: `${card.modifier > 0 ? '+' : ''}${card.modifier}` }));
    }
    return parts.join(' | ');
}

export function buildInspectPresentation(card: ICardData, lang: SupportedLanguage, tr: CardTranslateFn): InspectPresentation {
    const text = getLocalizedCardTexts(card, lang);
    const typeLabel = localizeCardType(card, tr);
    const title = String(text.name || tr('game_card_unknown'));
    const metaParts: string[] = [typeLabel];
    if (typeof card.costPA === 'number') metaParts.push(`${tr('game_ap')} ${card.costPA}`);

    const lines: string[] = [];
    const shortDesc = String(text.shortDesc ?? '').trim();
    if (shortDesc.length > 0) lines.push(shortDesc);

    const fullDesc = String(text.description ?? '').trim();
    lines.push(fullDesc.length > 0 ? fullDesc : tr('game_no_card_description'));

    if (typeof card.targetRoll === 'number') lines.push(tr('game_card_target_roll', { value: card.targetRoll }));
    if (typeof card.modifier === 'number' && card.modifier !== 0) {
        lines.push(tr('game_card_modifier', { value: `${card.modifier > 0 ? '+' : ''}${card.modifier}` }));
    }
    if (card.subtype) lines.push(tr('game_card_subtype', { value: String(card.subtype).toUpperCase() }));

    const equippedCount = Number((card as any)?.equippedItems?.length ?? 0);
    if (equippedCount > 0) lines.push(tr('game_card_equipped_count', { count: equippedCount }));

    const type = String(card.type ?? '').toLowerCase();
    if (type === CardType.ITEM || type === CardType.OGGETTO) lines.push(tr('game_card_note_item_target'));
    else if (type === CardType.MONSTER || type === CardType.IMPREVISTO || type === CardType.CRISIS) lines.push(tr('game_card_note_monster_target'));
    else if (type === CardType.CHALLENGE || type === CardType.MODIFIER) lines.push(tr('game_card_note_reaction_only'));
    else if (type === CardType.MAGIC || type === CardType.EVENTO) lines.push(tr('game_card_note_magic_target'));

    return {
        title,
        meta: metaParts.join('  |  '),
        lines,
    };
}

function getCompactSource(card: ICardData, lang: SupportedLanguage): string {
    const text = getLocalizedCardTexts(card, lang);
    const shortDesc = String(text.shortDesc ?? '').trim();
    const full = String(text.description ?? '').trim();
    const source = shortDesc || full;
    const oneLine = source.replace(/\s+/g, ' ').trim();
    if (!oneLine) return '';
    if (oneLine.length <= 30) return oneLine;
    return `${oneLine.slice(0, 27)}...`;
}

function getLocalizedCardTexts(card: ICardData, lang: SupportedLanguage) {
    return getCardLocalizedText(String(card.templateId ?? ''), lang, {
        name: String(card.name ?? ''),
        shortDesc: String((card as any)?.shortDesc ?? ''),
        description: String(card.description ?? ''),
    });
}

function clampMiniText(value: string): string {
    const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (clean.length <= 26) return clean;
    return `${clean.slice(0, 23)}...`;
}
