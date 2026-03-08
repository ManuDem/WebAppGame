import cardsDbRaw from 'shared/cards_db.json';
import {
    getCardLocalizedText,
    getCardTextCatalog,
    listMissingCardTextLocales,
    normalizeCardLocale,
} from 'shared/CardTextCatalog';

type CardTemplate = {
    id: string;
    name: string;
    shortDesc: string;
    description: string;
};

describe('CardTextCatalog', () => {
    test('catalogo copre tutte le carte in IT e EN', () => {
        const templates = cardsDbRaw as CardTemplate[];
        const catalog = getCardTextCatalog();

        expect(templates.length).toBeGreaterThan(0);
        expect(Object.keys(catalog).length).toBeGreaterThanOrEqual(templates.length);
        expect(listMissingCardTextLocales()).toEqual([]);

        templates.forEach((row) => {
            const entry = catalog[row.id];
            expect(entry).toBeDefined();
            expect(String(entry.it.name).trim().length).toBeGreaterThan(0);
            expect(String(entry.it.shortDesc).trim().length).toBeGreaterThan(0);
            expect(String(entry.it.description).trim().length).toBeGreaterThan(0);
            expect(String(entry.en.name).trim().length).toBeGreaterThan(0);
            expect(String(entry.en.shortDesc).trim().length).toBeGreaterThan(0);
            expect(String(entry.en.description).trim().length).toBeGreaterThan(0);
        });
    });

    test('getCardLocalizedText usa fallback robusto', () => {
        const itText = getCardLocalizedText('emp_01', 'it');
        const enText = getCardLocalizedText('emp_01', 'en');

        expect(itText.name).toBe('Lo Stagista Sfruttato');
        expect(enText.name).toBe('Overworked Intern');

        const fallback = getCardLocalizedText('unknown_x', 'en', {
            name: 'Fallback Name',
            shortDesc: 'Fallback Short',
            description: 'Fallback Description',
        });
        expect(fallback.name).toBe('Fallback Name');
        expect(fallback.shortDesc).toBe('Fallback Short');
        expect(fallback.description).toBe('Fallback Description');
    });

    test('normalizeCardLocale accetta solo it/en', () => {
        expect(normalizeCardLocale('it')).toBe('it');
        expect(normalizeCardLocale('en')).toBe('en');
        expect(normalizeCardLocale('EN')).toBe('en');
        expect(normalizeCardLocale('fr')).toBe('it');
        expect(normalizeCardLocale(undefined)).toBe('it');
    });
});

