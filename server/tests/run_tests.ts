import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { OfficeRoomState, PlayerState } from "../src/State";
import { GamePhase, ServerEvents } from "../../shared/SharedTypes";
import assert from "assert";

console.log("🏃 Esecuzione Test QA Agente 4 (Senza Framework)...");

try {
    // --- LOBBY AND CONNECTION ---
    console.log("\n▶️ Test Lobby e Connessioni (Feature 01)");
    let room = new OfficeRoom();
    room.state = new OfficeRoomState();

    // Auth fallisce se manca nome
    assert.throws(() => room.onAuth({} as any, {} as any, {} as any), /Nome CEO mancante/);
    console.log("  ✅ Rifiuta senza nome");

    // Auth fallisce se nome vuoto
    assert.throws(() => room.onAuth({} as any, { ceoName: "" }, {} as any), /Nome CEO mancante/);
    console.log("  ✅ Rifiuta nome vuoto");

    // Auth fallisce se nome corto
    assert.throws(() => room.onAuth({} as any, { ceoName: "Ab" }, {} as any), /compreso tra 3 e 15/);
    console.log("  ✅ Rifiuta nome corto");

    // Auth fallisce se nome lungo
    assert.throws(() => room.onAuth({} as any, { ceoName: "QuestoNomeETroppoLungo" }, {} as any), /compreso tra 3 e 15/);
    console.log("  ✅ Rifiuta nome lungo");

    // Auth fallisce se caratteri non alfanumerici
    assert.throws(() => room.onAuth({} as any, { ceoName: "CEO Boss!" }, {} as any), /solo caratteri alfanumerici/);
    console.log("  ✅ Rifiuta caratteri speciali");

    // Auth accetta nome valido
    const authRes = room.onAuth({} as any, { ceoName: "ValidCEO" }, {} as any);
    assert.strictEqual((authRes as any).ceoName, "ValidCEO");
    console.log("  ✅ Accetta nome valido");

    // --- CORE LOOP ---
    console.log("\n▶️ Test Core Loop, Turni e PA (Feature 02)");
    room = new OfficeRoom();
    room.state = new OfficeRoomState();
    room.state.phase = GamePhase.PLAYER_TURN;

    const p1 = new PlayerState(); p1.sessionId = "client_A"; p1.isConnected = true; p1.actionPoints = 3;
    const p2 = new PlayerState(); p2.sessionId = "client_B"; p2.isConnected = true; p2.actionPoints = 0;

    room.state.players.set("client_A", p1);
    room.state.players.set("client_B", p2);
    room.state.playerOrder = ["client_A", "client_B"];
    room.state.currentTurnPlayerId = "client_A";
    room.state.turnIndex = 0;
    room["serverDeck"] = [{ id: "c1", templateId: "x", type: "EMPLOYEE" as any }];
    room.state.deckCount = 1;

    // Test DRAW_CARD wrong turn
    let clientBPacket: any = null;
    const clientB = {
        sessionId: "client_B",
        send: (ev: any, data: any) => { clientBPacket = { ev, data }; }
    } as any;

    room["handleDrawCard"](clientB);
    assert.strictEqual(clientBPacket.ev, ServerEvents.ERROR);
    assert.strictEqual(clientBPacket.data.code, "NOT_YOUR_TURN");
    assert.strictEqual(room.state.deckCount, 1);
    console.log("  ✅ Rifiuta DRAW_CARD fuori turno");

    // Test DRAW_CARD no PA
    room.state.players.get("client_A")!.actionPoints = 0;
    let clientAPacket: any = null;
    const clientA = {
        sessionId: "client_A",
        send: (ev: any, data: any) => { clientAPacket = { ev, data }; }
    } as any;

    room["handleDrawCard"](clientA);
    assert.strictEqual(clientAPacket.ev, ServerEvents.ERROR);
    assert.strictEqual(clientAPacket.data.code, "NO_PA");
    assert.strictEqual(room.state.deckCount, 1);
    console.log("  ✅ Rifiuta DRAW_CARD se PA esauriti");

    // Test DRAW_CARD success
    room.state.players.get("client_A")!.actionPoints = 3;
    room["handleDrawCard"](clientA);
    assert.strictEqual(clientAPacket.ev, ServerEvents.CARD_DRAWN);
    assert.strictEqual(room.state.players.get("client_A")!.actionPoints, 2);
    assert.strictEqual(room.state.deckCount, 0);
    console.log("  ✅ Accetta DRAW_CARD valido, scala 1 PA e diminuisce mazze");

    // Test turn passing
    let broadcastPacket: any = null;
    room.broadcast = (ev: any, data: any) => { broadcastPacket = { ev, data }; }
    room["handleEndTurn"](clientA);
    assert.strictEqual(room.state.currentTurnPlayerId, "client_B");
    assert.strictEqual(room.state.players.get("client_B")!.actionPoints, 3);
    assert.strictEqual(broadcastPacket.ev, ServerEvents.TURN_STARTED);
    console.log("  ✅ Passaggio turno corretto e assegnazione automatica dei 3 PA");

    console.log("\n🧪 TUTTI I TEST SONO PASSATI (Verde)");

} catch (e: any) {
    console.error(`\n❌ TEST FALLITO: ${e.message}`);
    console.error(e);
    process.exit(1);
}
