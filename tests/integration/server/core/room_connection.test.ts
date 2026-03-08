import { OfficeRoom } from 'server/src/rooms/OfficeRoom';
import { GamePhase } from 'shared/SharedTypes';

const disposeRoom = (instance: OfficeRoom) => {
    clearInterval((instance as any)._patchInterval);
    clearTimeout((instance as any)._autoDisposeTimeout);
    instance.clock?.clear?.();
};

describe('Room Connection and Validation Directives (Feature 01)', () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = new OfficeRoom();
        room.state = {
            phase: GamePhase.PRE_LOBBY,
            players: new Map(),
        } as any;
        (room as any).roomCode = '1234';
        room.clock = { setTimeout: jest.fn(), tick: jest.fn(), clear: jest.fn() } as any;
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test('Deve rifiutare la connessione se ceoName manca', () => {
        expect(() => {
            room.onAuth({} as any, { roomCode: '1234' } as any, {} as any);
        }).toThrow('Nome CEO mancante.');
    });

    test('Deve rifiutare la connessione se ceoName e una stringa vuota', () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: '', roomCode: '1234' } as any, {} as any);
        }).toThrow('Nome CEO mancante.');
    });

    test('Deve rifiutare la connessione se ceoName e troppo corto (< 3)', () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: 'Ab', roomCode: '1234' } as any, {} as any);
        }).toThrow('Il nome CEO deve essere compreso tra 3 e 15 caratteri.');
    });

    test('Deve rifiutare la connessione se ceoName e troppo lungo (> 15)', () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: 'QuestoNomeEVeramenteTroppoLungo', roomCode: '1234' } as any, {} as any);
        }).toThrow('Il nome CEO deve essere compreso tra 3 e 15 caratteri.');
    });

    test('Deve accettare la connessione se ceoName e valido', () => {
        const result = room.onAuth({} as any, { ceoName: 'ValidCEO', roomCode: '1234' } as any, {} as any) as any;
        expect(result).toEqual({ ceoName: 'ValidCEO', rejoinFromSessionId: null });
    });

    test('Deve rifiutare roomCode errato', () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: 'ValidCEO', roomCode: '9999' } as any, {} as any);
        }).toThrow('Codice stanza non valido.');
    });
});

