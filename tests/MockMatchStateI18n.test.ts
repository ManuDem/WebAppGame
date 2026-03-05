import { GamePhase, ServerEvents } from '../shared/SharedTypes';
import { t } from '../client/src/i18n';
import { createMockMatchBundle, MockServerManager } from '../client/src/qa/MockMatchState';

describe('MockMatchState i18n', () => {
    test('bundle mock usa nomi giocatori e carte localizzati in EN', () => {
        const bundle = createMockMatchBundle('my_turn', 'en');
        const me = bundle.state.players.get(bundle.localSessionId);
        expect(me).toBeDefined();
        expect(me?.username).toBe(t('en', 'qa_mock_local_name'));
        expect(me?.hand[0]?.name).toBeTruthy();
        expect(me?.hand[0]?.name).not.toContain('Lo ');
    });

    test('bundle mock usa nomi giocatori localizzati in IT', () => {
        const bundle = createMockMatchBundle('my_turn', 'it');
        const me = bundle.state.players.get(bundle.localSessionId);
        expect(me).toBeDefined();
        expect(me?.username).toBe(t('it', 'qa_mock_local_name'));
    });

    test('errori mock rispettano lingua attiva', () => {
        const bundleEn = createMockMatchBundle('my_turn', 'en');
        const managerEn = new MockServerManager(bundleEn);
        let messageEn = '';
        managerEn.onRoomMessage = (type, payload) => {
            if (type === ServerEvents.ERROR) messageEn = String(payload?.message ?? '');
        };
        bundleEn.state.phase = GamePhase.REACTION_WINDOW;
        managerEn.drawCard();
        expect(messageEn).toBe(t('en', 'qa_mock_wrong_phase_draw'));

        const bundleIt = createMockMatchBundle('my_turn', 'it');
        const managerIt = new MockServerManager(bundleIt);
        let messageIt = '';
        managerIt.onRoomMessage = (type, payload) => {
            if (type === ServerEvents.ERROR) messageIt = String(payload?.message ?? '');
        };
        bundleIt.state.phase = GamePhase.REACTION_WINDOW;
        managerIt.drawCard();
        expect(messageIt).toBe(t('it', 'qa_mock_wrong_phase_draw'));
    });
});
