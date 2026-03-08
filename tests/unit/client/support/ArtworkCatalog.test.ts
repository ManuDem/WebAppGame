import {
    buildArtworkPathIndex,
    CARD_ARTWORK_ALIAS_BY_TEMPLATE,
    normalizeArtworkFilePath,
    normalizeArtworkId,
} from 'client/src/ui/cards/ArtworkCatalog';

describe('ArtworkCatalog', () => {
    test('normalizza template id in modo stabile', () => {
        expect(normalizeArtworkId(' EMP_01 ')).toBe('emp_01');
        expect(normalizeArtworkId('emp-01.png')).toBe('emp-01');
        expect(normalizeArtworkId('trk 02')).toBe('trk_02');
    });

    test('costruisce path fallback coerente', () => {
        expect(normalizeArtworkFilePath('', 'emp_01')).toBe('/cards/emp_01.png');
        expect(normalizeArtworkFilePath('hero_luca.png', 'emp_01')).toBe('/cards/hero_luca.png');
        expect(normalizeArtworkFilePath('/cards/custom.png', 'emp_01')).toBe('/cards/custom.png');
    });

    test('indice include alias espliciti anche con manifest vuoto', () => {
        const index = buildArtworkPathIndex([]);
        Object.entries(CARD_ARTWORK_ALIAS_BY_TEMPLATE).forEach(([templateId, fileName]) => {
            expect(index.get(templateId)).toBe(`/cards/${fileName}`);
        });
    });

    test('manifest sovrascrive alias quando fornisce entry esplicita', () => {
        const index = buildArtworkPathIndex([
            { templateId: 'emp_01', file: 'emp_01.png' },
        ]);
        expect(index.get('emp_01')).toBe('/cards/emp_01.png');
    });
});

