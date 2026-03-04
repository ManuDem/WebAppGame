import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { OfficeRoomState, PlayerState, CardState } from "../src/State";
import { GamePhase, ServerEvents, ClientMessages, CardType } from "../../shared/SharedTypes";
import assert from "assert";

console.log("🏃 Esecuzione Test QA Agente 4 - reaction_stress.test.ts...");

const createDummyRoom = () => {
    const room = new OfficeRoom();
    room.state = new OfficeRoomState();
    room.state.phase = GamePhase.PLAYER_TURN;

    // We need to mock broadcast since we're not attached to a server
    room.broadcast = () => { };

    // 1. Setup 3 players
    for (let i = 1; i <= 3; i++) {
        const p = new PlayerState();
        p.sessionId = `player_${i}`;
        p.username = `CEO_0${i}`;
        p.isConnected = true;
        p.actionPoints = 3;
        room.state.players.set(p.sessionId, p);
        room.state.playerOrder.push(p.sessionId);
    }

    room.state.currentTurnPlayerId = "player_1";
    room.state.turnIndex = 0;

    // Initialize required structures for Room
    room.state.actionStack = [];
    room["buildCardTemplateLookup"](); // Internal method to load templates

    // Ensure clock exists (Colyseus Room normally instantiates it)
    if (!room.clock) {
        room.clock = {
            setTimeout: (cb: Function, ms: number) => {
                return setTimeout(cb, ms);
            },
            clear: () => { }
        } as any;
    }

    return room;
};

const createMockClient = (sessionId: string) => {
    let lastPacket: any = null;
    return {
        sessionId,
        send: (ev: any, data: any) => { lastPacket = { ev, data }; },
        getLastPacket: () => lastPacket,
        clearPacket: () => { lastPacket = null; }
    } as any;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const runTests = async () => {
    try {
        console.log("\n▶️ 1. Stress-Test delle Race Conditions (Fase 4)");
        let room = createDummyRoom();

        const client1 = createMockClient("player_1");
        const client2 = createMockClient("player_2");
        const client3 = createMockClient("player_3");

        // Give player 1 an employee card
        const empCard = new CardState();
        empCard.id = "card_emp_1";
        empCard.templateId = "emp_01";
        empCard.type = CardType.EMPLOYEE;
        room.state.players.get("player_1")!.hand.push(empCard);

        // Give player 2 and 3 a reaction card
        const reactCard2 = new CardState();
        reactCard2.id = "card_react_2";
        reactCard2.templateId = "reac_01";
        reactCard2.type = CardType.REACTION;
        room.state.players.get("player_2")!.hand.push(reactCard2);

        const reactCard3 = new CardState();
        reactCard3.id = "card_react_3";
        reactCard3.templateId = "reac_02";
        reactCard3.type = CardType.REACTION;
        room.state.players.get("player_3")!.hand.push(reactCard3);

        // Player 1 plays employee
        room["handlePlayEmployee"](client1, { cardId: "card_emp_1" });
        assert.strictEqual(room.state.phase, GamePhase.REACTION_WINDOW, "Fase deve essere REACTION_WINDOW");
        assert.ok(room.state.pendingAction, "pendingAction deve essere popolato");
        assert.strictEqual(room.state.actionStack.length, 1, "actionStack deve avere 1 elemento");

        // Player 2 and 3 send reaction simultaneously
        await Promise.all([
            new Promise(resolve => {
                room["handlePlayReaction"](client2, { cardId: "card_react_2" });
                resolve(true);
            }),
            new Promise(resolve => {
                room["handlePlayReaction"](client3, { cardId: "card_react_3" });
                resolve(true);
            })
        ]);

        assert.strictEqual(room.state.actionStack.length, 3, "Entrambe le reazioni devono essere impilate nello stack");

        console.log("  ⏳ Attesa 5.1s per scadenza timer Reaction Window...");

        // Let the timeout expire naturally (we used real setTimeout in our mock if Colyseus clock isn't ticking)
        // Note: For real environment, we'd mock the timer to not wait 5s, but this is a node script to test behavior
        if (room.clock && typeof room.clock.tick === "function") {
            room.clock.tick(5100);
        } else {
            await sleep(5100);
        }

        assert.strictEqual(room.state.phase, GamePhase.PLAYER_TURN, "Il gioco deve tornare a PLAYER_TURN");
        assert.strictEqual(room.state.pendingAction, null, "pendingAction deve essere svuotato");
        assert.strictEqual(room.state.actionStack.length, 0, "actionStack deve essere svuotato");
        console.log("  ✅ Reazioni simultanee gestite e risolte correttamente.");


        console.log("\n▶️ 2. Test Rage Quit (Disconnessione in Reaction Window)");
        room = createDummyRoom();
        const client1Rq = createMockClient("player_1");

        const empCardRq = new CardState();
        empCardRq.id = "card_emp_1";
        empCardRq.templateId = "emp_01";
        empCardRq.type = CardType.EMPLOYEE;
        room.state.players.get("player_1")!.hand.push(empCardRq);

        room["handlePlayEmployee"](client1Rq, { cardId: "card_emp_1" });
        assert.strictEqual(room.state.phase, GamePhase.REACTION_WINDOW);

        // Player 2 disconnects
        const p2Session = "player_2";
        room.state.players.get(p2Session)!.isConnected = false; // Emulate onLeave sync
        console.log("  🛑 Player_2 disconnesso...");

        console.log("  ⏳ Attesa 5.1s per timer...");
        if (room.clock && typeof room.clock.tick === "function") {
            room.clock.tick(5100);
        } else {
            await sleep(5100);
        }

        assert.strictEqual(room.state.phase, GamePhase.PLAYER_TURN, "Timer deve scadere e resettare la fase nonostante la disconnessione");
        console.log("  ✅ Gioco prosegue senza blocchi (Server non crashato).");


        console.log("\n▶️ 3. Test Cheat: PLAY_REACTION fuori Reaction Window");
        room = createDummyRoom();
        const clientMalicious = createMockClient("player_2");

        const reactCardCheat = new CardState();
        reactCardCheat.id = "card_react_cheat";
        reactCardCheat.templateId = "reac_01";
        reactCardCheat.type = CardType.REACTION;
        room.state.players.get("player_2")!.hand.push(reactCardCheat);

        room["handlePlayReaction"](clientMalicious, { cardId: "card_react_cheat" });

        const errorPacket = clientMalicious.getLastPacket();
        assert.ok(errorPacket, "Il server deve rispondere con un pacchetto");
        assert.strictEqual(errorPacket.ev, ServerEvents.ERROR, "Deve essere di tipo ERROR");
        assert.strictEqual(errorPacket.data.code, "NO_REACTION_WINDOW", "Deve restituire NO_REACTION_WINDOW");
        assert.strictEqual(room.state.players.get("player_2")!.hand.length, 1, "La carta non deve essere stata spesa");
        console.log("  ✅ Cheat per Reaction fuori tempismo bloccato.");


        console.log("\n🧪 TUTTI I TEST DELLO STRESS-TEST SONO PASSATI (Verde)");

    } catch (e: any) {
        console.error(`\n❌ TEST FALLITO: ${e.message}`);
        console.error(e);
        process.exit(1);
    }
};

runTests();
