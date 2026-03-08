import { readSource } from 'tests/helpers/client/sourceReader';

describe('Card playability visual guard', () => {
    test('GameScene aggiorna visuale giocabile/non giocabile nella mano', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/card\.setPlayableVisual\(canPlayThisCard\)/);
    });

    test('CardGameObject espone API setPlayableVisual', () => {
        const src = readSource('client/src/gameobjects/CardGameObject.ts');
        expect(src).toMatch(/public setPlayableVisual\(playable: boolean\)/);
    });
});


