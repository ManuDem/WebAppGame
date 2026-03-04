import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { OfficeRoomState, PlayerState, CardState } from "../src/State";
import { GamePhase, ServerEvents, CardType } from "../../shared/SharedTypes";

jest.setTimeout(20000);

const createdRooms: OfficeRoom[] = [];

const disposeRoom = (room: OfficeRoom) => {
    clearInterval((room as any)._patchInterval);
    clearTimeout((room as any)._autoDisposeTimeout);
    room.clock?.clear?.();
};

type MockClient = {
    sessionId: string;
    send: (event: unknown, data: unknown) => void;
    getLastPacket: () => { event: unknown; data: unknown } | null;
};

const createMockClient = (sessionId: string): MockClient => {
    let lastPacket: { event: unknown; data: unknown } | null = null;
    return {
        sessionId,
        send: (event: unknown, data: unknown) => {
            lastPacket = { event, data };
        },
        getLastPacket: () => lastPacket,
    };
};

const createManualClock = () => {
    let now = 0;
    let nextId = 0;
    const tasks: Array<{ id: number; due: number; cb: () => void }> = [];

    return {
        setTimeout(cb: () => void, ms: number) {
            const task = { id: ++nextId, due: now + ms, cb };
            tasks.push(task);
            return task.id;
        },
        clear() {
            tasks.length = 0;
        },
        tick(ms: number) {
            now += ms;
            const due = tasks
                .filter((task) => task.due <= now)
                .sort((a, b) => a.due - b.due);

            for (const task of due) {
                const index = tasks.findIndex((candidate) => candidate.id === task.id);
                if (index >= 0) {
                    tasks.splice(index, 1);
                    task.cb();
                }
            }
        },
    };
};

const createDummyRoom = () => {
    const room = new OfficeRoom();
    createdRooms.push(room);
    room.state = new OfficeRoomState();
    room.state.phase = GamePhase.PLAYER_TURN;
    room.broadcast = () => { };

    const manualClock = createManualClock();
    room.clock = manualClock as any;

    for (let i = 1; i <= 3; i++) {
        const player = new PlayerState();
        player.sessionId = `player_${i}`;
        player.username = `CEO_${i}`;
        player.isConnected = true;
        player.actionPoints = 3;
        room.state.players.set(player.sessionId, player);
        room.state.playerOrder.push(player.sessionId);
    }

    room.state.currentTurnPlayerId = "player_1";
    room.state.turnIndex = 0;
    room.state.actionStack = [];
    room["buildCardTemplateLookup"]();

    return room;
};

describe("Feature 04: Reaction stress and anti-cheat", () => {
    afterEach(() => {
        while (createdRooms.length > 0) {
            const room = createdRooms.pop()!;
            disposeRoom(room);
        }
    });

    test("resolves simultaneous reactions without race conditions", () => {
        const room = createDummyRoom();
        const client1 = createMockClient("player_1");
        const client2 = createMockClient("player_2");
        const client3 = createMockClient("player_3");

        const employee = new CardState();
        employee.id = "card_emp_1";
        employee.templateId = "emp_01";
        employee.type = CardType.EMPLOYEE;
        room.state.players.get("player_1")!.hand.push(employee);

        const reaction2 = new CardState();
        reaction2.id = "card_react_2";
        reaction2.templateId = "reac_01";
        reaction2.type = CardType.EVENTO;
        room.state.players.get("player_2")!.hand.push(reaction2);

        const reaction3 = new CardState();
        reaction3.id = "card_react_3";
        reaction3.templateId = "reac_02";
        reaction3.type = CardType.EVENTO;
        room.state.players.get("player_3")!.hand.push(reaction3);

        room["handlePlayEmployee"](client1 as any, { cardId: "card_emp_1" });
        expect(room.state.phase).toBe(GamePhase.REACTION_WINDOW);
        expect(room.state.pendingAction).toBeTruthy();
        expect(room.state.actionStack.length).toBe(1);

        room["handlePlayReaction"](client2 as any, { cardId: "card_react_2" });
        room["handlePlayReaction"](client3 as any, { cardId: "card_react_3" });
        expect(room.state.actionStack.length).toBe(3);

        (room.clock as any).tick(5100);
        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);
        expect(room.state.pendingAction).toBeNull();
        expect(room.state.actionStack.length).toBe(0);
    });

    test("continues after disconnect during reaction window", () => {
        const room = createDummyRoom();
        const client1 = createMockClient("player_1");

        const employee = new CardState();
        employee.id = "card_emp_1";
        employee.templateId = "emp_01";
        employee.type = CardType.EMPLOYEE;
        room.state.players.get("player_1")!.hand.push(employee);

        room["handlePlayEmployee"](client1 as any, { cardId: "card_emp_1" });
        expect(room.state.phase).toBe(GamePhase.REACTION_WINDOW);

        room.state.players.get("player_2")!.isConnected = false;
        (room.clock as any).tick(5100);

        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);
    });

    test("rejects reaction cards outside reaction window", () => {
        const room = createDummyRoom();
        const client2 = createMockClient("player_2");

        const reaction = new CardState();
        reaction.id = "card_react_cheat";
        reaction.templateId = "reac_01";
        reaction.type = CardType.EVENTO;
        room.state.players.get("player_2")!.hand.push(reaction);

        room["handlePlayReaction"](client2 as any, { cardId: "card_react_cheat" });

        const packet = client2.getLastPacket();
        expect(packet).toBeTruthy();
        expect(packet!.event).toBe(ServerEvents.ERROR);
        expect((packet!.data as any).code).toBe("NO_REACTION_WINDOW");
        expect(room.state.players.get("player_2")!.hand.length).toBe(1);
    });
});
