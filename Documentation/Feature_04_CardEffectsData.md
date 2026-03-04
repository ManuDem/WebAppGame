# Feature 04 - Data Layer Carte ed Effect Parser

Specifica operativa aggiornata.

## Obiettivo
Rendere gli effetti carta data-driven:
- definizione statica in `shared/cards_db.json`
- risoluzione logica in `shared/CardEffectParser.ts`
- mutazione authoritative finale in `server/src/rooms/OfficeRoom.ts`

## Fonte dati
`cards_db.json` contiene template con:
- `id`, `name`, `type`, `cost`, `description`
- `effect` (DSL)
- `visuals`

## DSL attuale
Tipi centrali in `shared/SharedTypes.ts`:
- `ActionType`
- `TargetType`
- `ICardEffectDSL`

Azioni presenti nel parser:
- `produce`
- `protect`
- `passive_bonus`
- `discount_cost`
- `draw_cards`
- `steal_pa`
- `steal_card`
- `discard`
- `trade_random`
- `crisis_resolve`
- `redirect_effect`
- `steal_played_card`
- `cancel_effect`

## Pipeline runtime
1. `OfficeRoom` trova il template dal `templateId`.
2. Durante reaction window crea/aggiorna `pendingAction` e `actionStack`.
3. In `resolvePhase()` chiama `CardEffectParser.resolveQueue(...)`.
4. Se necessario applica mutazioni strutturali schema-side (company/crisis).
5. Consuma tag `pending_draw_X` per pescare carte reali dal deck server.

## Note importanti
- Il parser e logic-first, agnostico da Phaser/Colyseus UI.
- Alcuni effetti producono tag in `activeEffects` che poi il server consuma.
- Esiste ancora debito tecnico su type safety (`any`) in alcune zone backend/shared.
