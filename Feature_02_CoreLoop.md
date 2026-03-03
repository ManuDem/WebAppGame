# Feature 02: Core Loop Base — Turni, Punti Azione e Pesca

Questo documento definisce le specifiche tecniche vincolanti per l'implementazione del ciclo di gioco fondamentale: gestione dei turni in round-robin, i Punti Azione (PA) e l'azione di pesca dal mazzo. Ogni agente deve attenersi strettamente ai contratti definiti in `shared/SharedTypes.ts`.

---

## Costanti di Riferimento (da `SharedTypes.ts`)

| Costante | Valore | Significato |
|---|---|---|
| `MAX_ACTION_POINTS` | 3 | PA assegnati all'inizio di ogni turno |
| `DRAW_CARD_COST` | 1 | PA consumati per pescare una carta |
| `REACTION_WINDOW_MS` | 5000 | Durata della finestra di reazione (non usata in questa Feature) |

---

## 1. Direttive per l'Agente 1 (Backend — Node.js / Colyseus)

### 1.1 Avvio della Partita e Primo Turno

*   Quando il numero minimo di giocatori (3) è raggiunto e l'host (o un trigger automatico) avvia la partita:
    1.  Popolare `playerOrder` con i `sessionId` dei giocatori connessi (ordine casuale via shuffle).
    2.  Impostare `turnIndex = 0` e `currentTurnPlayerId = playerOrder[0]`.
    3.  Impostare `phase = GamePhase.PLAYER_TURN`.
    4.  Assegnare `actionPoints = MAX_ACTION_POINTS` (3) al giocatore di turno.
    5.  Fare `broadcast` dell'evento `ServerEvents.TURN_STARTED` con payload `ITurnStartedEvent`.

### 1.2 Gestione del Messaggio `DRAW_CARD`

Handler: `room.onMessage(ClientMessages.DRAW_CARD, (client, data) => { ... })`

