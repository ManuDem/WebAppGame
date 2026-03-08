import { CardEffectParser } from "shared/CardEffectParser";
import type { IGameState, IPlayer, IPendingAction, ICardTemplate } from "shared/SharedTypes";
import { GamePhase, CardType, ClientMessages } from "shared/SharedTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(sessionId: string, overrides: Partial<IPlayer> = {}): IPlayer {
    return {
        sessionId,
        username: `User_${sessionId}`,
        isReady: true,
        isConnected: true,
        actionPoints: 3,
        hand: [],
        company: [],
        score: 0,
        victories: 0,
        activeEffects: [],
        ...overrides
    };
}

function makeGameState(players: IPlayer[], overrides: Partial<IGameState> = {}): IGameState {
    const map = new Map<string, IPlayer>();
    players.forEach(p => map.set(p.sessionId, p));
    return {
        phase: GamePhase.PLAYER_TURN,
        players: map,
        hostSessionId: players[0]?.sessionId ?? "",
        playerOrder: players.map(p => p.sessionId),
        currentTurnPlayerId: players[0]?.sessionId ?? "",
        turnIndex: 0,
        centralCrises: [],
        deckCount: 40,
        actionStack: [],
        pendingAction: null,
        reactionEndTime: 0,
        turnNumber: 1,
        ...overrides
    };
}

function makePendingAction(overrides: Partial<IPendingAction> = {}): IPendingAction {
    return {
        id: `pa_${Date.now()}`,
        playerId: "p1",
        actionType: ClientMessages.PLAY_MAGIC,
        timestamp: Date.now(),
        ...overrides
    };
}

function makeCardTemplate(effect: ICardTemplate["effect"]): ICardTemplate {
    return {
        id: `tpl_${effect.action}`,
        name: `Test Card [${effect.action}]`,
        type: "trick",
        cost: 1,
        shortDesc: "test",
        description: "Test card",
        effect,
        visuals: { bgColorHex: "#000000", iconName: "test", particleColor: "#ffffff" }
    };
}

// ---------------------------------------------------------------------------
// Shared state for all tests
// ---------------------------------------------------------------------------

let p1: IPlayer;
let p2: IPlayer;
let state: IGameState;

beforeEach(() => {
    p1 = makePlayer("p1");
    p2 = makePlayer("p2");
    state = makeGameState([p1, p2]);
});

// ---------------------------------------------------------------------------
// SUITE 1 — Individual effect resolvers
// ---------------------------------------------------------------------------

