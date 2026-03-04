# Feature 04: Integrazione Effetti delle Carte (Data Layer)

## 1. Obiettivo
In *LUCrAre: SEMPRE*, i comportamenti delle carte sono Data-Driven. Nessuna carta ha la sua logica hardcodata direttamente nei component. La sorgente di verità statica è `cards_db.json`. L'obiettivo del Data Layer (Agente 3) è tradurre il JSON in comportamenti eseguibili da `OfficeRoom` che mutino lo Stato.

## 2. Struttura del Database (cards_db.json)
Ogni entry in `cards_db.json` contiene un `id` (templateId), `name`, `type`, `cost`, `description` e un nodo `effect`.
Il nodo `effect` definisce un DSL (Domain Specific Language) semplificato:
- `action`: La tipologia di comportamento (es. `produce`, `steal_pa`, `cancel_effect`).
- Altri campi dipendenti dall'azione: `amount`, `target`, `resource`, `penalty`, `reward` ecc.

## 3. Parsing e Interfacce (Implementazione Agente 3)
L'Agente 3 dovrà implementare un CardEffectParser (`server/src/CardEffectParser.ts`) che esporrà metodi statici o istanziati per:
1. Validare un target.
2. Eseguire l'effetto della carta.

### Modifiche Necessarie a SharedTypes.ts
Per formalizzare il Data Layer, dovremo estendere il contratto inserendo (o definendo all'interno del DB) i tipi esatti di `Effect` supportati:

```typescript
export type TargetType = "self" | "opponent" | "opponent_hand" | "employee" | "win_condition" | "trick" | "another_opponent" | "played_card";
export type ActionType = "produce" | "protect" | "passive_bonus" | "discount_cost" | "draw_cards" | "steal_pa" | "steal_card" | "discard" | "trade_random" | "crisis_resolve" | "redirect_effect" | "steal_played_card" | "cancel_effect";

export interface ICardEffectDSL {
    action: ActionType;
    target?: TargetType;
    amount?: number;
    resource?: string;
    penalty?: string; // Es. "discard_2"
    reward?: string;  // Es. "vp_1"
    multiplier?: number;
}
```

## 4. Integrazione con OfficeRoom.ts
Quando un giocatore tenta di giocare una carta (es. tramite `PLAY_EMPLOYEE` e la finestra di reazione ha successo):
1. Recuperare l'`ICardData` dall'`hand` del giocatore.
2. Trovare il mapping del suo `templateId` nel DB (`cards_db.json`).
3. Passare la definizione dell'effetto (`ICardEffectDSL`) e il master state (o dei mutator) al resolver dell'Agente 3:
   `EffectResolver.resolve(effectDef, currentState, sourcePlayerId, targetCardId)`
4. L'`EffectResolver` modificherà l'`OfficeRoomState` (es aggiungendo carte pescate o rimuovendo PA).

## 5. Next Steps
L'Agente 3 dovrà scrivere la Factory o lo Strategy Pattern in TypeScript capace di tradurre questi nodi DSL in chiamate procedurali sicure, mentre l'Agente 0 continuerà a vigilare che non ci siano mutazioni esterne non previste.
