import { ICardData } from "./SharedTypes";
/**
 * DeckManager
 *
 * Game Logic class responsible for initializing the deck, shuffling,
 * and drawing cards. Pure functions, no dependency on Colyseus or Phaser.
 */
export declare class DeckManager {
    /**
     * Initializes a new deck from the cards_db.json file.
     * Generates UUIDs for each instantiated card and shuffles the deck.
     *
     * @returns ICardData[] An array of shuffled cards ready for the game server.
     */
    static createDeck(): ICardData[];
    /**
     * Draws a single card from the top of the deck (last element in array).
     *
     * @param deck The current active deck array (will be mutated).
     * @returns ICardData | null The drawn card, or null if deck is empty.
     */
    static drawCard(deck: ICardData[]): ICardData | null;
    /**
     * Fisher-Yates array shuffle.
     *
     * @param array The array to shuffle.
     * @returns The shuffled array.
     */
    private static shuffle;
    /**
     * Basic UUID generator since we want this pure logic class to be environment-agnostic.
     */
    private static generateUUID;
}
//# sourceMappingURL=DeckManager.d.ts.map