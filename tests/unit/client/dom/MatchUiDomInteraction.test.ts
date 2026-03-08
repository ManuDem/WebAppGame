import { computeMatchLayout } from 'client/src/ui/layout/MatchLayout';
import {
    createMockUiRoot,
    FakeDocument,
    FakeElement,
    getButtonByLabel,
    toButtonList,
} from 'tests/helpers/client/fakeDom';

let mockUiRoot: FakeElement;

jest.mock('client/src/ui/dom/UiRoot', () => ({
    ensureUiRoot: () => mockUiRoot as unknown as HTMLElement,
}));

import { MatchUiDom } from 'client/src/ui/dom/MatchUiDom';

describe('MatchUiDom interaction simulation', () => {
    beforeEach(() => {
        mockUiRoot = createMockUiRoot();
        (global as any).document = new FakeDocument();
        (global as any).window = {};
    });

    test('landscape actions invoke enabled primary callbacks and keep hidden controls collapsed', () => {
        const callbacks = {
            onDraw: jest.fn(),
            onEndTurn: jest.fn(),
            onDetails: jest.fn(),
            onToggleLog: jest.fn(),
            onHelp: jest.fn(),
            onEmote: jest.fn(),
        };
        const dom = new MatchUiDom('it', callbacks);
        dom.applyLayout(computeMatchLayout(1024, 768));
        dom.update({
            roomCode: 'ROOM 1234',
            opponents: '2 opponents',
            turn: 'Il tuo turno',
            stats: 'AP 3 | VP 1',
            phase: 'PLAYER TURN',
            reaction: '',
            reactionActive: false,
            myTurn: true,
            actionHint: 'Tocca ATTACCA',
            actionDetail: 'Dettagli azione',
            actionContext: 'Contesto azione',
            canDraw: true,
            canEndTurn: true,
            showEmote: true,
            drawLabel: 'MAZZO',
            endLabel: 'FINE TURNO',
            detailsLabel: 'INFO',
            helpLabel: 'HELP',
            emoteLabel: 'EM',
            logTitle: 'LOG',
            logToggle: 'ESPANDI',
            logEntries: ['Azione 1', 'Azione 2'],
            logExpanded: true,
        });

        getButtonByLabel(mockUiRoot, 'MAZZO').click();
        getButtonByLabel(mockUiRoot, 'FINE TURNO').click();
        getButtonByLabel(mockUiRoot, 'HELP').click();
        getButtonByLabel(mockUiRoot, 'ESPANDI').click();

        const infoButtons = toButtonList(mockUiRoot).filter((button) => button.textContent === 'INFO');
        const emoteButtons = toButtonList(mockUiRoot).filter((button) => button.textContent === 'EM');

        expect(infoButtons.length).toBe(1);
        expect(emoteButtons.length).toBe(1);
        expect(infoButtons[0].style.display).toBe('none');
        expect(emoteButtons[0].style.display).toBe('none');
        expect(callbacks.onDraw).toHaveBeenCalledTimes(1);
        expect(callbacks.onEndTurn).toHaveBeenCalledTimes(1);
        expect(callbacks.onHelp).toHaveBeenCalledTimes(1);
        expect(callbacks.onToggleLog).toHaveBeenCalledTimes(1);
        expect(callbacks.onDetails).toHaveBeenCalledTimes(0);
        expect(callbacks.onEmote).toHaveBeenCalledTimes(0);
    });

    test('disabled buttons do not emit primary actions', () => {
        const callbacks = {
            onDraw: jest.fn(),
            onEndTurn: jest.fn(),
            onDetails: jest.fn(),
            onToggleLog: jest.fn(),
            onHelp: jest.fn(),
            onEmote: jest.fn(),
        };
        const dom = new MatchUiDom('it', callbacks);
        dom.applyLayout(computeMatchLayout(1024, 768));
        dom.setInteractionEnabled(false);
        dom.update({
            roomCode: 'ROOM 1234',
            opponents: '2 opponents',
            turn: 'Il tuo turno',
            stats: 'AP 3 | VP 1',
            phase: 'PLAYER TURN',
            reaction: '',
            reactionActive: false,
            myTurn: true,
            actionHint: 'Hint',
            actionDetail: '',
            actionContext: '',
            canDraw: false,
            canEndTurn: false,
            showEmote: true,
            drawLabel: 'MAZZO',
            endLabel: 'FINE TURNO',
            detailsLabel: 'INFO',
            helpLabel: 'HELP',
            emoteLabel: 'EM',
            logTitle: 'LOG',
            logToggle: 'ESPANDI',
            logEntries: ['Azione 1'],
            logExpanded: false,
        });

        getButtonByLabel(mockUiRoot, 'MAZZO').click();
        getButtonByLabel(mockUiRoot, 'FINE TURNO').click();
        getButtonByLabel(mockUiRoot, 'HELP').click();
        getButtonByLabel(mockUiRoot, 'ESPANDI').click();

        expect(callbacks.onDraw).toHaveBeenCalledTimes(0);
        expect(callbacks.onEndTurn).toHaveBeenCalledTimes(0);
        expect(callbacks.onHelp).toHaveBeenCalledTimes(0);
        expect(callbacks.onToggleLog).toHaveBeenCalledTimes(0);
        expect(callbacks.onDetails).toHaveBeenCalledTimes(0);
        expect(callbacks.onEmote).toHaveBeenCalledTimes(0);
    });

    test('portrait compact keeps draw/end/help available while hiding details and emote', () => {
        const callbacks = {
            onDraw: jest.fn(),
            onEndTurn: jest.fn(),
            onDetails: jest.fn(),
            onToggleLog: jest.fn(),
            onHelp: jest.fn(),
            onEmote: jest.fn(),
        };
        const dom = new MatchUiDom('it', callbacks);
        dom.applyLayout(computeMatchLayout(360, 640));
        dom.update({
            roomCode: 'ROOM 1234',
            opponents: '',
            turn: 'Il tuo turno',
            stats: 'AP 3 | VP 1',
            phase: '',
            reaction: '',
            reactionActive: false,
            myTurn: true,
            actionHint: 'Hint',
            actionDetail: '',
            actionContext: '',
            canDraw: true,
            canEndTurn: true,
            showEmote: true,
            drawLabel: 'MAZZO',
            endLabel: 'FINE',
            detailsLabel: 'INFO',
            helpLabel: 'HELP',
            emoteLabel: 'EM',
            logTitle: 'LOG',
            logToggle: 'ESPANDI',
            logEntries: [],
            logExpanded: false,
        });

        getButtonByLabel(mockUiRoot, 'MAZZO').click();
        getButtonByLabel(mockUiRoot, 'FINE').click();
        getButtonByLabel(mockUiRoot, 'HELP').click();

        const infoButtons = toButtonList(mockUiRoot).filter((button) => button.textContent === 'INFO');
        const emoteButtons = toButtonList(mockUiRoot).filter((button) => button.textContent === 'EM');

        expect(infoButtons.length).toBe(1);
        expect(emoteButtons.length).toBe(1);
        expect(infoButtons[0].style.display).toBe('none');
        expect(emoteButtons[0].style.display).toBe('none');
        expect(callbacks.onDraw).toHaveBeenCalledTimes(1);
        expect(callbacks.onEndTurn).toHaveBeenCalledTimes(1);
        expect(callbacks.onHelp).toHaveBeenCalledTimes(1);
        expect(callbacks.onDetails).toHaveBeenCalledTimes(0);
        expect(callbacks.onEmote).toHaveBeenCalledTimes(0);
    });
});
