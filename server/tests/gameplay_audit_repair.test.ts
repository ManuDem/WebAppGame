import { Client } from "colyseus";
import {
    CardType,
    ClientMessages,
    GamePhase,
    ICardData,
    ServerEvents,
} from "../../shared/SharedTypes";
import { CardState, OfficeRoomState, PendingActionState, PlayerState } from "../src/State";
import { OfficeRoom } from "../src/rooms/OfficeRoom";

type MockPacket = { event: unknown; data: unknown } | null;
type MockClient = Client & {
    getLastPacket: () => MockPacket;
    clearLastPacket: () => void;
};

const createdRooms: OfficeRoom[] = [];

const createMockClient = (sessionId: string): MockClient => {
    let lastPacket: MockPacket = null;
    return {
        sessionId,
        send: ((event: unknown, data: unknown) => {
            lastPacket = { event, data };
        }) as any,
        getLastPacket: () => lastPacket,
        clearLastPacket: () => {
            lastPacket = null;
        },
    } as MockClient;
};

const createManualClock = () => {
    let now = 0;
    const timers: Array<{ due: number; cleared: boolean; cb: () => void }> = [];

    return {
        setTimeout(cb: () => void, ms: number) {
            const timer = {
                due: now + ms,
                cleared: false,
                cb,
            };
            timers.push(timer);
            return {
                clear: () => {
                    timer.cleared = true;
                },
            };
        },
        tick(ms: number) {
            now += ms;
            const due = timers.filter((timer) => !timer.cleared && timer.due <= now);
            due.forEach((timer) => {
                timer.cleared = true;
                timer.cb();
            });
        },
        clear() {
            timers.length = 0;
        },
    };
};

const createCard = (id: string, templateId: string, type: CardType): CardState => {
    const card = new CardState();
    card.id = id;
    card.templateId = templateId;
    card.type = type;
    return card;
};

const createRoomWithPlayers = (phase: GamePhase = GamePhase.PLAYER_TURN) => {
    const room = new OfficeRoom();
    createdRooms.push(room);
    room.state = new OfficeRoomState();
    room.state.phase = phase;
    room.state.pendingAction = null as any;
    room.state.actionStack = [];
    room.broadcast = jest.fn();
    room.clock = createManualClock() as any;

    const p1 = new PlayerState();
    p1.sessionId = "player_1";
    p1.username = "CEO_1";
    p1.isConnected = true;
    p1.isReady = true;
    p1.actionPoints = 3;
    room.state.players.set(p1.sessionId, p1);

    const p2 = new PlayerState();
    p2.sessionId = "player_2";
    p2.username = "CEO_2";
    p2.isConnected = true;
    p2.isReady = true;
    p2.actionPoints = 3;
    room.state.players.set(p2.sessionId, p2);

    room.state.playerOrder.push(p1.sessionId, p2.sessionId);
    room.state.currentTurnPlayerId = p1.sessionId;
    room.state.turnIndex = 0;
    room.state.hostSessionId = p1.sessionId;

    room["buildCardTemplateLookup"]();
    room["monsterTemplateIds"] = ["crs_01", "crs_02", "crs_03"];
    room["monsterBag"] = ["crs_01", "crs_02", "crs_03"];

    return room;
};

const disposeRoom = (room: OfficeRoom) => {
    clearInterval((room as any)._patchInterval);
    clearTimeout((room as any)._autoDisposeTimeout);
    room.clock?.clear?.();
};

