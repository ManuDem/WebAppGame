# QA - Operativa Corrente

Data aggiornamento: 2026-03-06

## Obiettivo
Garantire stabilita funzionale e leggibilita grafica del match in mobile-first, con priorita a bug di overlap e input ambiguo.

## Baseline verificata
- `npm run test:unit` -> PASS
- `npm run test:ui` -> PASS (`5/5` suite UI contract, `63/63` test)
- `npm test` -> PASS (`30/30` suite, `183/183` test)
- `cd client && npm run build` -> PASS

## Matrice viewport obbligatoria
- Portrait: `360x640`, `390x844`, `414x896`, `768x1024`
- Landscape: `844x390`, `896x414`, `1024x768`, `1366x768`

## Check bloccanti
1. Nessun overlap critico tra top meta, HUD, controls, log, hand.
2. Nessun testo fuori contenitore nei pannelli di partita.
3. Nessun bottone coperto/non cliccabile.
4. Con overlay modal aperto:
   - input gameplay bloccato
   - chiusura coerente anche via ESC
5. Play invalidi sempre con rollback visivo coerente (niente card stuck/orphan).

## Check funzionali minimi match
1. Draw/End Turn rispettano turno/AP/fase.
2. CTA Monster (`ATTACCA`) esplicita, niente affordance ambigua via drop.
3. Reaction window coerente (solo avversari, solo carte valide).
4. Log eventi aggiornato e consultabile.

## Comandi standard
- build client: `cd client && npm run build`
- build server: `cd server && npm run build`
- unit suite: `npm run test:unit`
- ui suite standard (environment-safe): `npm run test:ui`
- ui contract suite browserless: `npm run test:ui:contracts`
- full suite: `npm test`
- integration server: `npm run test:integration`

## Rischi aperti
- QA su device fisici piccoli ancora necessaria per conferma ergonomia touch reale.
- `npm run test:ui` (alias di `test:ui:contracts`) resta il gate minimo anti-overlap/input-bug.

## Regola operativa
Ogni regressione grafica o funzionale di partita e `P0`: si corregge prima di passare a milestone successive.