describe("CardEffectParser.resolve — individual effects", () => {

    test("produce: +1 PA to source", () => {
        const card = makeCardTemplate({ action: "produce", amount: 1, resource: "pa" });
        expect(CardEffectParser.resolve(card, p1, null, state)).toBe(true);
        expect(p1.actionPoints).toBe(4);
    });

    // ----- steal_pa -----

    test("steal_pa: steals up to available PA (normal case)", () => {
        const card = makeCardTemplate({ action: "steal_pa", amount: 2 });
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
        expect(p2.actionPoints).toBe(1);   // 3 - 2
        expect(p1.actionPoints).toBe(5);   // 3 + 2
    });

    test("steal_pa: target has 0 PA — no negative, steals 0", () => {
        p2.actionPoints = 0;
        const card = makeCardTemplate({ action: "steal_pa", amount: 3 });
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
        expect(p2.actionPoints).toBe(0);
        expect(p1.actionPoints).toBe(3);
    });

    test("steal_pa: target has fewer PA than amount — clamped", () => {
        p2.actionPoints = 1;
        const card = makeCardTemplate({ action: "steal_pa", amount: 5 });
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
        expect(p2.actionPoints).toBe(0);
        expect(p1.actionPoints).toBe(4);
    });

    test("steal_pa: no target — returns false", () => {
        const card = makeCardTemplate({ action: "steal_pa", amount: 2 });
        expect(CardEffectParser.resolve(card, p1, null, state)).toBe(false);
    });

    test("steal_pa: viene bloccato da 'protected' e consuma lo scudo", () => {
        p2.activeEffects = ["protected"];
        const card = makeCardTemplate({ action: "steal_pa", amount: 2 });
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
        expect(p2.actionPoints).toBe(3);
        expect(p1.actionPoints).toBe(3);
        expect(p2.activeEffects).not.toContain("protected");
    });

    // ----- steal_card -----

    test("steal_card: empty hand does NOT crash, returns false", () => {
        p2.hand = [];
        const card = makeCardTemplate({ action: "steal_card", amount: 1 });
        expect(() => CardEffectParser.resolve(card, p1, p2, state)).not.toThrow();
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(false);
    });

    test("steal_card: steals 1 card from non-empty hand", () => {
        p2.hand = [{ id: "c1", templateId: "emp_01", type: CardType.EMPLOYEE }];
        const card = makeCardTemplate({ action: "steal_card", amount: 1 });
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
        expect(p2.hand.length).toBe(0);
        expect(p1.hand.length).toBe(1);
        expect(p1.hand[0]?.id).toBe("c1");
    });

    // ----- protect -----

    test("protect: adds 'protected' tag to target", () => {
        const card = makeCardTemplate({ action: "protect", target: "employee", amount: 1 });
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
        expect(p2.activeEffects).toContain("protected");
    });

    test("protect: falls back to source if no target", () => {
        const card = makeCardTemplate({ action: "protect", target: "employee", amount: 1 });
        expect(CardEffectParser.resolve(card, p1, null, state)).toBe(true);
        expect(p1.activeEffects).toContain("protected");
    });

    // ----- passive_bonus -----

    test("passive_bonus: adds 'win_multiplier_2' tag", () => {
        const card = makeCardTemplate({ action: "passive_bonus", target: "win_condition", multiplier: 2 });
        expect(CardEffectParser.resolve(card, p1, null, state)).toBe(true);
        expect(p1.activeEffects).toContain("win_multiplier_2");
    });

    // ----- discount_cost -----

    test("discount_cost: adds 'discount_trick_2' tag", () => {
        const card = makeCardTemplate({ action: "discount_cost", target: "trick", amount: 2 });
        expect(CardEffectParser.resolve(card, p1, null, state)).toBe(true);
        expect(p1.activeEffects).toContain("discount_trick_2");
    });

    // ----- trade_random -----

    test("trade_random: bidirectional swap", () => {
        p1.hand = [{ id: "src_card", templateId: "trk_01", type: CardType.EVENTO }];
        p2.hand = [{ id: "tgt_card", templateId: "trk_02", type: CardType.EVENTO }];
        const card = makeCardTemplate({ action: "trade_random" });
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
        expect(p1.hand.length).toBe(1);
        expect(p2.hand.length).toBe(1);
        expect(p1.hand[0]?.id).toBe("tgt_card");
        expect(p2.hand[0]?.id).toBe("src_card");
    });

    test("trade_random: no crash when hands are empty", () => {
        p1.hand = [];
        p2.hand = [];
        const card = makeCardTemplate({ action: "trade_random" });
        expect(() => CardEffectParser.resolve(card, p1, p2, state)).not.toThrow();
        expect(CardEffectParser.resolve(card, p1, p2, state)).toBe(true);
    });

    // ----- cancel_effect -----

    test("cancel_effect: sets isCancelled=true on passed pendingAction", () => {
        const pa = makePendingAction({ playerId: "p1", targetCardId: "trk_01" });
        const card = makeCardTemplate({ action: "cancel_effect", target: "played_card" });
        expect(CardEffectParser.resolve(card, p1, null, state, pa)).toBe(true);
        expect(pa.isCancelled).toBe(true);
    });

    // ----- steal_played_card -----

    test("steal_played_card: cancels pending action", () => {
        const pa = makePendingAction({ playerId: "p1", targetCardId: "emp_01" });
        const card = makeCardTemplate({ action: "steal_played_card", target: "self" });
        expect(CardEffectParser.resolve(card, p2, null, state, pa)).toBe(true);
        expect(pa.isCancelled).toBe(true);
    });

    test("steal_played_card: mantiene il tipo reale della carta rubata", () => {
        const pa = makePendingAction({
            playerId: "p1",
            actionType: ClientMessages.PLAY_MAGIC,
            targetCardId: "itm_01",
        });
        const card = makeCardTemplate({ action: "steal_played_card", target: "self" });
        expect(CardEffectParser.resolve(card, p2, null, state, pa)).toBe(true);
        expect(p2.hand.length).toBeGreaterThan(0);
        const stolen = p2.hand[p2.hand.length - 1];
        expect(stolen?.templateId).toBe("itm_01");
        expect(stolen?.type).toBe(CardType.ITEM);
    });
    // ----- crisis_resolve (server-authoritative) -----

    test("crisis_resolve: parser branch is acknowledged, structural effects are delegated to Room", () => {
        // Give p2 (potential victim) 3 cards
        p2.hand = [
            { id: "v1", templateId: "emp_01", type: CardType.EMPLOYEE },
            { id: "v2", templateId: "emp_02", type: CardType.EMPLOYEE },
            { id: "v3", templateId: "emp_03", type: CardType.EMPLOYEE },
        ];
        // Give p1 (potential solver) 2 cards
        p1.hand = [
            { id: "s1", templateId: "trk_01", type: CardType.EVENTO },
            { id: "s2", templateId: "trk_02", type: CardType.EVENTO },
        ];

        const card = makeCardTemplate({
            action: "crisis_resolve",
            reward: "vp_1",
            penalty: "discard_2"
        });

        const success = CardEffectParser.resolve(card, p1, null, state);
        expect(success).toBe(true);
        // No structural mutation at parser level (handled by OfficeRoom)
        expect(p1.score).toBe(0);
        expect(p1.hand.length).toBe(2);
        expect(p2.hand.length).toBe(3);
    });
    // ----- draw_cards -----

    test("draw_cards: adds 'pending_draw_2' tag to activeEffects", () => {
        const card = makeCardTemplate({ action: "draw_cards", amount: 2 });
        const success = CardEffectParser.resolve(card, p1, null, state);
        expect(success).toBe(true);
        expect(p1.activeEffects).toContain("pending_draw_2");
    });
});

