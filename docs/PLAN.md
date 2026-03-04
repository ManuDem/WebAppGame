# PLAN - Stato Milestone

Piano operativo aggiornato come living document.

## M0 - Baseline & Mapping
Stato: `completata`

Output:
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- mappa avvio/progetto/documentazione

Verifica:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`

## M1 - Specifica regole semplificate
Stato: `completata`

Output:
- `docs/GDD.md` compilato con:
  - as-is dal codice
  - variante semplificata scelta
  - decision log A/B/C
  - impatto tecnico sui file reali

Acceptance:
- regole allineate all'implementazione corrente
- nessun placeholder vuoto per le sezioni critiche M1

## M2 - Refactor logica per testabilità
Stato: `completata`

Output:
- logica estratta da `OfficeRoom` verso `server/src/game/*`:
  - `turnFlow.ts`
  - `winConditions.ts`
  - `monsterBoard.ts`
  - `reactionResolution.ts`
  - `itemEquip.ts`
- `OfficeRoom` mantenuta come orchestratore rete/stato authoritative
- decisioni A/B/C applicate server-side
- nuovi test mirati:
  - `server/tests/gameplay_foundation.test.ts`

Comandi verifica M2:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `npm.cmd test -- --runInBand --forceExit server/tests/gameplay_foundation.test.ts`

Acceptance:
- smoke suite stabile verde
- test nuovi verdi su AP, reaction-only, item equip su Hero, monster refill

## M3 - UI/UX carte
Stato: `pending`

Scope previsto:
- mini-card + overlay carta grande
- hit areas mobile-first
- miglioramenti leggibilità board/hand

## M4 - Pixel art makeover
Stato: `pending`

Scope previsto:
- render crisp + scaling
- feedback visivo coerente
- layout anti-overlap mobile/landscape

## M5 - i18n IT/EN completo
Stato: `pending`

Scope previsto:
- centralizzazione stringhe residue
- copertura completa scene UI
- persistenza lingua

## M6 - QA finale
Stato: `pending`

Scope previsto:
- `docs/QA.md`
- playtest checklist completa
- bug bloccanti finali

## Decisioni bloccanti (attive)

- A: Challenge/Modifier reaction-only; Magic attiva.
- B: Item su Hero specifico, fallback player-level solo temporaneo.
- C: Monster board sempre a 3 con refill immediato.
