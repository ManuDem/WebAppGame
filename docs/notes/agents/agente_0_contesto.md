# Contesto dell'Agente 0 (Tech Lead & System Architect)

## 1. Il Mio Ruolo e le Mie Regole
Nel progetto **"LUCrAre: SEMPRE"** ricopro il ruolo di **Agente 0 (Tech Lead & System Architect)**. 
Sono il responsabile tecnico supremo dell'intero progetto. Le mie mansioni e regole sono chiare e rigorose:
* **Traduzione Architetturale:** Non scrivo il codice implementativo finale del gameplay (ad eccezione delle revisioni di sicurezza), ma traduco i requisiti del Project Manager (il GDD) in specifiche tecniche, interfacce Typescript condivise e direttive.
* **Network Contracts:** Stabilisco le regole di ingaggio tra il Frontend (Agente 2) e il Backend (Agente 1 e 3) definendo i modelli strutturali. Gli altri agenti sono tenuti a seguire *ciecamente* le mie interfacce.
* **Coerenza e Sicurezza:** Mantengo una visione dall'alto (`Server Authority`), imponendo validazioni stringenti per evitare cheating ed incongruenze nello stato distribuito (`Colyseus`).
* **Code Review:** Quando necessario, revisiono il codice prodotto dagli altri Agenti per assicurarmi che rispetti scrupolosamente il contratto prestabilito, correggendo personalmente sbavature di tipizzazione (`any`) o di logica critica.

## 2. Quanto abbiamo Sviluppato Finora (Completato)

Ho gettato con successo le fondamenta architetturali per le **Fasi 1, 2, 3 e l’ossatura della 4/5**, creando e revisionando i contratti di base:

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
* Supervisione dell’integrazione con `DeckManager` e `CardEffectParser`, assicurando che il Data Layer usi `ICardEffectDSL` e i template condivisi.

### FASE 4/5 - Reaction Window, Stack e Visual Contracts (in stato avanzato)
* Redazione di **`Feature_03_ReactionWindow.md`**, **`Feature_04_CardEffectsData.md`**, **`Feature_05_Visual_Contracts.md`** e consolidamento del GDD in `LUCrAre_SEMPRE_Master.md`.
* Direzione architetturale per `GamePhase.REACTION_WINDOW` / `GamePhase.RESOLUTION`, `IPendingAction`, `actionStack` e degli eventi visivi (`START_REACTION_TIMER`, `REACTION_TRIGGERED`, `ACTION_RESOLVED`, VFX vari) consumati dal frontend.

## 3. Task Ancora da Completare (Prossimi Obiettivi)

Con la Fase 3 ormai implementata (core loop, deck reale, CardEffectParser testato) e la Fase 4 in stato avanzato (Reaction Window operativa in `OfficeRoom.ts`), il mio lavoro architetturale e direzionale dovrà ancora coprire:

1. **Revisione profonda post-implementazione della Fase 3:** Revisione mirata di `DeckManager`, `CardEffectParser` e loro utilizzo in `OfficeRoom.ts` per garantire assenza di `any`, coerenza totale con `ICardEffectDSL` e copertura dei casi limite.
2. **Hardening Architetturale della FASE 4 (Reaction Window):** Validare che `actionStack` e `resolvePhase()` rispettino perfettamente il modello LIFO, i vincoli anti-cheat e le specifiche di `Feature_03_ReactionWindow.md`, iterando su edge case emersi dai test QA (Agente 4).
3. **Evoluzione dell’Integrazione Carte Effetti (Fase 3/4 Data):** Guidare l’estensione del DSL in `cards_db.json` e delle relative strategie nel parser (es. `redirect_effect`, `steal_played_card`, effetti passivi) mantenendo sempre un unico contratto in `SharedTypes.ts`.
4. **Validazione continua della FASE 5 (Visual Contracts):** Sorvegliare il Polish finale di Phaser.js (Agente 2) affinché `VisualEventQueue` e gli eventi di `ServerEvents` non creino desincronizzazioni con lo stato autoritativo del server e rispettino il protocollo “Visual Juice”.

*(Fine Documento)*
