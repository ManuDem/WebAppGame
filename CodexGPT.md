# CodexGPT - Memoria Operativa Progetto

Ultimo aggiornamento: 2026-03-04  
Workspace: `C:\Users\manud\Desktop\WebApp Game`

## 1) Scopo
Questo file e la memoria operativa da consultare:
- a inizio sessione
- durante task lunghi
- a fine sessione (aggiornando stato reale, bug e test)

Obiettivo: sapere subito cosa e fatto, cosa manca e dove intervenire.

## 2) Snapshot rapido
- Progetto: `LUCrAre: SEMPRE`
- Tipo: web card game multiplayer, server authoritative
- Stack:
  - client: Phaser 3 + TypeScript + Vite
  - server: Colyseus + Express + TypeScript
  - shared: tipi/contratti + deck + parser effetti
  - test: Jest (root + server)

## 3) Regole correnti in codice
- Lobby con codice stanza a 4 cifre
- Modalita ingresso: Host / Partecipa
- Player range: 2-10
- Start match: solo host, almeno 2 connessi, tutti i connessi ready
- Mano iniziale: 3 carte
- AP turno: 3
- Draw cost: 1 AP
- Reaction window: 5000 ms
- Win semplificata: 4 dipendenti in company o 2 crisi risolte
- Rejoin in partita avviata: consentito solo con nome CEO gia esistente

## 4) Mappa codice essenziale
- Client:
  - `client/src/scenes/BootScene.ts`
  - `client/src/scenes/LoginScene.ts`
  - `client/src/scenes/GameScene.ts`
  - `client/src/network/ServerManager.ts`
  - `client/src/ui/SimpleButtonFx.ts`
  - `client/src/ui/Branding.ts`
  - `client/src/ui/PokemonVisuals.ts`
- Server:
  - `server/src/index.ts`
  - `server/src/State.ts`
  - `server/src/rooms/OfficeRoom.ts`
- Shared:
  - `shared/SharedTypes.ts`
  - `shared/DeckManager.ts`
  - `shared/CardEffectParser.ts`
  - `shared/cards_db.json`

## 5) Verifica tecnica corrente (2026-03-04)
- Build:
  - server: OK (`cd server && npm run build`)
  - client: OK (`cd client && npm run build`)
- Test root:
  - comando: `npm test -- --runInBand`
  - esito: FAIL parziale
  - pass:
    - `server/tests/core_loop.test.ts`
    - `server/tests/room_connection.test.ts`
    - `tests/CardEffectParser.test.ts`
    - `tests/DeckManager.test.ts`
  - fail:
    - `server/tests/reaction_stress.test.ts` (assert su fase: atteso `PLAYER_TURN`, ricevuto `GAME_OVER`)
    - `server/tests/win_conditions.test.ts` (suite legacy con `process.exit(1)` su fallimento)
    - `tests/core_loop.test.ts`
    - `tests/room_connection.test.ts`
    - `tests/reaction_race_condition.test.ts`
  - causa nota per 3 suite root: modulo `express` mancante nel workspace root richiesto da `@colyseus/testing`

## 6) Criticita aperte prioritarie
1. Riallineare test al comportamento reale:
   - `server/tests/reaction_stress.test.ts` va aggiornato per la win condition attuale che puo chiudere in `GAME_OVER`.
2. Stabilizzare test root `@colyseus/testing`:
   - aggiungere dipendenze mancanti nel root oppure isolare queste suite in workspace coerente.
3. Ripulire suite legacy `server/tests/win_conditions.test.ts`:
   - evitare `process.exit(1)` dentro test Jest.
4. Pulizia tecnica:
   - ridurre uso di `any` in `OfficeRoom.ts` e `CardEffectParser.ts`.

## 7) Checklist operativa prima di modificare codice
1. Leggere questo file (`CodexGPT.md`).
2. Leggere i contratti in `shared/SharedTypes.ts`.
3. Verificare impatto client/server/shared/test.
4. Applicare fix.
5. Eseguire verifiche pertinenti (build/test).
6. Aggiornare questo file con data, esito, bug emersi.

## 8) Comandi rapidi
- Dev server:
```bash
cd server && npm run dev
```
- Dev client:
```bash
cd client && npm run dev
```
- Build server/client:
```bash
cd server && npm run build
cd client && npm run build
```
- Test root:
```bash
npm test -- --runInBand
```

## 9) Log aggiornamenti
- 2026-03-04:
  - audit completo repository (client/server/shared/tests/docs)
  - allineata documentazione principale (`README`, `Feature_01`, `Feature_02`, `Master`, `Phase Status`)
  - registrato stato reale build/test (server build OK, client build FAIL, test root parzialmente FAIL)
  - semplificata memoria operativa in questo file per consultazione rapida a ogni avvio
- 2026-03-04 (sessione UI+i18n+riuso):
  - menu login: `Host/Partecipa` non pre-selezionati (stesso stato iniziale, highlight solo su selezione)
  - traduzioni: spostate stringhe hardcoded della `GameScene` in `i18n.ts` (vittoria, target selector, cancel)
  - grafica partita: carte migliorate (badge tipo, descrizione piu leggibile, sheen su hover, tilt in drag)
  - dinamismo: aggiunto emitter ambientale leggero e pulse della dropzone centrale
  - riuso grafico: introdotto `client/src/ui/RetroButtonPainter.ts` e applicato a bottoni Login/Game
  - build aggiornata: `client build` OK, `server build` OK
  - test root: ancora FAIL parziale su suite storiche (`reaction_stress` + dipendenza `express`/`process.exit` test legacy)
- 2026-03-04 (sessione commit rimanenti):
  - preparato secondo commit separato con modifiche residue (docs, lobby flow, room code, icone/ui shared)
  - esclusi dal commit artefatti locali: screenshot `Immagine *.png` e `dist/` non consolidato
  - fix compatibilita tipi carta: `CardType` esteso con alias legacy/nuovi in `shared/SharedTypes.ts`
  - fix tipizzazione palette carte in `CardGameObject` con fallback esplicito
  - verifica finale: `client build` OK, `server build` OK
