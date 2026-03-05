import fs from 'node:fs';
import path from 'node:path';
import { t } from '../client/src/i18n';

describe('LoginScene i18n guard', () => {
    test('mode buttons non usano hardcoded HOST/JOIN', () => {
        const filePath = path.resolve(__dirname, '../client/src/scenes/LoginScene.ts');
        const source = fs.readFileSync(filePath, 'utf8');

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

