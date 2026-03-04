# LUCrAre: SEMPRE

Web card game multiplayer con architettura server-authoritative (Colyseus + Phaser).

## Stack
- `client`: Phaser 3 + TypeScript + Vite
- `server`: Colyseus + Express + TypeScript
- `shared`: contratti rete, tipi, deck manager, parser effetti
- `tests`: Jest (suite root + suite server)

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

## Verifica tecnica (snapshot 2026-03-04)
- `server build`: OK
- `client build`: OK
- test mirati: OK
  - comando: `npm test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/win_conditions.test.ts server/tests/reaction_stress.test.ts`
  - esito: `31/31` test passed

## Documentazione utile
- `CodexGPT.md`: memoria operativa aggiornata
- `Documentation/README.md`: indice documentazione
- `Documentation/LUCrAre_SEMPRE_Master.md`: stato generale progetto
- `Documentation/Phase_Status_Agente0.md`: stato fasi e rischi
- `Feature_01_Lobby.md`, `Feature_02_CoreLoop.md`, `Documentation/Feature_03_ReactionWindow.md`: specifiche funzionali
