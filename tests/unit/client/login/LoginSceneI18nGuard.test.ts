import { t } from 'client/src/i18n';
import { readSource } from 'tests/helpers/client/sourceReader';

describe('LoginScene i18n guard', () => {
    test('mode buttons non usano hardcoded HOST/JOIN', () => {
        const source = readSource('client/src/scenes/LoginScene.ts');

        expect(source).not.toMatch(/createModeButton\(\s*['"]HOST['"]/);
        expect(source).not.toMatch(/createModeButton\(\s*['"]JOIN['"]/);
    });

    test('chiavi login_mode_host/login_mode_join risolvono in IT e EN', () => {
        expect(t('it', 'login_mode_host')).not.toBe('login_mode_host');
        expect(t('it', 'login_mode_join')).not.toBe('login_mode_join');
        expect(t('en', 'login_mode_host')).not.toBe('login_mode_host');
        expect(t('en', 'login_mode_join')).not.toBe('login_mode_join');
    });
});


