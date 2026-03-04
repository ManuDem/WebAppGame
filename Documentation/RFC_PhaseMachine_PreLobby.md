# RFC Phase Machine Pre-Lobby

Data: 2026-03-04  
Owner: Agente 0 (Tech Lead)

## Obiettivo
Unificare la semantica delle fasi in modo che server e client non divergano sulla visibilita della lobby e dei controlli di start.

## Fasi Canoniche
- `PRE_LOBBY`
- `PLAYER_TURN`
- `REACTION_WINDOW`
- `RESOLUTION`
- `GAME_OVER`

Nota compat: `WAITING_FOR_PLAYERS` resta supportata come fase legacy in alcune validazioni server.

## Regole Fase

### PRE_LOBBY
- Entrata stanza.
- Mostra regole brevi.
- Ready utenti.
- Solo host puo avviare match.
- Avvio consentito se:
  - connessi >= 2
  - tutti i connessi sono ready.

### PLAYER_TURN
- Solo giocatore di turno puo fare azioni standard.
- AP gestiti server-side.

### REACTION_WINDOW
- 5000ms server-timer.
- Azioni di reazione consentite agli altri giocatori.

### RESOLUTION
- Risoluzione stack LIFO.
- Nessuna azione client diretta.

### GAME_OVER
- Blocca azioni gameplay.
- Consente solo UX finale (nuova partita/reload).

## Transizioni
- `PRE_LOBBY -> PLAYER_TURN`: host start valido.
- `PLAYER_TURN -> REACTION_WINDOW`: azione criticabile giocata.
- `REACTION_WINDOW -> RESOLUTION`: timeout server.
- `RESOLUTION -> PLAYER_TURN`: coda risolta, nessuna win.
- `* -> GAME_OVER`: condizione vittoria.

## Vincoli di Sicurezza
- Nuovi player non possono entrare a match avviato.
- Eccezione: rejoin solo con stesso nome CEO gia presente.
- Tutte le validazioni decisive lato server.
