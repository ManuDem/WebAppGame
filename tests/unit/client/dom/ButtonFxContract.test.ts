import { readSource } from 'tests/helpers/client/sourceReader';

describe('Button FX contract', () => {
    test('LoginScene usa SimpleButtonFx per bottoni principali', () => {
        const src = readSource('client/src/scenes/LoginScene.ts');
        expect(src).toMatch(/this\.joinButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.backButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.createLanguageButton/);
        expect(src).toMatch(/this\.createModeButton/);
    });

    test('PreLobbyScene usa SimpleButtonFx per azioni principali e help', () => {
        const src = readSource('client/src/scenes/PreLobbyScene.ts');
        expect(src).toMatch(/this\.actionButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.helpButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.helpCloseFx\s*=\s*createSimpleButtonFx/);
    });

    test('GameScene usa SimpleButtonFx per controlli match principali', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/this\.deckButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.endButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.readyButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.gameLogToggleFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.cardInspectCloseFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.helpButtonFx\s*=\s*createSimpleButtonFx/);
        expect(src).toMatch(/this\.emoteButtonFx\s*=\s*createSimpleButtonFx/);
    });
});


