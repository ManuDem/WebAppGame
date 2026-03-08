import { readSource } from 'tests/helpers/client/sourceReader';

describe('Match overlay rigidity guard', () => {
    test('GameScene considera anche target selector nei modal attivi', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/isModalOverlayOpen\(\)/);
        expect(src).toMatch(/targetSelectorOverlay\?\.active/);
    });

    test('GameScene supporta chiusura overlay con ESC', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/keydown-ESC/);
        expect(src).toMatch(/private handleEscapeKey\(\)/);
    });

    test('help e inspect si chiudono da overlay e bottone close', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/helpOverlay\.on\('pointerdown',/);
        expect(src).toMatch(/helpCloseHit\.on\('pointerdown', \(\) => this\.hideHelpOverlay\(\)\)/);
        expect(src).toMatch(/cardInspectOverlay\.on\('pointerdown',/);
        expect(src).toMatch(/cardInspectCloseHit\.on\('pointerdown', \(\) => this\.hideCardInspect\(\)\)/);
    });

    test('modal overlay nasconde DOM match e lo ripristina in uscita', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/this\.matchDom\?\.setVisible\(false\)/);
        expect(src).toMatch(/this\.matchDom\?\.setVisible\(true\)/);
    });

    test('overlay input viene attivato/disattivato in modo esplicito', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/this\.input\.setTopOnly\(true\)/);
        expect(src).toMatch(/helpOverlay\.input\) this\.helpOverlay\.input\.enabled = true/);
        expect(src).toMatch(/helpOverlay\.input\) this\.helpOverlay\.input\.enabled = false/);
        expect(src).toMatch(/cardInspectOverlay\.input\) this\.cardInspectOverlay\.input\.enabled = true/);
        expect(src).toMatch(/cardInspectOverlay\.input\) this\.cardInspectOverlay\.input\.enabled = false/);
    });
});


