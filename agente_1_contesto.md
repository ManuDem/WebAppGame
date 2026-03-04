# Contesto e Stato dei Lavori - Agente 1 (Backend Architect)

## 1. Il Mio Ruolo e Stack Tecnologico
Sono l'**Agente 1**, responsabile dell'architettura e dello sviluppo del Server Backend per il gioco di carte multiplayer "LUCrAre: SEMPRE".
*   **Ruolo**: Backend Architect.
*   **Stack Tecnologico**: Node.js, TypeScript e il framework Colyseus.
*   **Responsabilità**: Gestire lo stato autoritativo della partita, validare accuratamente le azioni dei client, orchestrare il flusso dei turni (Macchina a Stati) e notificare i client degli avvenimenti rilevanti.

## 2. Regole Architetturali e Direttive
Le mie implementazioni sono state guidate da direttive ferree stabilite dall'Architetto (Agente 0):
*   **Server Authoritative (Source of Truth)**: Il server ha l'ultima parola. Il client invia solo "intenzioni" (tramite messaggi) e reagisce ai cambiamenti di stato. Non esiste RNG (generazione numeri casuali) lato client.
*   **Strict Typing & Contract Driven**: Ogni riga di codice rispetta le interfacce (`IGameState`, `IPlayer`, ecc.) e gli enumeratori (`ClientMessages`, `ServerEvents`, `GamePhase`) definiti in `shared/SharedTypes.ts`.
*   **Triple Validation**: Ogni handler di messaggio di gioco implementa una validazione multipla prima di eseguire l'azione: verifica che sia il turno del giocatore, la fase corretta e che quest'ultimo possieda le risorse necessarie (Punti Azione - PA).
*   **Fog of War**: Le carte in mano ai giocatori (`hand`) sono filtrate lato server (`@filter`). Un client riceve esclusivamente i dati delle proprie carte.
*   **Event-Driven Timeout**: La meccanica temporale del gioco (Reaction Window di 5 secondi) è controllata esclusivamente da un timer lato server (`clock.setTimeout()`), non dai client.

## 3. Cosa è stato sviluppato finora (FASE 1, 2, 3 e 4)

### A. Infrastruttura e Schema Dati (`State.ts`)
*   Setup del progetto Node.js e configurazione di TypeScript per compilazione cross-folder (verso `/shared`).
*   Creazione delle fondamenta dello Stato Colyseus (`OfficeRoomState`) che rispecchiano `IGameState`.
*   Adozione di un workaround tramite "type-casting" che concilia le strutture esotiche di Colyseus (`ArraySchema`, `MapSchema`) con le rigidità delle interfacce TypeScript di `SharedTypes.ts`.
*   Implementazione degli schema `PlayerState`, `CardState` e `PendingActionState`.

### B. Lobby e Connessione (`OfficeRoom.ts` - FASE 2)
*   **`onAuth`**: Protezione dell'accesso tramite validazione stringente su `ceoName` (presenza necessaria, formato alfanumerico, lunghezza tra 3 e 15 caratteri). Connessioni non conformi lanciano un `ServerError`.
*   **`onJoin`**: Inizializzazione sicura del record del giocatore, con Punti Azione (PA) iniziali impostati a `0`.
*   **`onLeave`**: Logica di gestione temporanea delle disconnessioni (Reconnect Window) impostata a 30 secondi per salvaguardare instabilità di rete, senza cancellare immediatamente il CEO in caso di refresh della pagina.

### C. Core Loop: Turni e Risorse (`OfficeRoom.ts` - FASE 3)
*   **Game Start**: Appena la stanza rileva una quantità sufficiente di giocatori pronti, genera il pool dei turni, lo "shuffla" (Fisher-Yates) e determina l'ordine fisso.
*   **Integrazione mazzo reale**: Il mazzo di gioco è ora costruito tramite `DeckManager.createDeck()` utilizzando `cards_db.json` curato dall’Agente 3.
*   **Pesca (`DRAW_CARD`)**: Validazione in 4 step (Turno, Fase, AP, e Disponibilità Mazzo). Preleva la carta dal mazzo protetto e la sposta nell'`ArraySchema` della mano del giocatore arricchendola con i dati del template. Invia un evento unicast esplicito `CARD_DRAWN`.
*   **Gestore Turni (`advanceTurn` & `END_TURN`)**: L'azione passa il controllo al successivo CEO in array sfruttando `turnIndex`, ignorando proattivamente tutti i giocatori con stato `isConnected === false`. Distribuisce `MAX_ACTION_POINTS` e annuncia la transizione in broadcast con `TURN_STARTED`.
*   **Reaction Window**: Implementata la finestra di reazione di 5 secondi (`REACTION_WINDOW_MS`) per le azioni criticabili (`PLAY_EMPLOYEE`, `SOLVE_CRISIS`, `PLAY_MAGIC`) tramite `pendingAction`, `actionStack` (LIFO) e timer server-side (`clock.setTimeout`), in collaborazione con `CardEffectParser.resolveQueue`.
*   Il codice sorgente compila a *Zero Errori* (`tsc --noEmit`) ed è coperto da test automatici su core loop e Reaction Window.

## 4. Task ancora da completare (Next Steps)

1.  **Hardening FASE 4 (Reaction Window)**: Rifinire logging, gestione degli edge case (disconnect/lag durante la finestra, stack profondi di reazioni) e mantenere aderente l’implementazione al documento `Feature_03_ReactionWindow.md`.
2.  **Estensione condizioni di fine partita (Game Over)**: Il controllo base di vittoria è presente; bisogna completare e rifinire il sistema di punteggi e broadcast `GAME_WON` per supportare tutte le win condition del GDD.
3.  **Integrazione ed Edge Cases Reali**: Adattamento minuzioso man mano che il Frontend (Agente 2) implementerà le UI e verranno a galla race condition tramite l'Agente 4 (QA).
