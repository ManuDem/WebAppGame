import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { OfficeRoomState, PlayerState, CardState } from "../src/State";
import { GamePhase, ServerEvents, ClientMessages, CardType } from "../../shared/SharedTypes";
import assert from "assert";

console.log("🏃 Esecuzione Test QA Agente 4 - win_conditions.test.ts (Fase 5 - End to End)...");

const STARTING_HAND_SIZE = 5;

const createDummyRoom = () => {
    const room = new OfficeRoom();
    room.state = new OfficeRoomState();
    room.state.phase = GamePhase.PLAYER_TURN;

    // We need to mock broadcast since we're not attached to a server
    room.broadcast = (type: any, message: any) => {
        if (!(room as any)["__broadcasts"]) (room as any)["__broadcasts"] = [];
        (room as any)["__broadcasts"].push({ type, message });
    };

    // 1. Setup 2 players
    for (let i = 1; i <= 2; i++) {
        const p = new PlayerState();
        p.sessionId = `player_${i}`;
        p.username = `CEO_0${i}`;
        p.isConnected = true;
        p.actionPoints = 10; // Give plenty of AP
        room.state.players.set(p.sessionId, p);
        room.state.playerOrder.push(p.sessionId);
    }

    room.state.currentTurnPlayerId = "player_1";
    room.state.turnIndex = 0;

    // Initialize required structures for Room
    room.state.actionStack = [];
    room["buildCardTemplateLookup"](); // Internal method to load templates

    // Ensure clock exists
    if (!room.clock) {
        let currentTime = 0;
        room.clock = {
            setTimeout: (cb: any, ms: number) => {
                let timeoutId = setTimeout(cb, ms);
                if (!(room as any)["__timeouts"]) (room as any)["__timeouts"] = [];
                (room as any)["__timeouts"].push({ id: timeoutId, cb, time: currentTime + ms });
                return { clear: () => clearTimeout(timeoutId) };
            },
            tick: (ms: number) => {
                currentTime += ms;
                const toRun = (room as any)["__timeouts"]?.filter((t: any) => t.time <= currentTime) || [];
                (room as any)["__timeouts"] = (room as any)["__timeouts"]?.filter((t: any) => t.time > currentTime) || [];
                toRun.forEach((t: any) => { clearTimeout(t.id); t.cb(); });
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

const createCard = (id: string, templateId: string, type: CardType) => {
    const card = new CardState();
    card.id = id;
    card.templateId = templateId;
    card.type = type;
    return card;
};

const runTests = async () => {
    try {
        console.log("\n▶️ TASK 1: Test End-to-End Win Condition 'Monopolio Umano'");
        let room = createDummyRoom();
        const client1 = createMockClient("player_1");

        // Give 5 employees
        for (let i = 1; i <= 5; i++) {
            room.state.players.get("player_1")!.hand.push(createCard(`emp_${i}`, "emp_01", CardType.EMPLOYEE));
        }

        // Play 5 employees
        for (let i = 1; i <= 5; i++) {
            (room as any)["handlePlayEmployee"](client1, { cardId: `emp_${i}` });
            if (room.clock && typeof (room.clock as any).tick === "function") {
                (room.clock as any).tick(5100);
            }
            assert.strictEqual(room.state.phase, i < 5 ? GamePhase.PLAYER_TURN : GamePhase.GAME_OVER, `Fase dopo dipendente ${i}`);
        }

        assert.strictEqual(room.state.winnerId, "player_1", "WinnerId deve essere player_1");
        const winBroadcast = (room as any)["__broadcasts"].find((b: any) => b.type === ServerEvents.GAME_WON);
        assert.ok(winBroadcast, "Broadcast GAME_WON non emesso");
        assert.strictEqual(winBroadcast.message.winnerId, "player_1");
        console.log("  ✅ Monopolio Umano Win Condition superata.");


        console.log("\n▶️ TASK 2: Test End-to-End Win Condition 'Problem Solver'");
        room = createDummyRoom();
        const client1_2 = createMockClient("player_1");
        // Give 3 crises on the table
        room.state.centralCrises.push(createCard("crs_inst_1", "crs_01", CardType.IMPREVISTO));
        room.state.centralCrises.push(createCard("crs_inst_2", "crs_02", CardType.IMPREVISTO));
        room.state.centralCrises.push(createCard("crs_inst_3", "crs_03", CardType.IMPREVISTO));

        for (let i = 1; i <= 3; i++) {
            (room as any)["handleSolveCrisis"](client1_2, { crisisId: `crs_inst_${i}` });
            if (room.clock && typeof (room.clock as any).tick === "function") {
                (room.clock as any).tick(5100);
            }
        }

        assert.strictEqual(room.state.phase, GamePhase.GAME_OVER);
        assert.strictEqual(room.state.winnerId, "player_1");
        console.log("  ✅ Problem Solver Win Condition superata.");


        console.log("\n▶️ TASK 3: Test delle Penalità Crisi");
        room = createDummyRoom();
        const client1_3 = createMockClient("player_1");
        const p1 = room.state.players.get("player_1")!;
        const p2 = room.state.players.get("player_2")!;

        // Crisi 1: Ispezione della Finanza (discard_2)
        room.state.centralCrises.push(createCard("c1", "crs_01", CardType.IMPREVISTO)); // discard_2
        p2.hand.push(createCard("h1", "emp_01", CardType.EMPLOYEE));
        p2.hand.push(createCard("h2", "emp_01", CardType.EMPLOYEE));
        p2.hand.push(createCard("h3", "emp_01", CardType.EMPLOYEE));
        assert.strictEqual(p2.hand.length, 3);

        (room as any)["handleSolveCrisis"](client1_3, { crisisId: "c1" });
        if (room.clock && typeof (room.clock as any).tick === "function") (room.clock as any).tick(5100);

        assert.strictEqual(p2.hand.length, 1, "Player 2 deve aver perso 2 carte dalla mano");
        console.log("  ✅ Penalità discard_2 applicata correttamente.");

        // Crisi 2: Server in Fiamme (lose_employee)
        room.state.centralCrises.push(createCard("c2", "crs_02", CardType.IMPREVISTO)); // lose_employee
        p2.company.push(createCard("comp1", "emp_01", CardType.EMPLOYEE));
        p2.company.push(createCard("comp2", "emp_01", CardType.EMPLOYEE));
        assert.strictEqual(p2.company.length, 2);

        (room as any)["handleSolveCrisis"](client1_3, { crisisId: "c2" });
        if (room.clock && typeof (room.clock as any).tick === "function") (room.clock as any).tick(5100);

        assert.strictEqual(p2.company.length, 1, "Player 2 deve aver perso un dipendente nella company");
        console.log("  ✅ Penalità lose_employee applicata correttamente.");


        console.log("\n▶️ TASK 4: Test del Target Trick");
        room = createDummyRoom();
        const client1_4 = createMockClient("player_1");
        const p1_4 = room.state.players.get("player_1")!;
        const p2_4 = room.state.players.get("player_2")!;

        p1_4.hand.push(createCard("trk1", "trk_01", CardType.EVENTO)); // Falso in Bilancio, steal_pa
        p1_4.hand.push(createCard("trk2", "trk_01", CardType.EVENTO)); // For the missing target test
        p2_4.actionPoints = 3;

        // Falso in Bilancio WITH target
        (room as any)["handlePlayMagic"](client1_4, { cardId: "trk1", targetPlayerId: "player_2" });
        if (room.clock && typeof (room.clock as any).tick === "function") (room.clock as any).tick(5100); // Wait just in case it triggers, though magic is immediate

        assert.strictEqual(p2_4.actionPoints, 1, "Player 2 deve aver perso 2 PA");
        console.log("  ✅ Trucco con targetPlayerId applicato correttamente.");

        // Falso in Bilancio WITHOUT target
        (room as any)["handlePlayMagic"](client1_4, { cardId: "trk2" });
        const lastPacket = client1_4.getLastPacket();
        assert.ok(lastPacket, "Ci deve essere un pacchetto di risposta per l'errore");
        assert.strictEqual(lastPacket.ev, ServerEvents.ERROR);
        assert.strictEqual(lastPacket.data.code, "MISSING_TARGET");
        console.log("  ✅ Errore MISSING_TARGET lanciato correttamente se target obbligatorio omesso.");


        console.log("\n🧪 TUTTI I TEST END-TO-END SONO PASSATI (Verde)");
        process.exit(0);

    } catch (e: any) {
        console.error(`\n❌ TEST FALLITO: ${e.message}`);
        console.error(e);
        process.exit(1);
    }
};

runTests();