describe("Gameplay audit repair", () => {
    afterEach(() => {
        while (createdRooms.length > 0) {
            disposeRoom(createdRooms.pop()!);
        }
    });

    test("start match richiede host e giocatori pronti", () => {
        const room = createRoomWithPlayers(GamePhase.PRE_LOBBY);
        const host = createMockClient("player_1");
        const nonHost = createMockClient("player_2");

        room["handleStartMatch"](nonHost);
        expect(nonHost.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((nonHost.getLastPacket()?.data as any)?.code).toBe("HOST_ONLY");

        const p2 = room.state.players.get("player_2")!;
        p2.isReady = false;
        room["handleStartMatch"](host);
        expect((host.getLastPacket()?.data as any)?.code).toBe("PLAYERS_NOT_READY");

        host.clearLastPacket();
        p2.isReady = true;
        room["handleStartMatch"](host);

        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);
        expect((room.state.players.get("player_1")!.hand as ICardData[]).length).toBe(3);
        expect((room.state.players.get("player_2")!.hand as ICardData[]).length).toBe(3);
        expect(room.state.currentTurnPlayerId.length).toBeGreaterThan(0);
    });

    test("PLAY_REACTION non consuma AP", () => {
        const room = createRoomWithPlayers(GamePhase.REACTION_WINDOW);
        const reactor = createMockClient("player_2");
        const p2 = room.state.players.get("player_2")!;

        const original = new PendingActionState();
        original.id = "pa_1";
        original.playerId = "player_1";
        original.actionType = ClientMessages.PLAY_EMPLOYEE;
        original.targetCardId = "emp_01";
        original.timestamp = Date.now();
        room.state.pendingAction = original;
        room.state.actionStack = [original as any];

        p2.hand.push(createCard("rea_card", "rea_01", CardType.CHALLENGE));
        const beforeAp = p2.actionPoints;

        room["handlePlayReaction"](reactor, { cardId: "rea_card" });

        expect(p2.actionPoints).toBe(beforeAp);
        expect((p2.hand as any[]).length).toBe(0);
        expect(room.state.actionStack.length).toBe(2);
    });

    test("Item senza target Hero valido viene rifiutato e non consuma carta", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const client = createMockClient("player_1");
        const p1 = room.state.players.get("player_1")!;

        p1.company.push(createCard("hero_a", "emp_01", CardType.HERO));
        p1.company.push(createCard("hero_b", "emp_02", CardType.HERO));
        p1.hand.push(createCard("item_1", "itm_01", CardType.ITEM));

        room["handlePlayMagic"](client, { cardId: "item_1" });

        expect(client.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((client.getLastPacket()?.data as any)?.code).toBe("MISSING_HERO_TARGET");
        expect((p1.hand as any[]).length).toBe(1);
        expect(p1.actionPoints).toBe(3);
    });

    test("discount_cost riduce il costo magia e viene consumato", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const client = createMockClient("player_1");
        const p1 = room.state.players.get("player_1")!;

        p1.actionPoints = 1;
        (p1.activeEffects as string[]).push("discount_magic_2");
        (p1.activeEffects as string[]).push("discount_trick_2");
        p1.hand.push(createCard("magic_1", "trk_01", CardType.MAGIC));

        room["handlePlayMagic"](client, { cardId: "magic_1", targetPlayerId: "player_2" });

        expect(room.state.phase).toBe(GamePhase.REACTION_WINDOW);
        expect(p1.actionPoints).toBe(1);
        expect((p1.activeEffects as string[]).includes("discount_magic_2")).toBe(false);
        expect((p1.activeEffects as string[]).includes("discount_trick_2")).toBe(false);
    });

    test("Item invalido al resolve viene restituito in mano", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const client = createMockClient("player_1");
        const p1 = room.state.players.get("player_1")!;

        const hero = createCard("hero_target", "emp_01", CardType.HERO);
        p1.company.push(hero);
        p1.hand.push(createCard("item_rollback", "itm_01", CardType.ITEM));

        room["handlePlayMagic"](client, {
            cardId: "item_rollback",
            targetHeroCardId: "hero_target",
        });

        expect((p1.hand as any[]).length).toBe(0);
        (p1.company as any[]).splice(0, 1);
        (room.clock as any).tick(5100);

        const hand = p1.hand as any[];
        expect(hand.length).toBe(1);
        expect(hand[0]?.templateId).toBe("itm_01");

        const resolvedCall = (room.broadcast as jest.Mock).mock.calls.find((call) => call[0] === ServerEvents.ACTION_RESOLVED);
        expect(resolvedCall?.[1]?.success).toBe(false);
    });

    test("DICE_ROLLED include modifier e targetRoll", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const p1 = room.state.players.get("player_1")!;

        const hero = createCard("hero_mod", "emp_01", CardType.HERO);
        const item = createCard("item_mod", "itm_02", CardType.ITEM);
        item.modifier = 2;
        hero.equippedItems = [item as any] as any;
        p1.company.push(hero as any);

        const crisis = createCard("crs_inst", "crs_01", CardType.MONSTER);
        crisis.targetRoll = 9;
        (room.state.centralCrises as any[]).push(crisis);

        const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);
        try {
            room["applyCrisisResolution"]("player_1", "crs_inst");
        } finally {
            randomSpy.mockRestore();
        }

        const diceCall = (room.broadcast as jest.Mock).mock.calls.find((call) => call[0] === ServerEvents.DICE_ROLLED);
        expect(diceCall).toBeTruthy();
        expect(diceCall[1]).toMatchObject({
            playerId: "player_1",
            targetRoll: 9,
            modifier: 2,
            rewardCode: "vp_1",
        });
    });

    test("disconnect cleanup annulla pending action in reaction window", () => {
        const room = createRoomWithPlayers(GamePhase.REACTION_WINDOW);

        const pending = new PendingActionState();
        pending.id = "pa_pending";
        pending.playerId = "player_1";
        pending.actionType = ClientMessages.PLAY_MAGIC;
        pending.targetCardId = "trk_01";
        pending.timestamp = Date.now();

        room.state.pendingAction = pending;
        room.state.actionStack = [pending as any];
        room.state.reactionEndTime = Date.now() + 4000;

        room["cleanupPendingForRemovedPlayer"]("player_1");

        expect(room.state.pendingAction).toBeNull();
        expect(room.state.actionStack.length).toBe(0);
        expect(room.state.reactionEndTime).toBe(0);
        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);

        const resolvedCall = (room.broadcast as jest.Mock).mock.calls.find((call) => call[0] === ServerEvents.ACTION_RESOLVED);
        expect(resolvedCall?.[1]?.success).toBe(false);
    });

    test("advanceTurn senza giocatori connessi porta a WAITING_FOR_PLAYERS", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        room.state.players.get("player_1")!.isConnected = false;
        room.state.players.get("player_2")!.isConnected = false;

        room["advanceTurn"]();

        expect(room.state.phase).toBe(GamePhase.WAITING_FOR_PLAYERS);
        expect(room.state.currentTurnPlayerId).toBe("");
    });

    test("onLeave del player attivo durante PLAYER_TURN avanza il turno", async () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const leaving = createMockClient("player_1");
        room.broadcast = jest.fn();
        (room as any).allowReconnection = jest.fn().mockRejectedValue(new Error("timeout"));

        await room.onLeave(leaving as any, false);

        expect(room.state.players.has("player_1")).toBe(false);
        expect(room.state.currentTurnPlayerId).toBe("player_2");
        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);
    });

    test("onLeave del player pending durante REACTION_WINDOW pulisce stato", async () => {
        const room = createRoomWithPlayers(GamePhase.REACTION_WINDOW);
        const leaving = createMockClient("player_1");

        const pending = new PendingActionState();
        pending.id = "pa_leave";
        pending.playerId = "player_1";
        pending.actionType = ClientMessages.PLAY_MAGIC;
        pending.targetCardId = "trk_01";
        pending.timestamp = Date.now();

        room.state.pendingAction = pending;
        room.state.actionStack = [pending as any];
        room.state.reactionEndTime = Date.now() + 4000;
        (room as any).allowReconnection = jest.fn().mockRejectedValue(new Error("timeout"));

        await room.onLeave(leaving as any, false);

        expect(room.state.pendingAction).toBeNull();
        expect(room.state.actionStack.length).toBe(0);
        expect(room.state.reactionEndTime).toBe(0);
        expect(room.state.phase).toBe(GamePhase.PLAYER_TURN);
        expect(room.state.players.has("player_1")).toBe(false);
    });
});
