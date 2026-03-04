# Feature 02: Core Loop (Turni, PA, Pesca, Start Match)

Specifica aggiornata del ciclo base di gioco.
Ultimo aggiornamento: 2026-03-04

## Costanti principali (`shared/SharedTypes.ts`)
- `MAX_ACTION_POINTS = 3`
- `DRAW_CARD_COST = 1`
- `MIN_PLAYERS_TO_START = 2`
- `REACTION_WINDOW_MS = 5000`

## Flusso avvio partita
1. I client entrano in stanza con `roomCode`.
2. Ogni client invia `JOIN_GAME` per segnarsi ready.
3. Solo host puo inviare `START_MATCH`.
4. Il server avvia il match solo se:
   - almeno 2 giocatori connessi
   - tutti i connessi sono ready
5. Allo start:
   - fase `PLAYER_TURN`
   - ordine turni randomizzato
   - mano iniziale distribuita: `3` carte per ogni partecipante
   - `actionPoints = 3` al primo giocatore attivo

## DRAW_CARD
- Validazioni server:
  - e il turno del client
  - fase corretta (`PLAYER_TURN`)
  - PA sufficienti
  - mazzo non vuoto
- Se valido:
  - scala 1 PA
  - pesca dal deck server authoritative
  - aggiunge carta alla mano del player
  - aggiorna `deckCount`
  - invia `CARD_DRAWN` al richiedente

## END_TURN
- Validazioni server:
  - solo giocatore attivo
  - fase `PLAYER_TURN`
- Se valido:
  - avanza al prossimo player connesso
  - reset PA del nuovo attivo a 3
  - incrementa `turnNumber`
  - broadcast `TURN_STARTED`

## Reazioni (interazione con fase 4)
- `PLAY_EMPLOYEE`, `PLAY_MAGIC`, `SOLVE_CRISIS` aprono `REACTION_WINDOW`.
- Le azioni vengono risolte al termine della finestra tramite stack.

## Win condition semplificata (stato codice corrente)
- Vittoria con:
  - 4 dipendenti in azienda, oppure
  - 2 crisi risolte

## Criteri accettazione
- Anti-cheat su turno/fase/PA sempre rispettato
- Rotazione turni stabile anche con disconnect
- Mano iniziale corretta a 3 carte per partecipante
- Nessun avvio partita senza condizioni minime ready
