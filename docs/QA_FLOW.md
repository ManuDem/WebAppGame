# QA Flow End-to-End

Data aggiornamento: 2026-03-06

## 1. Accesso e Start Match
1. Host crea room in `LoginScene`.
2. Join entra con room code.
3. Entrambi in `PreLobbyScene`.
4. Ready di tutti i connessi.
5. Host avvia match.

Expected server:
- fase iniziale match `PLAYER_TURN`
- mano iniziale a 3 carte per player
- board Monster a 3 slot

## 2. Turno base
1. Draw (`DRAW_CARD`) scala AP.
2. Play Hero (`PLAY_EMPLOYEE`).
3. Play Magic/Item (`PLAY_MAGIC`) con target validi.
4. Monster attempt via CTA `ATTACCA` (`SOLVE_CRISIS`).
5. End turn (`END_TURN`).

## 3. Reazioni
- Trigger su azioni che aprono `REACTION_WINDOW`.
- Solo avversari possono reagire.
- Feedback chiaro su azioni bloccate fuori finestra.

## 4. Overlay e input safety
- Help/Inspect/Target Selector devono bloccare input gameplay.
- ESC deve chiudere overlay in ordine coerente.
- Nessuna azione di turno deve partire con modal aperto.

## 5. Reconnect
- tentativi con backoff entro finestra prevista.
- overlay reconnect visibile e blocco input durante reconnect.
- su fail: redirect pulito a login.

## 6. Visual QA
- Eseguire checklist su viewport obbligatori portrait+landscape.
- Con `uiDebug=1` verificare bounds senza collisioni.

## 7. Esito minimo per release
- build client/server PASS
- unit + integration PASS
- nessun overlap critico nei viewport obbligatori
- nessun bug bloccante su flow draw/play/attack/end/reaction/reconnect
