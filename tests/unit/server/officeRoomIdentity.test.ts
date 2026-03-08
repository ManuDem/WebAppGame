import { GamePhase } from 'shared/SharedTypes';
import { PlayerState } from 'server/src/State';
import {
    rebindDisconnectedPlayerSession,
    validateOfficeRoomCode,
    validateOfficeRoomJoinRequest,
} from 'server/src/rooms/officeRoomIdentity';

function makePlayer(sessionId: string, username: string, isConnected = false): PlayerState {
    const player = new PlayerState();
    player.sessionId = sessionId;
    player.username = username;
    player.isConnected = isConnected;
    return player;
}

describe('officeRoomIdentity', () => {
    test('validateOfficeRoomCode accetta solo 4 cifre', () => {
        expect(validateOfficeRoomCode('1234')).toEqual({ ok: true, value: '1234' });
        expect(validateOfficeRoomCode('12')).toEqual({
            ok: false,
            statusCode: 400,
            message: 'Il codice stanza deve avere 4 cifre.',
        });
    });

    test('validateOfficeRoomJoinRequest valida nome, room code e stato partita', () => {
        expect(validateOfficeRoomJoinRequest({
            options: { ceoName: '', roomCode: '1234' },
            expectedRoomCode: '1234',
            phase: GamePhase.PRE_LOBBY,
        })).toEqual({ ok: false, statusCode: 400, message: 'Nome CEO mancante.' });

        expect(validateOfficeRoomJoinRequest({
            options: { ceoName: 'CEO*Bad', roomCode: '1234' },
            expectedRoomCode: '1234',
            phase: GamePhase.PRE_LOBBY,
        })).toEqual({
            ok: false,
            statusCode: 400,
            message: 'Il nome CEO puo contenere solo caratteri alfanumerici (niente spazi o simboli).',
        });

        expect(validateOfficeRoomJoinRequest({
            options: { ceoName: 'ValidCEO', roomCode: '9999' },
            expectedRoomCode: '1234',
            phase: GamePhase.PRE_LOBBY,
        })).toEqual({ ok: false, statusCode: 404, message: 'Codice stanza non valido.' });

        expect(validateOfficeRoomJoinRequest({
            options: { ceoName: 'ValidCEO', roomCode: '1234' },
            expectedRoomCode: '1234',
            phase: GamePhase.PLAYER_TURN,
        })).toEqual({
            ok: false,
            statusCode: 403,
            message: 'Partita gia in corso. Puoi rientrare solo con un nome gia presente.',
        });
    });

    test('validateOfficeRoomJoinRequest permette reconnect e blocca nomi gia connessi', () => {
        expect(validateOfficeRoomJoinRequest({
            options: { ceoName: 'ValidCEO', roomCode: '1234' },
            expectedRoomCode: '1234',
            phase: GamePhase.PLAYER_TURN,
            existingPlayer: { sessionId: 'old_1', isConnected: false },
        })).toEqual({
            ok: true,
            value: { ceoName: 'ValidCEO', rejoinFromSessionId: 'old_1' },
        });

        expect(validateOfficeRoomJoinRequest({
            options: { ceoName: 'ValidCEO', roomCode: '1234' },
            expectedRoomCode: '1234',
            phase: GamePhase.PRE_LOBBY,
            existingPlayer: { sessionId: 'old_1', isConnected: true },
        })).toEqual({
            ok: false,
            statusCode: 409,
            message: 'Nome CEO gia in uso in questa stanza.',
        });
    });

    test('rebindDisconnectedPlayerSession aggiorna tutti i riferimenti di sessione', () => {
        const oldPlayer = makePlayer('old_1', 'ValidCEO');
        const otherPlayer = makePlayer('other', 'OtherCEO', true);
        const players = new Map<string, PlayerState>([
            ['old_1', oldPlayer],
            ['other', otherPlayer],
        ]);

        const state = {
            players,
            playerOrder: ['old_1', 'other'],
            currentTurnPlayerId: 'old_1',
            pendingAction: { playerId: 'old_1', targetPlayerId: 'other' },
            actionStack: [{ playerId: 'other', targetPlayerId: 'old_1' } as any],
            hostSessionId: 'old_1',
        };

        const rebound = rebindDisconnectedPlayerSession(state, 'old_1', 'new_1');
        expect(rebound?.sessionId).toBe('new_1');
        expect(rebound?.isConnected).toBe(true);
        expect(players.has('old_1')).toBe(false);
        expect(players.get('new_1')).toBe(rebound);
        expect(state.playerOrder).toEqual(['new_1', 'other']);
        expect(state.currentTurnPlayerId).toBe('new_1');
        expect(state.pendingAction).toEqual({ playerId: 'new_1', targetPlayerId: 'other' });
        expect(state.actionStack[0]).toMatchObject({ playerId: 'other', targetPlayerId: 'new_1' });
        expect(state.hostSessionId).toBe('new_1');
    });
});
