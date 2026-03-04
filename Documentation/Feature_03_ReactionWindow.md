# Feature 03: Reaction Window & Stack di Risoluzione (FASE 4)

## 1. Introduzione
La "Reaction Window" (o Finestra di Reazione) rappresenta la meccanica centrale di interazione diretta ("Pugnalate alle spalle") in *LUCrAre: SEMPRE*. Permette ai giocatori di interrompere l'azione attiva di un avversario giocando particolari carte "Reazione" prima che l'azione stessa diventi definitiva.

## 2. Trigger della Reaction Window
La finestra di reazione si apre automaticamente quando un giocatore, durante il proprio turno, gioca un messaggio di tipo "criticabile" secondo il design attuale:
- `PLAY_EMPLOYEE` (Assunzione Dipendente)
- `SOLVE_CRISIS` (Risoluzione Crisi)
- `PLAY_MAGIC` (Magheggio ad effetto immediato ma contestabile)

Altre azioni (es. `DRAW_CARD`, `END_TURN`) **non** innescano la Reaction Window e si risolvono istantaneamente.

## 3. Gestione di Stato (Server)
Non appena viene ricevuta un'azione criticabile validata (es. il giocatore ha abbastanza PA), il Server (Agente 1 e Agente 3) deve:
1. **Deducazione PA immediata**: Dedurre il costo dell'azione dal giocatore di turno.
2. **Cambio Fase**: Portare `IGameState.phase` a `GamePhase.REACTION_WINDOW`.
3. **Tracking dell'Azione**: Istanziare `IGameState.pendingAction` contenente:
   - `playerId` (Chi ha iniziato l'azione)
   - `actionType` (Es. `PLAY_EMPLOYEE`)
   - `targetCardId` / `targetCrisisId` (I riferimenti necessari per risolverla poi)
   - `timestamp` (Momento inizio finestra)
4. **Timer**: Impostare `reactionEndTime` (timestamp + 5000 ms) ed avviare un `Delayed` su Colyseus di 5 secondi.

## 4. Reazioni Avversarie
Durante questi 5 secondi, gli **avversari** (non chi ha triggerato l'azione) possono:
- Inviare il messaggio `PLAY_REACTION` con il `cardId` della carta Reazione che intendono giocare dalla propria mano.
- Il Server valuterà se l'avversario ha i PA necessari ed i requisiti della carta, deduplicandoli ed aggiungendo la reazione in una coda temporanea invisibile a Schema.
- Inviare `REACTION_TRIGGERED` in broadcast per permettere all'Agente 2 (Frontend) di mostrare un feedback visivo immediato (es. animazione "Obiezione!").

## 5. Fase di Risoluzione (RESOLUTION)
Allo scadere dei 5 secondi del timer:
1. Il Server entra in `GamePhase.RESOLUTION`.
2. Il Motore di Gioco (Agente 3) preleva la coda delle reazioni giocate (se presenti).
3. **Risoluzione LIFO (Last In, First Out)**: Le reazioni vengono risolte a catena, partendo dall'ultima giocata verso la prima, ed infine applicate all'azione originale salvata in `pendingAction`.
4. *Esempio: Se l'azione era `PLAY_EMPLOYEE`, e una reazione giocata blocca gli inserimenti di dipendenti in azienda, il Motore annullerà il completamento della `pendingAction`. La carta dipendente andrà negli scarti ed i PA non verranno rimborsati.*
5. Il Server effettua il broadcast di `ACTION_RESOLVED` con i risultati, porta a `null` la `pendingAction`, ed imposta la fase di nuovo a `GamePhase.PLAYER_TURN`.

## 6. Ruolo Front-End (Agente 2)
Il Client deve reagire reattivamente in base ai cambiamenti di Stato:
- **Al cambio di fase REACTION_WINDOW**: Mostrare un conto alla rovescia di 5 secondi sullo schermo, con l'indicazione dell'azione "In Sospeso". Disabilitare l'interazione per il giocatore di turno, ma permettere agli avversari di cliccare carte Reazione.
- **Alla ricezione di `REACTION_TRIGGERED`**: Non mostrare la risoluzione (che avviene dopo), ma solo un popup "Player X sta reagendo!".
- **Alla ricezione di `ACTION_RESOLVED`**: Aggiornare la visuale con il risultato (Successo / Fallimento).
