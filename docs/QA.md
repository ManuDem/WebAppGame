# QA - Milestone Match Readability + Live HUD + Anti-Overlap

Data verifica: 2026-03-04

## 0) Audit Bug Bash Carte/Tavolo/i18n (stato iniziale)

Riproduzione breve (prima del fix):
1. Trascina una carta non giocabile sul tavolo in fase/target non valido.
2. In alcuni flussi arriva `ServerEvents.ERROR` senza reconcile immediato della mano.
3. La carta pending puo restare fuori dalla hand (`stuck`) per desync UI locale.

Expected vs Actual (prima del fix):
- Expected: play rifiutata => carta torna in mano, nessun oggetto orfano, nessun duplicato.
- Actual: possibile pending card fuori `handCards` e non distrutta da `rebuildHand()`, con rischio orphan/stuck.

Bug list prioritizzata (prima del fix):
- `P0` Pending card stuck/orphan dopo play fallita:
  - `client/src/scenes/GameScene.ts` (flow `pendingPlayedCard`, `ERROR`, `ACTION_RESOLVED`, `applyState`)
- `P1` Overflow testi mini-card/label:
  - `client/src/gameobjects/CardGameObject.ts`
  - `client/src/scenes/GameScene.ts` (crisis label, opponent row, inspect title/type, selector)
- `P1` Testi hardcoded/non tradotti in card UI:
  - `client/src/gameobjects/CardGameObject.ts`
  - `client/src/scenes/GameScene.ts`
  - `client/src/i18n.ts`
- `P2` Header brand non lineare tra Boot/Login/PreLobby:
  - `client/src/scenes/BootScene.ts`
  - `client/src/scenes/LoginScene.ts`
  - `client/src/scenes/PreLobbyScene.ts`
  - `client/src/ui/Branding.ts`

## 1) Verifiche automatiche eseguite

Comandi:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `npm.cmd test -- --runInBand --forceExit server/tests/gameplay_foundation.test.ts server/tests/room_connection.test.ts`

Esito:
- build client: OK
- build server: OK
- smoke suite stabile: OK
- suite gameplay foundation + room connection: OK

## 2) Smoke manuale ripetibile (match readability)

Prerequisiti:
1. Avvia server: `cd server && npm.cmd run dev`
2. Avvia client: `cd client && npm.cmd run dev`
3. Apri almeno 2 tab/browser distinti.

Checklist funzionale:
1. Host crea stanza e condivide codice.
2. Join entra con codice + nome CEO valido.
3. Pre-lobby: entrambi pronti, host avvia.
4. Start match: ogni giocatore ha 3 carte iniziali.
5. Hand interaction:
   - tap su mini-card => inspect overlay full-card
   - chiusura con `X` e tap fuori overlay
6. Target selector:
   - Magic/Event su opponent
   - Item su Hero (auto-target se Hero unico)
7. Equip item:
   - Hero in company mostra badge equip (`EQ n`)
8. Monster/crisis resolution:
   - crisi con badge `ROLL X+`
   - tiro dadi visibile lato client (toast)
9. Event log:
   - aggiornato con error/reaction/action/turn/dice/win
   - toggle `ESPANDI/RIDUCI` funzionante
10. HUD live:
   - turno/AP/VP/deck/discard/phase/reaction visibili

Checklist layout (anti-overlap):
1. Verifica `360x640` portrait.
2. Verifica `390x844` portrait.
3. Verifica `414x896` portrait.
4. Verifica `768x1024` portrait.
5. Verifica `1366x768` landscape.
6. Nessun testo deve:
   - sovrapporsi
   - uscire da card/panel/toolbar
   - uscire dalla propria sezione
7. Touch target critici >= 44px (bottoni principali, toggle log, selector).

## 3) Debug anti-overlap

Attivazione debug:
- URL con `?uiDebug=1`
- oppure `localStorage.setItem('lucrare_ui_debug', '1')`

Cosa controllare:
- box zone (`topBar`, `board`, `hand`, `log`, `handCards`)
- box testi principali HUD/log/turn

## 4) Nota ambiente CI/sandbox

Il capture browser automatico (`npm.cmd run qa:capture`) in questo ambiente può fallire con:
- `spawn EPERM` su Chromium/Chrome/Edge headless.

In tal caso:
- usare la checklist manuale sopra su browser locale reale.

## 5) Follow-up

- Riduzione log console test lato server (non bloccante).
- Eventuale E2E multi-client automatica stabile fuori sandbox.
- Hardening ulteriore overflow su nomi utente estremamente lunghi.

## 6) Bug fixati (M8)

- `P0` Pending card stuck/desync:
  - introdotto `PendingPlayModel` puro (`client/src/systems/PendingPlayModel.ts`)
  - rollback pending su `ServerEvents.ERROR`
  - reconcile pending su `applyState` con hand autorevole
  - cleanup orfani `CardGameObject` dopo rebuild (`cleanupOrphanCardObjects`)
- `P1` Overflow/overlap testi carte:
  - utility `fitTextToBox` + modello puro `TextFitModel`
  - applicazione su mini-card (titolo/sottotitolo/info), badge crisis, selector target, card inspect title/type, opponent row
- `P1` i18n/hardcoded:
  - localizzazione tipo carta + mini info + badge EQ + label sintetiche VP/Hero
  - rimozione `templateId` dalla UI inspect e selector
- `P2` Header non lineare tra scene iniziali:
  - nuova funzione unica `layoutBrandHeader(...)` usata in Boot/Login/PreLobby

## 7) Verifiche automatiche M8

Comandi:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts tests/I18nCoverage.test.ts`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`

Esito:
- build client: OK
- build server: OK
- test nuovi (pending/text-fit/i18n): OK
- smoke suite stabile: OK

## 8) Residui noti

- Nessun blocco P0 aperto nelle aree toccate.
- Da rifinire in follow-up: stress test visuale su nickname estremamente lunghi su dispositivi piccoli reali.