// ---------------------------------------------------------------------------
// SUITE 2 — resolveQueue LIFO integration tests
// ---------------------------------------------------------------------------

describe("CardEffectParser.resolveQueue — LIFO reaction chain", () => {

    test("LIFO: last reaction cancel_effect blocks original steal_pa — success=false, no PA stolen", () => {
        const originalAction = makePendingAction({
            id: "orig_001",
            playerId: "p1",
            actionType: ClientMessages.PLAY_MAGIC,
            targetCardId: "trk_01",
            targetPlayerId: "p2"
        });

        const reaction0 = makePendingAction({
            id: "reac_000",
            playerId: "p2",
            actionType: ClientMessages.PLAY_REACTION,
            targetCardId: "rea_steal_pa"
        });

        const reaction1 = makePendingAction({
            id: "reac_001",
            playerId: "p1",
            actionType: ClientMessages.PLAY_REACTION,
            targetCardId: "rea_03"
        });

        const stealPACard = makeCardTemplate({ action: "steal_pa", amount: 2 });
        const cancelCard = makeCardTemplate({ action: "cancel_effect", target: "played_card" });
        const reactionStealCard = makeCardTemplate({ action: "steal_pa", amount: 1 });
        reactionStealCard.id = "rea_steal_pa";
        cancelCard.id = "rea_03";
        stealPACard.id = "trk_01";

        const p1Before = p1.actionPoints;
        const p2Before = p2.actionPoints;

        const result = CardEffectParser.resolveQueue(
            originalAction,
            [reaction0, reaction1],
            state
        );

        expect(result.success).toBe(false);
        expect(originalAction.isCancelled).toBe(true);
        expect(p2.actionPoints).toBe(p2Before);
        expect(p1.actionPoints).toBe(p1Before);
    });

    test("resolveQueue: no reactions — original action executes", () => {
        const originalAction = makePendingAction({
            id: "orig_002",
            playerId: "p1",
            actionType: ClientMessages.PLAY_MAGIC,
            targetCardId: "trk_01",
            targetPlayerId: "p2"
        });

        const stealPACard = makeCardTemplate({ action: "steal_pa", amount: 2 });
        stealPACard.id = "trk_01";

        const result = CardEffectParser.resolveQueue(
            originalAction,
            [],
            state
        );

        expect(result.success).toBe(true);
        expect(p2.actionPoints).toBe(1);
        expect(p1.actionPoints).toBe(5);
    });

    test("resolveQueue: logs are populated and non-empty", () => {
        const originalAction = makePendingAction({
            id: "orig_003",
            playerId: "p1",
            actionType: ClientMessages.PLAY_MAGIC,
            targetCardId: "emp_01"
        });

        const result = CardEffectParser.resolveQueue(
            originalAction,
            [],
            state
        );

        expect(result.log.length).toBeGreaterThan(0);
        expect(result.log[0]).toContain("[resolveQueue]");
    });

    test("LIFO: PLAY_EMPLOYEE cancelled by reaction — success: false, not added to company", () => {
        const originalAction = makePendingAction({
            id: "orig_emp_01",
            playerId: "p1",
            actionType: ClientMessages.PLAY_EMPLOYEE,
            targetCardId: "emp_01"
        });

        const reactionAction = makePendingAction({
            id: "reac_cancel",
            playerId: "p2",
            actionType: ClientMessages.PLAY_REACTION,
            targetCardId: "rea_03"
        });

        const result = CardEffectParser.resolveQueue(
            originalAction,
            [reactionAction],
            state
        );

        expect(result.success).toBe(false);
        expect(originalAction.isCancelled).toBe(true);
        expect(p1.company.length).toBe(0);
        expect(p1.score).toBe(0);
    });
});


