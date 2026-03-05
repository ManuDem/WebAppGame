import {
    RECONNECT_ALLOWED_AGE_MS,
    RECONNECT_BACKOFF_MS,
    getReconnectDelayMs,
    isReconnectContextFresh,
} from '../client/src/network/ReconnectPolicy';

describe('ReconnectPolicy', () => {
    test('usa il backoff previsto e clampa oltre la coda', () => {
        expect(getReconnectDelayMs(1)).toBe(RECONNECT_BACKOFF_MS[0]);
        expect(getReconnectDelayMs(2)).toBe(RECONNECT_BACKOFF_MS[1]);
        expect(getReconnectDelayMs(5)).toBe(RECONNECT_BACKOFF_MS[4]);
        expect(getReconnectDelayMs(99)).toBe(RECONNECT_BACKOFF_MS[4]);
    });

    test('context fresh richiede ceoName, roomCode e timestamp recente', () => {
        const now = 1_000_000;
        expect(isReconnectContextFresh(null, now)).toBe(false);
        expect(isReconnectContextFresh({
            ceoName: '',
            roomCode: '1234',
            updatedAt: now,
        }, now)).toBe(false);
        expect(isReconnectContextFresh({
            ceoName: 'CEO',
            roomCode: '1234',
            updatedAt: now - RECONNECT_ALLOWED_AGE_MS - 1,
        }, now)).toBe(false);
        expect(isReconnectContextFresh({
            ceoName: 'CEO',
            roomCode: '1234',
            updatedAt: now - 10_000,
        }, now)).toBe(true);
    });
});
