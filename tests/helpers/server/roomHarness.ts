import { Client } from 'colyseus';
import { CardType, GamePhase } from 'shared/SharedTypes';
import { CardState, OfficeRoomState, PlayerState } from 'server/src/State';
import { OfficeRoom } from 'server/src/rooms/OfficeRoom';

export type PacketRecord = { event: unknown; data: unknown } | null;
export type MockClient = Client & {
    getLastPacket: () => PacketRecord;
    clearLastPacket: () => void;
};

export interface SeedPlayerOptions {
    sessionId: string;
    username?: string;
    isConnected?: boolean;
    isReady?: boolean;
    actionPoints?: number;
}

export interface TestRoomOptions {
    phase?: GamePhase;
    trackBroadcasts?: boolean;
    players?: SeedPlayerOptions[];
    currentTurnPlayerId?: string;
    turnIndex?: number;
}

export type ManualClock = {
    setTimeout: (cb: () => void, ms: number) => { clear: () => void };
    tick: (ms: number) => void;
    clear: () => void;
};

export function createMockClient(sessionId: string): MockClient {
    let lastPacket: PacketRecord = null;
    return {
        sessionId,
        send: ((event: unknown, data: unknown) => {
            lastPacket = { event, data };
        }) as Client['send'],
        error: jest.fn() as any,
        getLastPacket: () => lastPacket,
        clearLastPacket: () => {
            lastPacket = null;
        },
    } as MockClient;
}

export function createManualClock(): ManualClock {
    let now = 0;
    let nextId = 0;
    const tasks: Array<{ id: number; due: number; cb: () => void; cleared: boolean }> = [];

    return {
        setTimeout(cb: () => void, ms: number) {
            const task = { id: ++nextId, due: now + ms, cb, cleared: false };
            tasks.push(task);
            return {
                clear: () => {
                    task.cleared = true;
                },
            };
        },
        tick(ms: number) {
            now += ms;
            const due = tasks
                .filter((task) => !task.cleared && task.due <= now)
                .sort((a, b) => a.due - b.due);

            for (const task of due) {
                task.cleared = true;
                task.cb();
            }
        },
        clear() {
            tasks.length = 0;
        },
    };
}

export function disposeRoom(room: OfficeRoom): void {
    clearInterval((room as any)._patchInterval);
    clearTimeout((room as any)._autoDisposeTimeout);
    room.clock?.clear?.();
}

export function createCard(id: string, templateId: string, type: CardType): CardState {
    const card = new CardState();
    card.id = id;
    card.templateId = templateId;
    card.type = type;
    return card;
}

function createPlayer(seed: SeedPlayerOptions, fallbackIndex: number): PlayerState {
    const player = new PlayerState();
    player.sessionId = seed.sessionId;
    player.username = seed.username ?? `CEO_${fallbackIndex}`;
    player.isConnected = seed.isConnected ?? true;
    player.isReady = seed.isReady ?? true;
    player.actionPoints = seed.actionPoints ?? 3;
    return player;
}

export function createTestRoom(options: TestRoomOptions = {}): OfficeRoom {
    const room = new OfficeRoom();
    room.state = new OfficeRoomState();
    room.state.phase = options.phase ?? GamePhase.PLAYER_TURN;
    room.state.actionStack = [];
    room.clock = createManualClock() as any;

    if (options.trackBroadcasts) {
        room.broadcast = jest.fn((type: unknown, message: unknown) => {
            if (!(room as any).__broadcasts) (room as any).__broadcasts = [];
            (room as any).__broadcasts.push({ type, message });
        }) as any;
    } else {
        room.broadcast = jest.fn() as any;
    }

    const players = options.players ?? [
        { sessionId: 'player_1', username: 'CEO_1', actionPoints: 3, isReady: true },
        { sessionId: 'player_2', username: 'CEO_2', actionPoints: 3, isReady: true },
    ];

    players.forEach((seed, index) => {
        const player = createPlayer(seed, index + 1);
        room.state.players.set(player.sessionId, player);
        room.state.playerOrder.push(player.sessionId);
    });

    room.state.currentTurnPlayerId = options.currentTurnPlayerId ?? players[0]?.sessionId ?? 'player_1';
    room.state.turnIndex = options.turnIndex ?? 0;
    room['buildCardTemplateLookup']();
    return room;
}

export function getBroadcasts(room: OfficeRoom): Array<{ type: unknown; message: unknown }> {
    return ((room as any).__broadcasts ?? []) as Array<{ type: unknown; message: unknown }>;
}