**Validazione Tripla (cfr. Linea Guida Architetturale #8):**

1.  **Turno:** `client.sessionId === state.currentTurnPlayerId` — Se falso → `ServerEvents.ERROR` con codice `NOT_YOUR_TURN`.
2.  **Fase:** `state.phase === GamePhase.PLAYER_TURN` — Se falso → `ServerEvents.ERROR` con codice `WRONG_PHASE`.
3.  **Risorse:** `player.actionPoints >= DRAW_CARD_COST` — Se falso → `ServerEvents.ERROR` con codice `NO_PA`.
4.  **Mazzo:** `state.deckCount > 0` — Se falso → `ServerEvents.ERROR` con codice `DECK_EMPTY`.

**Esecuzione (se tutte le validazioni passano):**

1.  Decrementare `player.actionPoints -= DRAW_CARD_COST`.
2.  Estrarre una carta dal mazzo interno del server (array non sincronizzato).
3.  Aggiungere la carta alla `hand` del giocatore (tramite Colyseus `ArraySchema.push`).
4.  Decrementare `state.deckCount`.
5.  Inviare **solo al client richiedente** l'evento `ServerEvents.CARD_DRAWN` con payload `ICardDrawnEvent` (contenente i dati completi della carta).
6.  Lo State sincronizzato aggiornerà automaticamente `deckCount` e `actionPoints` per tutti.

### 1.3 Gestione del Messaggio `END_TURN`

Handler: `room.onMessage(ClientMessages.END_TURN, (client, data) => { ... })`

**Validazione:**

1.  **Turno:** `client.sessionId === state.currentTurnPlayerId` — Solo il giocatore di turno può terminare.
2.  **Fase:** `state.phase === GamePhase.PLAYER_TURN`.

**Esecuzione:**

1.  Avanzare `turnIndex = (turnIndex + 1) % playerOrder.length`. Saltare i giocatori con `isConnected === false`.
2.  Aggiornare `currentTurnPlayerId = playerOrder[turnIndex]`.
3.  Resettare `actionPoints = MAX_ACTION_POINTS` per il nuovo giocatore.
4.  Incrementare `turnNumber`.
5.  Broadcast `ServerEvents.TURN_STARTED` con i dati del nuovo turno.

### 1.4 Fine Automatica del Turno

*   Se dopo un'azione il giocatore ha `actionPoints === 0`, il server **NON** termina automaticamente il turno. Il giocatore deve comunque inviare `END_TURN` esplicitamente (potrebbe voler valutare il tavolo). Questa è una scelta di design deliberata per non togliere agency al giocatore.

---

## 2. Direttive per l'Agente 2 (Frontend — Phaser.js)

### 2.1 Scena di Gioco (`GameScene`)

*   Creare una Scena `GameScene` che si attiva dopo la `LobbyScene` quando la partita inizia (`phase` cambia da `WAITING_FOR_PLAYERS` a `PLAYER_TURN`).

### 2.2 HUD — Punti Azione

*   Renderizzare un indicatore visivo dei PA del giocatore locale (es. 3 icone "moneta" o "orologio" che si spengono man mano che vengono spesi).
*   Aggiornare l'HUD in modo **reattivo**: ascoltare i cambiamenti dello State Colyseus su `players[mySessionId].actionPoints` e ridisegnare di conseguenza. **Non** mantenere un contatore locale separato.

### 2.3 Pulsante "Pesca"

*   Creare un pulsante interattivo "Pesca" (o icona mazzo cliccabile).
*   Al click:
    1.  Verificare localmente (solo per UX, non per sicurezza) che `actionPoints >= 1`.
    2.  Inviare `room.send(ClientMessages.DRAW_CARD, {})`.
    3.  Disabilitare temporaneamente il tasto fino alla ricezione della risposta.
*   In caso di `ServerEvents.CARD_DRAWN`: animare la carta che si aggiunge alla mano.
*   In caso di `ServerEvents.ERROR`: mostrare un toast/notifica con il messaggio d'errore e ri-abilitare il tasto.

### 2.4 Pulsante "Fine Turno"

*   Visibile e attivo **solo** quando `currentTurnPlayerId === mySessionId`.
*   Al click: inviare `room.send(ClientMessages.END_TURN, {})`.

### 2.5 Indicatore del Turno

*   Mostrare chiaramente di chi è il turno corrente (evidenziare il nome/avatar del CEO attivo).
*   Ascoltare l'evento `ServerEvents.TURN_STARTED` per aggiornare l'UI (animazione di transizione turno).

### 2.6 Contatore Mazzo

*   Visualizzare il numero di carte rimanenti nel mazzo (`state.deckCount`) sovrapposto al mazzo grafico.

---

## 3. Direttive per l'Agente 3 (Data / Game Logic)

### 3.1 Struttura del Mazzo

*   Preparare una funzione `createDeck(cardDb: ICardData[]): ICardData[]` che:
    1.  Legge il file `cards_db.json`.
    2.  Istanzia le carte assegnando un `id` UUID univoco ad ogni copia.
    3.  Restituisce un array mescolato (shuffle Fisher-Yates).
*   Questa funzione sarà invocata dal Backend all'avvio della partita per popolare il mazzo interno.

### 3.2 Funzione di Pesca

*   Implementare `drawCard(deck: ICardData[]): ICardData | null` che esegue un `.pop()` dal mazzo e restituisce la carta (o `null` se vuoto). Funzione pura, nessuna dipendenza da Colyseus.

---

## 4. Direttive per l'Agente 4 (QA Engineer)

### 4.1 Test Case: Validazione PA

*   Simulare un client che invia `DRAW_CARD` 4 volte consecutive nello stesso turno. Le prime 3 devono avere successo; la quarta deve ricevere `ServerEvents.ERROR` con codice `NO_PA`.

### 4.2 Test Case: Turno Sbagliato

*   Simulare un client che invia `DRAW_CARD` quando **non** è il suo turno. Deve ricevere `ServerEvents.ERROR` con codice `NOT_YOUR_TURN`.

### 4.3 Test Case: Rotazione Turni

*   Con 3 giocatori connessi, simulare una sequenza di `END_TURN` e verificare che `currentTurnPlayerId` cicli correttamente attraverso tutti i giocatori in ordine.

### 4.4 Test Case: Mazzo Vuoto

*   Preparare un mazzo con 1 sola carta. Pescare → successo. Pescare di nuovo → `ServerEvents.ERROR` con codice `DECK_EMPTY`.
