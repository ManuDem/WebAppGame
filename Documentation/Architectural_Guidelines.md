# Linee Guida Architetturali "LUCrAre: SEMPRE"

Queste direttive sono vincolanti per lo sviluppo. Ogni Agente (Frontend, Backend, Data) è tenuto a rispettarle ciecamente per garantire una base di codice modulabile, sicura (anti-cheat) e sincronizzata.

## 1. Server "Source of Truth" assoluta
Il Backend in Colyseus è l'unico detentore dello stato legittimo della partita. Il Frontend (Phaser) non muta *mai* localmente lo stato in modo definitivo; si limita ad inviare intenzioni (Intentions/Messages) tramite i `ClientMessages` e ad aggiornare la UI in reazione ai cambiamenti dello State inviati dal server.

## 2. Nessun RNG lato Client
Tutti i calcoli non deterministici (RNG) — come pescare carte, lanciare dadi per risolvere una crisi o mescolare mazzi — avvengono nel Backend. Il Frontend riceve il pacchetto col risultato (`DICE_ROLLED`, ecc.) e si limita a renderizzare l'esito grafico (es. animando il dado che rotola).

## 3. Optimistic UI controllata
Durante il proprio turno, il Frontend può anticipare alcune animazioni fluide (Optimistic UI come trascinare la propria carta al centro tavolo). Tuttavia, se l'azione fallisce (errore validazione, no PA) o viene annullata durante la *Reaction Window*, il client deve eseguire un "rollback" visivo dell'azione (riportando la carta in mano al giocatore).

## 4. Design della "Reaction Window" (Event-Driven Timeout)
Quando un giocatore chiama un `PLAY_EMPLOYEE` o un `SOLVE_CRISIS`, il Backend avvia un timer di 5 secondi (in millisecondi), congela la `GamePhase` in `REACTION_WINDOW` e popola `pendingAction`.
* Il Frontend usa `reactionEndTime` inviato dal server per disegnare la UI del conto alla rovescia, ma **NON invia mai** un messaggio al termine del timer. 
* È un timeout del backend (`clock.setTimeout`) che conclude in automatico la Transaction quando il tempo è scaduto.

## 5. Separazione tra Struttura a Stato e Eventi Ephemerals
Colyseus sincronizza lo State per i dati *persistenti* (Quanti PA ho? Che fase è?). Ma azioni rapide e visive (es. Particellare di Danno, un giocatore che ride, l'annegamento di una transazione fallita da una reazione avversaria) si gestiscono preferibilmente via `room.broadcast(ServerEvents)` per non "sporcare" la macchina a stati con flag effimeri.

## 6. Blindness dei Dati Privati (Fog of War)
Non condividere le carte in mano degli altri giocatori tramite State. Utilizzare le funzionalità di filtro Schema (`@filter`) di Colyseus in modo che la `hand` contenga oggetti `ICardData` validi solo per il proprietario. Gli avversari vedranno le carte dell'altro client come oggetti vuoti (conteranno solo il `.length` per l'UI).

## 7. Isolamento del Modulo Data (Cards Engine - Agente 3)
La risoluzione effettiva del gioco risiede nelle funzioni di utilità che elaborano gli effetti. L'Agente 3 scriverà funzioni agnostiche lato network (nessuna dipendenza da Colyseus o WebSockets). Il server Node si limiterà a passare a tale Engine gli oggetti `IPlayer` per modificarli, per poi sincronizzarli col meccanismo integrato di Colyseus.

## 8. Validazione Tripla
Ogni messaggio Client `room.onMessage` deve essere vagliato severamente dal backend per evitare cheating:
   1. *Turno*: È davvero il turno del mittente (o siamo in Reaction)?
   2. *Risorse*: Possiede i PA necessari e la carta in mano è valida?
   3. *Possibilità*: La fase di gioco corrente ammette quest'azione?
Inviando `ServerEvents.ERROR` per rigettare le chiamate invalide.

## 9. Struttura del Messaggio snella
I payload scambiati via WebSocket devono contenere ID/Indici minimi. E.s.: `{ cardId: "h2v3-12", targetCrisis: "c-11" }`. Niente logica (`{ cost: 2 }` è proibito: il server la ricava dal DB `cards_db.json`).

## 10. Robustezza del Ripristino Connessioni
Colyseus permette la disconnessione e la riconnessione istantanea (`allowReconnection`). Il Frontend deve essere scritto "Reactively": riaccendendo il browser e scaricando l'intero albero di stato, la scena Phaser dovrà ricostruirsi automaticamente al 100% sulla base delle variabili scaricate all'istante (stato delle carte in tavola, chi gioca, timer rimanente). Meno "stato" viene salvato internamente in Phaser, più facile sarà il reconnetting.
