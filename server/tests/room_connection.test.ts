import { Server, Room } from "colyseus";
import { LocalPresence } from "@colyseus/core";
import { OfficeRoom } from "../src/rooms/OfficeRoom";

// Utility for mocking a Colyseus client joining locally (Integration test approach)
// Note: per una fully test suite su Colyseus si consiglia l'uso di un client WebSocket reale 
// o @colyseus/testing setup corretto del lifecycle. Questo script rappresenta uno scheletro 
// logico funzionante per il validate del GamePhase e dei Tipi.

describe("Feature 01: Room Connection and Lobby Validation", () => {

    // Per test unitari sulla validazione auth, possiamo chiamare direttamente i metodi della stanza
    let room: OfficeRoom;

    beforeEach(() => {
        room = new OfficeRoom();
        // Mock deps per chiamate dirette
        room.state = {} as any;
        room.clock = { setTimeout: jest.fn() } as any;
    });

    test("onAuth deve fallire se ceoName manca", () => {
        expect(() => {
            room.onAuth({} as any, {}, {} as any);
        }).toThrow("Nome CEO mancante.");
    });

    test("onAuth deve fallire se ceoName è vuoto", () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: "" }, {} as any);
        }).toThrow("Nome CEO mancante.");
    });

    test("onAuth deve fallire se ceoName è troppo corto", () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: "Ed" }, {} as any);
        }).toThrow("Il nome CEO deve essere compreso tra 3 e 15 caratteri.");
    });

    test("onAuth deve fallire se ceoName è troppo lungo", () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: "UnNomeEstremamenteLungo" }, {} as any);
        }).toThrow("Il nome CEO deve essere compreso tra 3 e 15 caratteri.");
    });

    test("onAuth deve fallire se ceoName contiene caratteri non alfanumerici", () => {
        expect(() => {
            room.onAuth({} as any, { ceoName: "CEO Boss!" }, {} as any);
        }).toThrow("Il nome CEO può contenere solo caratteri alfanumerici");
    });

    test("onAuth deve ritornare i dati se ceoName è valido", () => {
        const result = room.onAuth({} as any, { ceoName: "ValidCEO123" }, {} as any);
        expect(result).toEqual({ ceoName: "ValidCEO123" });
    });
});
