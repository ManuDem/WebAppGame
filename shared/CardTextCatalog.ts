import cardsDbRaw from './cards_db.json';
import cardsI18nRaw from './cards_i18n.json';

export type CardLocale = 'it' | 'en';

export interface ICardLocalizedText {
    name: string;
    shortDesc: string;
    description: string;
}

interface ICardTextEntry {
    it: ICardLocalizedText;
    en: ICardLocalizedText;
}

type CardTemplateLike = {
    id?: string;
    name?: string;
    shortDesc?: string;
    description?: string;
};

const cardTemplates = cardsDbRaw as CardTemplateLike[];
const cardTextCatalog = cardsI18nRaw as Record<string, ICardTextEntry>;

const fallbackByTemplateId = new Map<string, ICardLocalizedText>();

for (const row of cardTemplates) {
    const templateId = String(row?.id ?? '').trim();
    if (!templateId) continue;
    fallbackByTemplateId.set(templateId, {
        name: String(row?.name ?? '').trim(),
        shortDesc: String(row?.shortDesc ?? '').trim(),
        description: String(row?.description ?? '').trim(),
    });
}

function cleanText(value: unknown): string {
    return String(value ?? '').trim();
}

export function normalizeCardLocale(raw: string | null | undefined): CardLocale {
    return String(raw ?? '').toLowerCase() === 'en' ? 'en' : 'it';
}

export function getCardLocalizedText(
    templateId: string,
    locale: string | null | undefined,
    fallback?: Partial<ICardLocalizedText>,
): ICardLocalizedText {
    const normalizedId = String(templateId ?? '').trim();
    const language = normalizeCardLocale(locale);
    const fromCatalog = cardTextCatalog[normalizedId]?.[language];
    const fromTemplate = fallbackByTemplateId.get(normalizedId);

    const name = cleanText(
        fromCatalog?.name
        ?? fallback?.name
        ?? fromTemplate?.name
        ?? normalizedId,
    );
    const shortDesc = cleanText(
        fromCatalog?.shortDesc
        ?? fallback?.shortDesc
        ?? fromTemplate?.shortDesc,
    );
    const description = cleanText(
        fromCatalog?.description
        ?? fallback?.description
        ?? fromTemplate?.description,
    );

    return { name, shortDesc, description };
}

export function getCardTextCatalog(): Readonly<Record<string, ICardTextEntry>> {
    return cardTextCatalog;
}

export function listMissingCardTextLocales(): string[] {
    const missing: string[] = [];
    for (const row of cardTemplates) {
        const templateId = String(row?.id ?? '').trim();
        if (!templateId) continue;

        const entry = cardTextCatalog[templateId];
        const hasIt = Boolean(entry?.it?.name && entry?.it?.shortDesc && entry?.it?.description);
        const hasEn = Boolean(entry?.en?.name && entry?.en?.shortDesc && entry?.en?.description);

        if (!hasIt || !hasEn) {
            missing.push(templateId);
        }
    }
    return missing;
}
