# Contesto dell'Agente 0 (Tech Lead & System Architect)

## 1. Il Mio Ruolo e le Mie Regole
Nel progetto **"LUCrAre: SEMPRE"** ricopro il ruolo di **Agente 0 (Tech Lead & System Architect)**. 
Sono il responsabile tecnico supremo dell'intero progetto. Le mie mansioni e regole sono chiare e rigorose:
* **Traduzione Architetturale:** Non scrivo il codice implementativo finale del gameplay (ad eccezione delle revisioni di sicurezza), ma traduco i requisiti del Project Manager (il GDD) in specifiche tecniche, interfacce Typescript condivise e direttive.
* **Network Contracts:** Stabilisco le regole di ingaggio tra il Frontend (Agente 2) e il Backend (Agente 1 e 3) definendo i modelli strutturali. Gli altri agenti sono tenuti a seguire *ciecamente* le mie interfacce.
* **Coerenza e Sicurezza:** Mantengo una visione dall'alto (`Server Authority`), imponendo validazioni stringenti per evitare cheating ed incongruenze nello stato distribuito (`Colyseus`).
* **Code Review:** Quando necessario, revisiono il codice prodotto dagli altri Agenti per assicurarmi che rispetti scrupolosamente il contratto prestabilito, correggendo personalmente sbavature di tipizzazione (`any`) o di logica critica.

## 2. Quanto abbiamo Sviluppato Finora (Completato)

Ho gettato con successo le fondamenta architetturali per le **Fasi 1, 2 e 3**, creando e revisionando i contratti di base:

### FASE 1 - Architettura Dati e Setup Base
* Creazione di **`shared/SharedTypes.ts`**: L'unico file di verità per le Interfacce di Stato (Es. `IGameState`, `IPlayer`, `ICardData`, ecc.), le fasi della partita (`GamePhase`) e i messaggi scambiabili tra Server e Client (`ClientMessages`, `ServerEvents`).
* Creazione di **`Documentation/Architectural_Guidelines.md`**: Un decalogo di 10 regole inviolabili (Server "Source of Truth", Nessun RNG Lato Client, Validazione Tripla, Event-Driven UI, ecc.) per sincronizzare Colyseus (Backend) e Phaser.js (Frontend).

### FASE 2 - Connessione e Lobby ("OfficeRoom")
* Specifica in **`Feature_01_Lobby.md`**: Direttive rigorose sulla validazione in ingresso onJoin (timeout di riconnessione di 30 secondi e check del nome).
* Aggiornamento a `SharedTypes.ts` inserendo il contratto `JoinOptions` per assicurare l'invio e il riconoscimento del `ceoName`.
* **Code Review chirurgica:** Ho revisionato direttamente `OfficeRoom.ts` (Backend) e `LoginScene.ts` (Frontend), correggendo sviste di tipizzazione (da `any` al corretto payload) e migliorando la stabilità della macchina a stati evitando doppi inneschi in `startGame()`.

### FASE 3 - Core Loop Base (Turni, PA e Pesca)
* Creazione di **`Feature_02_CoreLoop.md`**: Definizione puntigliosa dei turni in Round-Robin, del costo delle azioni (es. Pescare costa 1 PA su 3 disponibili) e interazione.
* Aggiornamento a `SharedTypes.ts`: Inserimento esplicito del round-robin (`turnIndex`), inserimento di costanti univoche (`MAX_ACTION_POINTS`, `DRAW_CARD_COST`) e mappatura di tutti i payload di ritorno (es. `ITurnStartedEvent`).

## 3. Task Ancora da Completare (Prossimi Obiettivi)

Se la Fase 3 passa ora in mano all'implementazione effettiva da parte degli Agenti operativi (con la scrittura di Test, e sviluppo visivo), il mio lavoro architetturale e direzionale dovrà ancora coprire:

1. **Revisione Codice della Fase 3:** Una volta che gli Agenti 1 e 2 avranno implementato pescate, punti azioni ed End Turn, dovrò assicurare l'assenza di loop o vulnerabilità (verificando inoltre lo strato Data dell'Agente 3 per la generazione del Deck).
2. **Progettazione Architetturale della FASE 4 (Reaction Window):** Questa è la sfida tecnica più grande ("Le Pugnalate alle spalle"). Dovrò delineare l'evento di interruzione di 5 secondi, le interfacce per la coda di risoluzione (PendingAction) e stabilire come il motore (Agente 3) annullerà le intenzioni bloccate.
3. **Pianificazione dell'Integrazione Carte Effetti (Fase 3/4 Data):** Redazione delle interfacce che l'Agente 3 dovrà usare in `resolveEffect()` o affini, stabilendo come un template JSON (es `cards_db.json`) generi logica typescript eseguibile.
4. **Validazione della FASE 5:** Sorveglianza sul Polish finale di Phaser.js per garantire che le code di animazione non desincronizzino lo stato del Server. 

*(Fine Documento)*
