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
- Reazioni e modifier: non consumano AP (modello Here-to-Slay Lite)
- Win semplificata: 4 Hero in company o 2 Monster risolti
- Rejoin in partita avviata: consentito solo con nome CEO gia esistente
- Modello carte attivo (5+2):
  - main deck: `Hero`, `Item`, `Magic`, `Modifier`, `Challenge`
  - setup: `Monster`, `Party Leader`
- Setup match:
  - assegnazione Party Leader lato server
  - popolamento 3 Monster sul tavolo
  - deck costruito solo con carte main deck

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
- Test mirati (stabili): OK
  - comando: `npm test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/win_conditions.test.ts server/tests/reaction_stress.test.ts`
  - esito: 31/31 passed
- Test root completi: FAIL parziale (suite legacy)
  - comando: `npm test -- --runInBand --forceExit`
  - fail attuali:
    - `tests/room_connection.test.ts`
    - `tests/core_loop.test.ts`
    - `tests/reaction_race_condition.test.ts`
  - cause note:
    - suite root basate su harness Colyseus legacy non allineato alla room corrente
    - import errato in `tests/reaction_race_condition.test.ts` (`../src/arena.config`)

## 6) Criticita aperte prioritarie
1. Allineare o rimuovere suite root legacy non coerenti (`tests/*` con `@colyseus/testing`).
2. Ridurre logging runtime in test per output piu pulito.
3. Completare supporto gameplay Item equipaggiati su Hero specifico (oggi buff player-level).
4. Rifinire target selector client per evitare richiesta bersaglio su carte che non lo richiedono.
5. Ridurre uso di `any` in `server/src/rooms/OfficeRoom.ts`.

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
- 2026-03-04 (sessione gameplay+test alignment):
  - introdotti RFC:
    - `Documentation/RFC_Gameplay_Semplificato.md`
    - `Documentation/RFC_UI_MobileFirst.md`
    - `Documentation/RFC_PhaseMachine_PreLobby.md`
  - estesi tipi shared:
    - `CardSubtype` in `shared/SharedTypes.ts`
    - campi `subtype`, `targetRoll`, `modifier` propagati da deck/template/state
  - aggiornato DB carte:
    - convergenza tipi verso `event/crisis/item/employee`
    - aggiunti sottotipi e 2 carte `item`
  - crisi rese server-authoritative in `OfficeRoom`:
    - tiro 2d6 + modifier
    - broadcast `DICE_ROLLED`
    - reward/penalty applicati lato room
  - reazione validata con sottotipi:
    - blocco carte reaction fuori `REACTION_WINDOW`
    - blocco carte non-reaction in `PLAY_REACTION`
  - test allineati:
    - aggiornati `tests/CardEffectParser.test.ts`, `server/tests/win_conditions.test.ts`, `server/tests/reaction_stress.test.ts`
    - pass su suite mirata (28/28)
- 2026-03-04 (sessione bugfix giocabilita + roadmap Here-to-Slay Lite):
  - client gameplay:
    - fix pre-lobby visibile anche quando fase server e `PRE_LOBBY` (non solo `WAITING_FOR_PLAYERS`)
    - fix giocabilita carte evento/reazione con check su `subtype` (non solo su `CardType.REACTION`)
    - fix drop logic per eventi (nessun blocco su alias `MAGIC` legacy)
  - visual:
    - rimossi pallini mobili dal menu login
    - disabilitate particelle ambientali a pallini in partita (restano nuvole lente)
    - inspect carta fullscreen migliorato: area artwork in alto + dettagli effetto/dadi in basso
  - documentazione aggiornata:
    - `Documentation/RFC_Gameplay_Semplificato.md`
    - `Documentation/LUCrAre_2.0_Rules.md`
    - `Documentation/LUCrAre_SEMPRE_Master.md`
- 2026-03-04 (sessione migrazione 5+2 completa + validazione):
  - shared:
    - `CardType` migrato formalmente a `Hero/Item/Magic/Modifier/Challenge/Monster/PartyLeader` con alias legacy
    - `DeckManager` aggiornato: deck creato solo con tipi main deck
    - `CardEffectParser` esteso con `roll_modifier` e gestione passivi migliorata (`win_multiplier`, `roll_bonus`, `discount_magic`)
  - server:
    - `OfficeRoom` aggiornata con setup `Party Leader` e tabellone `Monster`
    - validazioni tipo carta in `PLAY_EMPLOYEE` / `PLAY_MAGIC`
    - `PLAY_REACTION` esteso a `challenge/modifier` e senza consumo PA
    - consumo one-shot dei tag `next_roll_mod_X` al momento del tiro
  - client:
    - `GameScene` aggiornata a nuovi tipi carta (hero/event/reaction/modifier)
    - fix drop su zona Monster (non scarta piu carta mano in modo errato)
    - palette carte riallineata in `CardGameObject`
    - traduzioni IT/EN aggiornate per regole Here-to-Slay Lite
  - verifica:
    - build server/client OK
    - test mirati OK (`31/31` pass)
- 2026-03-04 (sessione pre-lobby separata + audit traduzioni):
  - flow client aggiornato:
    - nuova scena `client/src/scenes/PreLobbyScene.ts` inserita tra Login e Game
    - `LoginScene` ora entra in `PreLobbyScene` dopo create/join stanza
    - `main.ts` registra `PreLobbyScene` nella pipeline scene
    - `GameScene` ora reindirizza automaticamente alla pre-lobby se la fase server e `PRE_LOBBY` o `WAITING_FOR_PLAYERS`
  - pre-lobby migliorata:
    - regole e lista utenti con layout piu leggibile (desktop/mobile)
    - lista giocatori ordinata e resa compatta su viewport piccole
  - i18n completato e ricontrollato:
    - parita chiavi IT/EN: `128/128`
    - nessuna chiave mancante tra le lingue
    - aggiunte traduzioni per errori server (tutti i codici gameplay principali), inspect carta e placeholder esempio nome
  - server:
    - `OfficeRoom` invia ora `code: GAME_ALREADY_STARTED` anche nel blocco join tardivo (migliore localizzazione lato client)
  - build:
    - client build OK
    - server build OK
