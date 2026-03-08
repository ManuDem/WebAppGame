import { getTranslationKeys, t } from 'client/src/i18n';

describe('i18n coverage (IT/EN)', () => {
    test('italiano e inglese hanno lo stesso set di chiavi', () => {
        const itKeys = new Set(getTranslationKeys('it'));
        const enKeys = new Set(getTranslationKeys('en'));

        const missingInIt = [...enKeys].filter((key) => !itKeys.has(key));
        const missingInEn = [...itKeys].filter((key) => !enKeys.has(key));

        expect(missingInIt).toEqual([]);
        expect(missingInEn).toEqual([]);
    });

    test('chiavi nuove critiche carte/UI risolvono in entrambe le lingue', () => {
        const required = [
            'card_type_hero',
            'card_type_item',
            'card_type_magic',
            'card_type_modifier',
            'card_type_challenge',
            'card_type_monster',
            'card_type_unknown',
            'card_eq_badge',
            'card_mini_hero_roll',
            'card_mini_item_default',
            'game_vp_short',
            'game_heroes_short',
            'game_attack_cta_compact',
            'game_attack_cta_locked_compact',
            'qa_mock_local_name',
            'qa_mock_opp_north',
            'qa_mock_opp_south',
            'qa_mock_wrong_phase_draw',
        ];

        required.forEach((key) => {
            expect(t('it', key)).not.toBe(key);
            expect(t('en', key)).not.toBe(key);
        });
    });
});

