# Feature 01: Connessione e Lobby (`office_room`)

Specifica aggiornata della lobby multiplayer.
Ultimo aggiornamento: 2026-03-04

## Parametri stanza
- Nome stanza: `office_room`
- Capienza massima: `10` giocatori
- Capienza minima per avvio: `2` giocatori
- Codice stanza: `roomCode` a 4 cifre numeriche
- Timeout riconnessione: `30s`

## Backend (Colyseus)
- `onCreate`:
  - valida/normalizza `roomCode`
  - espone metadata stanza con `roomCode`
  - registra handler messaggi (`JOIN_GAME`, `START_MATCH`, gameplay)
- `onAuth`:
  - valida `ceoName` (3-15, alfanumerico)
  - valida `roomCode`
  - blocca nuovi nomi se partita gia avviata
  - consente rejoin con lo stesso nome se il player era gia presente
- `onJoin`:
  - nuovo player: crea `PlayerState` con `isReady=false`
  - rejoin: migra stato sul nuovo `sessionId` mantenendo ordine turni e ownership
- `onLeave`:
  - leave consensuale: rimuove player
  - leave non consensuale: tenta `allowReconnection` per 30s

## Frontend (Phaser)
- Login in due step:
  - step 1: scelta `Host` o `Partecipa`
  - step 2:
    - Host: mostra codice stanza + nome CEO + crea partita
    - Partecipa: input codice + nome CEO + partecipa
- Lingua selezionabile: `it` / `en` (default `it`)
- Verifica lato client:
  - nome valido prima del join/create
  - in join, controllo esistenza stanza per `roomCode` prima della connessione

## Contratti operativi correnti
- Host:
  - `create("office_room", { ceoName, roomCode })`
  - poi `JOIN_GAME` per segnarsi ready
  - poi `START_MATCH` quando tutti i connessi sono ready
- Join:
  - `join("office_room", { ceoName, roomCode })`
  - poi `JOIN_GAME` per segnarsi ready

## Criteri accettazione
- Due client con codice uguale entrano nella stessa stanza
- Stanza non esistente in join: errore esplicito
- Avvio partita consentito solo a host e con almeno 2 connessi ready
- Rejoin con stesso nome in partita avviata: stato ripristinato
