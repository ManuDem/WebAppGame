import { Client } from "colyseus";
import { CardType, GamePhase, ServerEvents } from "../../shared/SharedTypes";
import { CardState, OfficeRoomState, PlayerState } from "../src/State";
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

const createDummyRoom = () => {
    const room = new OfficeRoom();
    createdRooms.push(room);
    room.state = new OfficeRoomState();
    room.state.phase = GamePhase.PLAYER_TURN;
    room.state.actionStack = [];
    room.broadcast = jest.fn();
    room.clock = createManualClock() as any;

    const p1 = new PlayerState();
    p1.sessionId = "player_1";
    p1.username = "CEO_1";
    p1.isConnected = true;
    p1.actionPoints = 3;
    room.state.players.set(p1.sessionId, p1);
    room.state.playerOrder.push(p1.sessionId);

    const p2 = new PlayerState();
    p2.sessionId = "player_2";
    p2.username = "CEO_2";
    p2.isConnected = true;
    p2.actionPoints = 3;
    room.state.players.set(p2.sessionId, p2);
    room.state.playerOrder.push(p2.sessionId);

    room.state.currentTurnPlayerId = p1.sessionId;
    room.state.turnIndex = 0;

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

describe("Gameplay foundation (M1 + M2)", () => {
    afterEach(() => {
        while (createdRooms.length > 0) {
            disposeRoom(createdRooms.pop()!);
        }
    });

    test("consuma AP quando DRAW_CARD e valido", () => {
        const room = createDummyRoom();
        const client = createMockClient("player_1");

        room["serverDeck"] = [
            {
                id: "draw_1",
                templateId: "emp_01",
                type: CardType.HERO,
            },
        ];
        room.state.deckCount = 1;

        room["handleDrawCard"](client);

        expect(room.state.players.get("player_1")!.actionPoints).toBe(2);
        expect(room.state.deckCount).toBe(0);
    });

    test("Challenge/Modifier restano reaction-only fuori dalla reaction window", () => {
        const room = createDummyRoom();
        const client = createMockClient("player_1");
        const player = room.state.players.get("player_1")!;

        player.hand.push(createCard("mod_card", "mod_01", CardType.MODIFIER));
        room["handlePlayMagic"](client, { cardId: "mod_card" });

        const firstPacket = client.getLastPacket();
        expect(firstPacket?.event).toBe(ServerEvents.ERROR);
        expect((firstPacket?.data as any)?.code).toBe("REACTION_ONLY_WINDOW");
        expect((player.hand as any[]).length).toBe(1);

        client.clearLastPacket();
        player.hand.push(createCard("challenge_card", "rea_01", CardType.CHALLENGE));
        room["handlePlayMagic"](client, { cardId: "challenge_card" });

        const secondPacket = client.getLastPacket();
        expect(secondPacket?.event).toBe(ServerEvents.ERROR);
        expect((secondPacket?.data as any)?.code).toBe("REACTION_ONLY_WINDOW");
    });

    test("Item viene equipaggiato su Hero specifico dopo la risoluzione", () => {
        const room = createDummyRoom();
        const client = createMockClient("player_1");
        const player = room.state.players.get("player_1")!;

        const hero = createCard("hero_1", "emp_01", CardType.HERO);
        hero.isFaceUp = true;
        hero.name = "Hero One";
        player.company.push(hero);

        const item = createCard("item_1", "itm_01", CardType.ITEM);
        player.hand.push(item);

        room["handlePlayMagic"](client, {
            cardId: "item_1",
            targetHeroCardId: "hero_1",
        });

        expect(room.state.phase).toBe(GamePhase.REACTION_WINDOW);
        (room.clock as any).tick(5100);

        const equippedItems = (hero.equippedItems ?? []) as CardState[];
        expect(equippedItems.length).toBe(1);
        expect(equippedItems[0]?.templateId).toBe("itm_01");
    });

    test("monster board torna subito a 3 dopo una risoluzione riuscita", () => {
        const room = createDummyRoom();
        const player = room.state.players.get("player_1")!;

        const c1 = createCard("crs_inst_1", "crs_01", CardType.MONSTER);
        c1.targetRoll = 2;
        const c2 = createCard("crs_inst_2", "crs_02", CardType.MONSTER);
        c2.targetRoll = 2;
        const c3 = createCard("crs_inst_3", "crs_03", CardType.MONSTER);
        c3.targetRoll = 2;

        room.state.centralCrises.push(c1, c2, c3);
        const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);

        try {
            const result = room["applyCrisisResolution"]("player_1", "crs_inst_1");
            expect(result.success).toBe(true);
        } finally {
            randomSpy.mockRestore();
        }

        expect(player.score).toBeGreaterThanOrEqual(1);
        expect((room.state.centralCrises as any[]).length).toBe(3);
        expect((room.state.centralCrises as any[]).some((card) => card.id === "crs_inst_1")).toBe(false);
    });
});
