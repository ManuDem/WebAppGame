import {
    RECONNECT_STORAGE_KEY,
    RECONNECT_ALLOWED_AGE_MS,
    RECONNECT_BACKOFF_MS,
    getReconnectDelayMs,
    isReconnectContextFresh,
    parseReconnectContext,
    readFreshReconnectContext,
} from 'client/src/network/ReconnectPolicy';

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

    test('parseReconnectContext filtra payload non valido', () => {
        expect(parseReconnectContext('')).toBeNull();
        expect(parseReconnectContext('not-json')).toBeNull();
        expect(parseReconnectContext(JSON.stringify({ ceoName: 'CEO', roomCode: '', updatedAt: 1 }))).toBeNull();
        expect(parseReconnectContext(JSON.stringify({ ceoName: 'CEO', roomCode: '1234', updatedAt: 123 }))).toEqual({
            ceoName: 'CEO',
            roomCode: '1234',
            updatedAt: 123,
        });
    });

    test('readFreshReconnectContext legge solo snapshot recente', () => {
        const now = 50_000;
        const storage: Pick<Storage, 'getItem'> = {
            getItem: (key: string) => {
                if (key !== RECONNECT_STORAGE_KEY) return null;
                return JSON.stringify({
                    ceoName: 'CEO42',
                    roomCode: '7788',
                    updatedAt: now - 500,
                });
            },
        };

        expect(readFreshReconnectContext(storage, now)).toEqual({
            ceoName: 'CEO42',
            roomCode: '7788',
            updatedAt: now - 500,
        });
        expect(readFreshReconnectContext(storage, now + RECONNECT_ALLOWED_AGE_MS + 1)).toBeNull();
    });
});

