import { readSource } from 'tests/helpers/client/sourceReader';

describe('LoginScene reconnect guard', () => {
    test('init riparte sempre da mode host', () => {
        const source = readSource('client/src/scenes/LoginScene.ts');
        expect(source).toMatch(/this\.mode\s*=\s*'host';/);
    });

    test('prefill storage reconnect solo su flusso reconnect esplicito', () => {
        const source = readSource('client/src/scenes/LoginScene.ts');
        expect(source).toMatch(/const shouldLoadStoredReconnectPrefill = Boolean\(this\.initialFeedbackMessage\) \|\| Boolean\(data\?\.reconnectPrefill\);/);
    });
});


