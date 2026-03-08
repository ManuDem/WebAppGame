import { GamePhase, ServerEvents } from 'shared/SharedTypes';
import { createMockClient, createTestRoom, disposeRoom } from 'tests/helpers/server/roomHarness';
import { OfficeRoom } from 'server/src/rooms/OfficeRoom';

describe('Lobby start flow', () => {
    let room: OfficeRoom;

    beforeEach(() => {
        room = createTestRoom({
            phase: GamePhase.PRE_LOBBY,
            players: [
                { sessionId: 'host', username: 'Host', actionPoints: 0, isReady: true },
                { sessionId: 'guest', username: 'Guest', actionPoints: 0, isReady: false },
            ],
        });
        room.state.hostSessionId = 'host';
    });

    afterEach(() => {
        disposeRoom(room);
    });

    test('join game marks guest as ready and host can start only after all connected players are ready', () => {
        const host = createMockClient('host');
        const guest = createMockClient('guest');

        room['handleStartMatch'](host);
        expect(host.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((host.getLastPacket()?.data as any)?.code).toBe('PLAYERS_NOT_READY');

        room['handleJoinGame'](guest, {});
        expect(room.state.players.get('guest')?.isReady).toBe(true);

        host.clearLastPacket();
        room['handleStartMatch'](host);

        expect(host.getLastPacket()).toBeNull();
        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);
        expect(room.broadcast).toHaveBeenCalledWith(ServerEvents.TURN_STARTED, expect.any(Object));
    });

    test('non-host cannot start the match', () => {
        const guest = createMockClient('guest');
        room.state.players.get('guest')!.isReady = true;

        room['handleStartMatch'](guest);

        expect(guest.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((guest.getLastPacket()?.data as any)?.code).toBe('HOST_ONLY');
        expect(room.state.phase).toBe(GamePhase.PRE_LOBBY);
    });
});
