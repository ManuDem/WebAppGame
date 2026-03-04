# QA - Milestone Match Readability + Live HUD + Anti-Overlap

Data verifica: 2026-03-04

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
