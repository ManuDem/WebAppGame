import { DeckManager } from "shared/DeckManager";
import { ICardData } from "shared/SharedTypes";

describe("DeckManager Pure Logic", () => {
    test("should create a shuffled deck of correct size", () => {
        const deck = DeckManager.createDeck();
        // Assuming cards_db.json has 15 items and 3 copies each = 45 cards
        expect(deck.length).toBeGreaterThan(0);
        expect(deck[0]?.id).toBeDefined();
        expect(deck[0]?.templateId).toBeDefined();
    });

    test("should draw a card and reduce deck size", () => {
        const deck = DeckManager.createDeck();
        const initialSize = deck.length;

        const card = DeckManager.drawCard(deck);
        expect(card).not.toBeNull();
        expect(deck.length).toBe(initialSize - 1);
    });

    test("should return null when trying to draw from empty deck", () => {
        const deck: ICardData[] = [];
        const card = DeckManager.drawCard(deck);
        expect(card).toBeNull();
    });
});

