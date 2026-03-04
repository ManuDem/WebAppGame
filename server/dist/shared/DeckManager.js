"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckManager = void 0;
const cards_db_json_1 = __importDefault(require("./cards_db.json"));
/**
 * DeckManager
 *
 * Game Logic class responsible for initializing the deck, shuffling,
 * and drawing cards. Pure functions, no dependency on Colyseus or Phaser.
 */
class DeckManager {
    /**
     * Initializes a new deck from the cards_db.json file.
     * Generates UUIDs for each instantiated card and shuffles the deck.
     *
     * @returns ICardData[] An array of shuffled cards ready for the game server.
     */
    static createDeck() {
        const deck = [];
        if (!Array.isArray(cards_db_json_1.default) || cards_db_json_1.default.length === 0) {
            console.error("[DeckManager] cards_db.json is missing, invalid or empty. Returning empty deck.");
            return deck;
        }
        // Let's create a temporary deck by adding multiple copies of the cards
        // to have a decent deck size (e.g. 3 copies of each test card = 45 cards)
        const COPIES_PER_CARD = 3;
        for (const template of cards_db_json_1.default) {
            if (!template || typeof template.id !== "string") {
                console.warn("[DeckManager] Skipping invalid template entry in cards_db.json:", template);
                continue;
            }
            for (let i = 0; i < COPIES_PER_CARD; i++) {
                const card = {
                    id: this.generateUUID(),
                    templateId: template.id,
                    type: template.type,
                    costPA: template.cost,
                    isFaceUp: false // Hidden in deck / hand by default
                };
                deck.push(card);
            }
        }
        if (deck.length === 0) {
            console.error("[DeckManager] No valid card templates found in cards_db.json. Returning empty deck.");
            return deck;
        }
        return this.shuffle(deck);
    }
    /**
     * Draws a single card from the top of the deck (last element in array).
     *
     * @param deck The current active deck array (will be mutated).
     * @returns ICardData | null The drawn card, or null if deck is empty.
     */
    static drawCard(deck) {
        if (!deck || deck.length === 0) {
            return null;
        }
        // pop() removes and returns the last element, simulating drawing from top
        return deck.pop() || null;
    }
    /**
     * Fisher-Yates array shuffle.
     *
     * @param array The array to shuffle.
     * @returns The shuffled array.
     */
    static shuffle(array) {
        let currentIndex = array.length, randomIndex;
        // While there remain elements to shuffle.
        while (currentIndex !== 0) {
            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex],
                array[currentIndex]
            ];
        }
        return array;
    }
    /**
     * Basic UUID generator since we want this pure logic class to be environment-agnostic.
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
exports.DeckManager = DeckManager;
//# sourceMappingURL=DeckManager.js.map