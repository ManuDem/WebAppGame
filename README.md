# LUCrAre: SEMPRE

Web card game multiplayer con architettura server-authoritative (Colyseus + Phaser).

## Stack
- `client`: Phaser 3 + TypeScript + Vite
- `server`: Colyseus + Express + TypeScript
- `shared`: contratti rete, tipi, deck manager, parser effetti
- `tests`: Jest multi-project (`unit:client`, `unit:shared`, `integration:server`)

## Mappa progetto
- `client/src/scenes/`
  - `BootScene.ts`: loading scene
  - `LoginScene.ts`: host/join, lingua IT/EN, nome CEO, codice stanza
  - `GameScene.ts`: lobby pre-match, board, mano, reaction overlay
- `client/src/network/ServerManager.ts`: API client Colyseus
- `client/src/ui/`: branding, font, bottoni, sfondi stile Pokemon old-school
- `server/src/rooms/OfficeRoom.ts`: logica partita authoritative
- `server/src/State.ts`: schema stato sincronizzato
- `shared/SharedTypes.ts`: enum, payload, costanti gioco
- `shared/DeckManager.ts`, `shared/CardEffectParser.ts`, `shared/cards_db.json`
- `tests/`: test canonici (`tests/unit/*`, `tests/integration/*`, `tests/setup/*`)
- `artworks/references/`: mockup e immagini di riferimento non runtime

## Flusso partita attuale
1. Il giocatore sceglie `Host` o `Partecipa`.
2. Host crea stanza con `roomCode` a 4 cifre.
3. Join entra con stesso codice + nome CEO.
4. Ogni player invia `JOIN_GAME` (ready).
5. Solo host puo inviare `START_MATCH`.
6. Match parte se ci sono almeno `2` connessi e tutti ready.

## Regole attuali (codice)
- Giocatori: `2-10`
- PA per turno: `3`
- Pesca carta: costo `1` PA
- Mano iniziale: `3` carte per player
- Reaction window: `5000 ms`
- Modello carte Here-to-Slay Lite:
  - Main deck: `Hero`, `Item`, `Magic`, `Modifier`, `Challenge`
  - Setup: `Monster` (centro tavolo), `Party Leader` (passiva per player)
- Vittoria semplificata: `4` Hero in company oppure `2` Monster risolti
- Rejoin consentito in partita in corso solo con nome CEO gia esistente

## Requisiti
- Node.js 18+ (consigliato 20+)
- npm

## Setup
1. Root:
```bash
npm ci
```
2. Server:
```bash
cd server
npm ci
```
3. Client:
```bash
cd ../client
npm ci
```

## Avvio sviluppo
1. Server (porta default `2567`):
```bash
cd server
npm run dev
```
2. Client (porta Vite):
```bash
cd client
npm run dev
```

## Build
- Client:
```bash
cd client
npm run build
```
- Server:
```bash
cd server
npm run build
```

## Verifica tecnica (snapshot 2026-03-06)
- `server build`: OK
- `client build`: OK
- suite completa Jest: OK
  - comando: `npm test`
- suite unit (client/shared): OK
  - comando: `npm run test:unit`
- suite UI contracts browserless (environment-safe): OK
  - comando: `npm run test:ui`
- suite integration server: OK
  - comando: `npm run test:integration`

## Documentazione utile
- `docs/index.md`: indice principale documentazione
- `docs/ARCHITECTURE.md`: mappa architettura + runbook partita
- `docs/PLAN.md`: milestone, acceptance e verifiche
- `docs/GDD.md`: design doc (as-is + struttura variante scelta)
- `docs/QA.md`: checklist QA operativa (focus overlap/bug grafici)
- `docs/ui/LAYOUT_SPEC.md`: contratto layout portrait/landscape
