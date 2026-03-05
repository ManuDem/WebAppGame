# QA Flow End-to-End

Data aggiornamento: 2026-03-05

## 1) Accesso -> Stanza -> Prelobby -> Start

### Sequenza
1. `LoginScene`: Host inserisce nome CEO e crea stanza (codice 4 cifre).
2. Secondo player entra con codice e nome CEO.
3. Entrambi arrivano in `PreLobbyScene`.
4. Ogni player preme `SONO PRONTO`.
5. Host preme `AVVIA PARTITA`.
6. Entrambi entrano in `GameScene`.

### Transizioni stato attese (server)
1. `WAITING_FOR_PLAYERS` / `PRE_LOBBY` con players connessi.
2. `JOIN_GAME` marca `isReady = true`.
3. `START_MATCH` valida host + almeno 2 ready.
4. Stato match iniziale:
   - `phase = PLAYER_TURN`
   - `turnNumber = 1`
   - mano iniziale = 3 carte per player
   - board monster = 3 slot popolati

### Eventi server chiave
- `TURN_STARTED`
- `CARD_DRAWN`
- `START_REACTION_TIMER`
- `REACTION_TRIGGERED`
- `ACTION_RESOLVED`
- `DICE_ROLLED`
- `GAME_WON`
- `ERROR`

## 2) Flusso partita base (turni/AP/pesca/mostri/reazioni)

### Sequenza di verifica
1. Turno Player A:
   - pesca (`DRAW_CARD`) -> AP -1
   - gioca Hero (`PLAY_EMPLOYEE`) -> reaction window
   - gioca Magic/Item (`PLAY_MAGIC`) -> reaction window
   - fine turno (`END_TURN`)
2. Turno Player B:
   - attacco Mostro via CTA `ATTACCA` (`SOLVE_CRISIS`)
   - reazioni avversari (`PLAY_REACTION`)
   - `DICE_ROLLED` + esito + refill Mostri a 3

### Validazioni UX attese client
- Pannello azioni mostra chiaramente: turno, AP, azioni bloccate e motivo.
- Nessuna affordance ambigua per attacco Mostro (azione esplicita su slot Mostro).
- Log persistente aggiorna gli ultimi eventi chiave.

## 3) Disconnect/Reconnect entro 30s

## 3.1 Flow atteso
1. Durante la partita cade connessione websocket.
2. Client riceve `room.onLeave`.
3. `ServerManager` avvia reconnect automatico:
   - persiste contesto locale (`roomId`, `sessionId`, `reconnectToken`, `ceoName`, `roomCode`)
   - tentativi con backoff: `0.5s, 1s, 2s, 3s, 5s` (finestra max 25s client, compatibile 30s server)
4. `GameScene` mostra overlay:
   - “Connessione persa”
   - tentativo corrente
   - tempo residuo
5. Su successo:
   - overlay sparisce
   - stato torna coerente via state sync
   - nessun reset partita
6. Su fallimento timeout:
   - overlay mostra errore
   - redirect pulito a `LoginScene` con messaggio.

## 3.2 Casi da verificare
1. Caduta durante `PLAYER_TURN` del player attivo.
2. Caduta durante `REACTION_WINDOW`.
3. Caduta con pending action in corso.
4. Reconnect riuscito entro 30s.
5. Reconnect fallito oltre timeout.

## 3.3 Failure modes noti da osservare
- Duplicazione player dopo reconnect.
- Turno bloccato (phase non avanza).
- `pendingAction` non pulita in caso di leave definitivo.
- UI desync (mano/tavolo non allineati allo stato server).

## 4) Checklist ripetibile manuale

1. Avvia server: `cd server && npm.cmd run dev`.
2. Avvia client: `cd client && npm.cmd run dev`.
3. Apri 2 browser/tab separati.
4. Esegui flusso completo:
   - create room -> join -> ready -> start
   - almeno 1 draw, 1 Hero, 1 Magic/Item, 1 attack monster
5. Simula disconnect di un tab (chiusura tab o rete offline).
6. Entro 30s:
   - verifica overlay reconnect
   - verifica ripresa match senza restart
7. Ripeti con reconnect non riuscito:
   - verifica redirect a login con messaggio.

## 5) Supporto QA mock/visuale

- `?qaMatch=1` per aprire match mock senza server.
- `?uiDebug=1` per visualizzare bounds anti-overlap.
- Script screenshot:
  - `cd client && npm.cmd run qa:capture:match`
  - output: `client/qa/output/match/summary.json`

## 6) Flow QA iniziale senza backend

Per validare le schermate iniziali in modo ripetibile senza stanza reale:
1. Boot: `?qaScreen=boot&lang=it|en`
2. Login: `?qaScreen=login&lang=it|en`
3. Prelobby mock: `?qaScreen=prelobby&qaPreLobby=1&lang=it|en`

Note:
- Il mock prelobby usa `MockPreLobbyServerManager` e non richiede Colyseus.
- In `?qaScreen=prelobby` il bottone ready/start simula la transizione di fase per smoke UI.

## 7) Flow QA match mock con overlay

1. Match base: `?qaMatch=1&qaState=my_turn&lang=it|en`
2. Reaction window: `?qaMatch=1&qaState=reaction_window&lang=it|en`
3. Inspect aperto: `?qaMatch=1&qaInspect=1&lang=it|en`
4. Help aperto: `?qaMatch=1&qaHelp=1&lang=it|en`
5. Bounds debug: aggiungere `&uiDebug=1`

## 8) Note reconnect/UI (M21)

1. In partita, il reconnect usa overlay DOM su `#ui-root` come layer principale.
2. Durante reconnect:
   - input gameplay disabilitato lato scene (`reconnectActive`).
   - retry/backoff mostrato con tentativi e tempo residuo.
3. Se reconnect fallisce:
   - redirect pulito a `LoginScene`.
   - messaggio utente `login_reconnect_failed`.

## 9) Esecuzione verificata (2026-03-05)

- Build:
  - `cd client && npm.cmd run build` -> OK
  - `cd server && npm.cmd run build` -> OK
- Test:
  - `npm.cmd test -- --runInBand --forceExit` -> `27/27` suite PASS
- QA visuale:
  - `client/qa/output/summary.initial.json` -> 48/48 OK
  - `client/qa/output/match/summary.json` -> 112/112 OK

## 10) Verifica layout deterministico (M23)

Con shell DOM match attiva:
1. Top/HUD/controls/log sono governati da CSS grid nel layer `#ui-root`.
2. In `tier C` (landscape basso) il blocco principale match e centrato verticalmente e orizzontalmente.
3. Nessun fail automatico su safe area / overlap nei capture IT/EN:
   - initial: 48/48 OK
   - match/mock/overlay: 112/112 OK
