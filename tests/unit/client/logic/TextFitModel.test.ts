import { fitTextToBoxPure } from 'client/src/systems/TextFitModel';

const monoMeasure = (text: string, _fontSize: number) => String(text).length * 10;

describe('TextFitModel', () => {
    test('stringa lunga viene troncata con ellipsis entro il box', () => {
        const fitted = fitTextToBoxPure(
            'Questo testo e volutamente molto lungo per non entrare',
            70,
            12,
            { maxLines: 1, ellipsis: true, fontSize: 10, lineHeight: 12 },
            monoMeasure,
        );
        const lines = fitted.split('\n');
        expect(lines.length).toBeLessThanOrEqual(1);
        expect(lines[lines.length - 1].endsWith('...')).toBe(true);
        lines.forEach((line) => {
            expect(monoMeasure(line, 10)).toBeLessThanOrEqual(70);
        });
    });

    test('rispetta vincolo altezza (max lines da maxH)', () => {
        const fitted = fitTextToBoxPure(
            'uno due tre quattro cinque sei sette otto nove dieci',
            120,
            12,
            { maxLines: 3, ellipsis: true, fontSize: 10, lineHeight: 12 },
            monoMeasure,
        );
        expect(fitted.split('\n').length).toBe(1);
    });
});

