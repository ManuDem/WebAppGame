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

## M2 - Refactor logica per testabilita
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
Stato: `in_progress`

Scope previsto:
- mini-card + overlay carta grande
- hit areas mobile-first
- miglioramenti leggibilita board/hand

Avanzamento corrente (2026-03-04):
- pipeline artwork PNG pronta con fallback sicuro:
  - `client/src/ui/CardArtworkResolver.ts`
  - preload manifest in `client/src/scenes/BootScene.ts`
  - risoluzione on-demand da `/cards/{templateId}.png`
- mini-card migliorate:
  - artwork PNG quando disponibile, fallback procedurale altrimenti
  - testo compatto con preferenza `shortDesc`
  - badge equip per Hero con Item equipaggiati
- overlay inspect migliorato:
  - artwork reale quando disponibile
  - fallback grafico mantenuto
  - dettagli completi (target roll/modifier/subtype/equip count)
- targeting UX esteso:
  - Item -> selezione Hero (auto-target se 1 Hero, errore esplicito se 0 Hero)
  - Magic/Event target opponent -> feedback esplicito se nessun avversario disponibile

## M4 - Pixel art makeover
Stato: `in_progress`

Scope previsto:
- render crisp + scaling
- feedback visivo coerente
- layout anti-overlap mobile/landscape

Avanzamento corrente (2026-03-04):
- renderer Phaser aggiornato per look piu crisp:
  - `pixelArt: true`
  - `roundPixels: true`
  - `antialias` disattivato
- risoluzione renderer riequilibrata per ridurre blur e mantenere leggibilita.

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
