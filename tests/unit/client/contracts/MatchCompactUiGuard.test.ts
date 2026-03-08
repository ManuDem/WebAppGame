import { t } from 'client/src/i18n';
import { readSource } from 'tests/helpers/client/sourceReader';

describe('Match compact UI guard', () => {
    test('i18n espone label compact per end turn in IT/EN', () => {
        expect(t('it', 'game_end_turn_compact')).toBe('FINE');
        expect(t('en', 'game_end_turn_compact')).toBe('END');
    });

    test('MatchUiDomModel usa end label compact in controlli stretti', () => {
        const domModelSrc = readSource('client/src/ui/match/MatchUiDomModel.ts');
        expect(domModelSrc).toMatch(/const compactControlsLabels = compactDomText \|\| controlsWidth < 270 \|\| layoutTier === 'C';/);
        expect(domModelSrc).toMatch(/endLabel: compactControlsLabels \? tr\('game_end_turn_compact'\) : tr\('game_end_turn'\),/);

        const sceneSrc = readSource('client/src/scenes/GameScene.ts');
        expect(sceneSrc).toContain('buildMatchUiDomModel({');
    });

    test('CTA Monster passa a variante compact prima del clipping', () => {
        const src = readSource('client/src/scenes/GameScene.ts');
        expect(src).toMatch(/const compactCta = w < 88 \|\| h < 40;/);
    });

    test('CSS compatta griglia azioni a 3 colonne quando restano 3 bottoni', () => {
        const css = readSource('client/src/app.css');
        expect(css).toMatch(/match-ui-actions-row-no-emote\.match-ui-actions-row-no-details\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/m);
    });
});
