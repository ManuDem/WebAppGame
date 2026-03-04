# PLAN

Piano milestone approvato. Focus: mantenere il core loop semplificato Here To Slay e rifinire UX/mobile + testabilita.

## Milestone 0 - Baseline & Mapping

Output atteso:
- `docs/ARCHITECTURE.md` aggiornato
- `AGENTS.md` in root
- procedura riproduzione partita documentata

File coinvolti:
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.md`

Comandi verifica:
```bash
cd server && npm run build
cd client && npm run build
```

Acceptance:
- comandi reali presenti
- mappa scene/network/state/deck chiara

## Milestone 1 - Specifica regole semplificate

Output atteso:
- `docs/GDD.md` con:
  - as-is dal codice
  - varianti proposte
  - variante scelta
  - rischi di bilanciamento + piano test

File coinvolti:
- `docs/GDD.md`
- riferimenti: `shared/SharedTypes.ts`, `shared/cards_db.json`, `server/src/rooms/OfficeRoom.ts`

Comandi verifica:
```bash
npm test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts
```

Acceptance:
- coerenza documentata tra regole dichiarate e codice reale
- decisioni bloccanti esplicitate

## Milestone 2 - Refactor logica per testabilita

Output atteso:
- separazione logica core dal rendering, dove ragionevole
- test unitari su turno/azioni/vittoria/effetti base

File coinvolti (target):
- `server/src/rooms/OfficeRoom.ts`
- eventuali moduli `server/src/game/*`
- `server/tests/*`, `tests/*`

Comandi verifica:
```bash
cd server && npm run build
npm test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts
```

Acceptance:
- smoke suite stabile green
- nessuna regressione bloccante sul core loop

## Milestone 3 - UI/UX carte

Output atteso:
- mini-card compatte in mano/tavolo
- overlay full-card al tap/click (artwork in alto, testo completo sotto)
- hit areas robuste mobile/desktop

File coinvolti (target):
- `client/src/gameobjects/CardGameObject.ts`
- `client/src/scenes/GameScene.ts`

Comandi verifica:
```bash
cd client && npm run build
```

Smoke manuale:
- tap su carta apre overlay
- close overlay sempre accessibile
- drag/tap non confliggono

Acceptance:
- leggibilita migliore su mobile
- interazione carte stabile

## Milestone 4 - Pixel art makeover

Output atteso:
- rendering crisp (no blur)
- scaling responsivo mobile-first
- layout con meno overlap e feedback visivo coerente

File coinvolti (target):
- `client/src/main.ts`
- `client/src/scenes/*.ts`
- `client/src/ui/*`

Comandi verifica:
```bash
cd client && npm run build
```

Acceptance:
- UI leggibile in portrait/landscape
- stile uniforme 16-bit handheld

## Milestone 5 - i18n IT/EN

Output atteso:
- tutte le stringhe UI centralizzate
- default IT, EN selezionabile
- persistenza lingua

File coinvolti (target):
- `client/src/i18n.ts`
- scene/UI client

Comandi verifica:
```bash
cd client && npm run build
```

Smoke manuale:
- cambio lingua in UI
- riapertura app mantiene lingua
- nessuna stringa hardcoded residua in scene principali

Acceptance:
- copertura IT/EN completa sulle view principali

## Milestone 6 - QA finale

Output atteso:
- `docs/QA.md` con risultati build/test/smoke/playtest
- bug bloccanti risolti o tracciati come noti

File coinvolti:
- `docs/QA.md`
- eventuali fix tecnici minori

Comandi verifica:
```bash
cd server && npm run build
cd client && npm run build
npm test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts
```

Acceptance:
- build client/server green
- smoke suite stabile green
- checklist playtest compilata

## Decisioni bloccanti approvate

- A: `Challenge/Modifier` reaction-only, `Magic` azione attiva.
- B: `Item` equip su Hero specifico (fallback player-level solo temporaneo per migrazione).
- C: refill immediato monster per mantenere sempre 3 in tavola.

