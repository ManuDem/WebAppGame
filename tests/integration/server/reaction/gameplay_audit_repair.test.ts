import {
    CardType,
    ClientMessages,
    GamePhase,
    ICardData,
    ServerEvents,
} from 'shared/SharedTypes';
import { PendingActionState } from 'server/src/State';
import { createCard, createMockClient, createTestRoom, disposeRoom } from 'tests/helpers/server/roomHarness';
import { OfficeRoom } from 'server/src/rooms/OfficeRoom';

const createdRooms: OfficeRoom[] = [];

const createRoomWithPlayers = (phase: GamePhase = GamePhase.PLAYER_TURN) => {
    const room = createTestRoom({
        phase,
        players: [
            { sessionId: 'player_1', username: 'CEO_1', actionPoints: 3, isReady: true },
            { sessionId: 'player_2', username: 'CEO_2', actionPoints: 3, isReady: true },
        ],
        currentTurnPlayerId: 'player_1',
    });
    createdRooms.push(room);
    room.state.pendingAction = null as any;
    room.state.actionStack = [];
    room.state.hostSessionId = 'player_1';
    room['monsterTemplateIds'] = ['crs_01', 'crs_02', 'crs_03'];
    room['monsterBag'] = ['crs_01', 'crs_02', 'crs_03'];
    return room;
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

    test("Item invalido al resolve resta consumato", () => {
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
        expect(hand.length).toBe(0);

        const resolvedCall = (room.broadcast as jest.Mock).mock.calls.find((call) => call[0] === ServerEvents.ACTION_RESOLVED);
        expect(resolvedCall?.[1]?.success).toBe(false);
    });

    test("SOLVE_CRISIS richiede Hero selezionato", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const client = createMockClient("player_1");
        const p1 = room.state.players.get("player_1")!;

        const crisis = createCard("crs_inst_req", "crs_01", CardType.MONSTER);
        (room.state.centralCrises as any[]).push(crisis);
        p1.company.push(createCard("hero_req", "emp_01", CardType.HERO));

        room["handleSolveCrisis"](client, { crisisId: "crs_inst_req" } as any);
        expect(client.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((client.getLastPacket()?.data as any)?.code).toBe("MISSING_ATTACK_HERO");
    });

    test("SOLVE_CRISIS fallisce senza Hero in azienda", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const client = createMockClient("player_1");
        const crisis = createCard("crs_inst_nohero", "crs_01", CardType.MONSTER);
        (room.state.centralCrises as any[]).push(crisis);

        room["handleSolveCrisis"](client, { crisisId: "crs_inst_nohero", heroCardId: "missing" } as any);
        expect(client.getLastPacket()?.event).toBe(ServerEvents.ERROR);
        expect((client.getLastPacket()?.data as any)?.code).toBe("NO_HERO_FOR_ATTACK");
    });

    test("DICE_ROLLED usa i modifier del solo Hero selezionato", () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const p1 = room.state.players.get("player_1")!;

        const selectedHero = createCard("hero_selected", "emp_01", CardType.HERO);
        selectedHero.modifier = -1;
        const selectedItem = createCard("item_selected", "itm_02", CardType.ITEM);
        selectedItem.modifier = 2;
        selectedHero.equippedItems = [selectedItem as any] as any;

        const unselectedHero = createCard("hero_unselected", "emp_02", CardType.HERO);
        const unselectedItem = createCard("item_unselected", "itm_01", CardType.ITEM);
        unselectedItem.modifier = 4;
        unselectedHero.equippedItems = [unselectedItem as any] as any;

        p1.company.push(selectedHero as any, unselectedHero as any);

        const crisis = createCard("crs_inst", "crs_01", CardType.MONSTER);
        crisis.targetRoll = 9;
        (room.state.centralCrises as any[]).push(crisis);

        const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);
        try {
            room["applyCrisisResolution"]("player_1", "crs_inst", "hero_selected");
        } finally {
            randomSpy.mockRestore();
        }

        const diceCall = (room.broadcast as jest.Mock).mock.calls.find((call) => call[0] === ServerEvents.DICE_ROLLED);
        expect(diceCall).toBeTruthy();
        expect(diceCall[1]).toMatchObject({
            playerId: "player_1",
            targetRoll: 9,
            modifier: 1,
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

        expect(room.state.players.has("player_1")).toBe(true);
        expect(room.state.players.get("player_1")?.isConnected).toBe(false);
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
        expect(room.state.players.has("player_1")).toBe(true);
        expect(room.state.players.get("player_1")?.isConnected).toBe(false);
    });

    test("onLeave consented in match attivo preserva slot e consente rejoin host", async () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const leaving = createMockClient("player_1");
        (room as any).roomCode = "1234";
        room.state.players.get("player_1")!.username = "CEO1";

        await room.onLeave(leaving as any, true);

        expect(room.state.players.has("player_1")).toBe(true);
        expect(room.state.players.get("player_1")?.isConnected).toBe(false);
        expect(room.state.hostSessionId).toBe("player_1");

        const auth = room.onAuth(
            {} as any,
            { ceoName: "CEO1", roomCode: "1234" } as any,
            {} as any,
        ) as any;
        expect(auth.rejoinFromSessionId).toBe("player_1");

        const rejoinClient = createMockClient("player_1_new");
        room.onJoin(rejoinClient as any, { ceoName: "CEO1", roomCode: "1234" } as any, auth);

        expect(room.state.players.has("player_1")).toBe(false);
        expect(room.state.players.has("player_1_new")).toBe(true);
        expect(room.state.players.get("player_1_new")?.isConnected).toBe(true);
        expect(room.state.hostSessionId).toBe("player_1_new");
    });

    test("host disconnesso puo rientrare con stesso nome durante match in corso", async () => {
        const room = createRoomWithPlayers(GamePhase.PLAYER_TURN);
        const leaving = createMockClient("player_1");
        (room as any).roomCode = "1234";
        room.state.players.get("player_1")!.username = "CEO1";
        (room as any).allowReconnection = jest.fn().mockRejectedValue(new Error("timeout"));

        await room.onLeave(leaving as any, false);

        expect(room.state.hostSessionId).toBe("player_1");
        expect(room.state.players.get("player_1")?.isConnected).toBe(false);

        const auth = room.onAuth(
            {} as any,
            { ceoName: "CEO1", roomCode: "1234" } as any,
            {} as any,
        ) as any;
        expect(auth.rejoinFromSessionId).toBe("player_1");

        const rejoinClient = createMockClient("player_1_new");
        room.onJoin(rejoinClient as any, { ceoName: "CEO_1", roomCode: "1234" } as any, auth);

        expect(room.state.players.has("player_1")).toBe(false);
        expect(room.state.players.has("player_1_new")).toBe(true);
        expect(room.state.players.get("player_1_new")?.isConnected).toBe(true);
        expect(room.state.hostSessionId).toBe("player_1_new");
    });
});


