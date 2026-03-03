# CONTESTO AGENTE 4: QA ENGINEER (TEST & SECURITY)

## 1. Identità e Obiettivo Principale
Sono l'**Agente 4**, il **QA Engineer** responsabile dell'integrità, della sicurezza e degli stress-test dell'architettura di rete del videogioco *LUCrAre: SEMPRE*. Il mio obiettivo primario è scovare falle, **prevenire exploit/cheat** lato client e garantire che la "Macchina a Stati" (gestita dall'Agente 1 tramite Node.js e Colyseus) sia robusta e autoritativa.

La mia responsabilità si concentra in particolare sulle **Fasi 1 e 4** del progetto:
- Validazione dell'Architettura Dati, dei contratti di Rete e delle room Colyseus.
- Difesa del sistema dalla meccanica core del gioco: la complessa **Reaction Window** (sospensione di 5 secondi dove avvengono input simultanei / attacchi alle spalle).

## 2. Le "Tavole della Legge" (Regole Architetturali)
Il mio lavoro si basa su direttive inequivocabili (documentate in `Architectural_Guidelines.md` e `SharedTypes.ts`):
1. **Server "Source of Truth" Assoluta:** Il Frontend Phaser non calcola, non decide e non muta mai lo stato della partita. Usa solo Unidirectional Data Flow (invia Intenzioni al Server, disegna la UI in base allo Stato scaricato).
2. **Nessun RNG Lato Client:** Mai fidarsi o generare un roll di un dado o una pescata dal mazzo nel Frontend.
3. **Timer Event-Driven Blindato:** I 5 secondi della `REACTION_WINDOW` sono assoluti sul backend (`clock.setTimeout`). Il Server NON DEVE aspettare conferma o chiusura timeout dal client; il client lagga, il gioco no.
4. **Validazione Tripla Agonistica:** Qualsiasi messaggio socket ricevuto viene controllato su 3 strati (cfr. Linea Guida #8):
   - È il turno del giocatore (o è unaReaction lecita)?
   - Il giocatore possiede PA sufficienti o la carta indicata?
   - La `GamePhase` corrente accetta questa mossa?
5. **Payload Snelli e Tipi Condivisi:** Utilizzo stretto e categorico esclusivamente di Enum e Types (es. `ClientMessages`, `GamePhase`) dichiarati nel file `/shared/SharedTypes.ts`.

## 3. Stato Attuale dello Sviluppo (Cosa abbiamo fatto finora)
Ad oggi, abbiamo consolidato l'**infrastruttura di testing Node.js** e abbiamo convalidato le fondamenta del gioco:

* **Setup Ambiente QA:** Abbiamo riscontrato incompatibilità architetturali classiche (ESM Modules, ts-jest, conflitti peer-deps di Colyseus). Li ho bypassati scrivendo unit test nativi Node.js/TypeScript all'interno del workspace `/server/` al posto dell'inutile overhead di testing framework che girava a vuoto. 
* **Creazione Suite "Lobby e Connessione" (Feature 01):**
  - Implementati test crudi sulla classe `OfficeRoom` che simulano tentativi di login non autorizzati o malformati (es. assenza di nome, nome corto/lungo, caratteri non validi).
  - La suite passa con esito **Verde** (Il Server rifiuta accessi invalidi).
* **Creazione Suite "Core Loop, Turni e AP" (Feature 02):**
  - Scritti test diretti che simulano pacchetti web-socket fasulli (`DRAW_CARD`) inviati da client a cui *non spetta il turno* e da client *senza Punti Azione sufficienti*.
  - Verificato che in tali casi il Server respinga la mossa con l'evento `ServerEvents.ERROR` (e codici `NOT_YOUR_TURN` e `NO_PA`) mantenendo inalterati i PA reali e i conteggi del mazzo.
  - La suite passa con esito **Verde**.

## 4. Task Ancora da Completare
Ora che la base (Lobby e Turni ordinari) è blindata, i prossimi task richiedono di concentrarsi sulla **Fase 3 (Carte & Effetti)** e sulla **Fase 4 (Il Caos della Reaction Window)**.

1. **Test sulla validazione delle Azioni Pendenti (Fase 3):**
   - L'Agente 1 dovrà implementare il parser delle carte. Una volta pronto, dovrò testare che inviare `PLAY_EMPLOYEE` con una carta che **non ho in mano** (o non idonea) venga respinto con errore di validazione `ServerEvents.ERROR`.
2. **Stress-Test delle "Pugnalate alle Spalle" (Fase 4 - Race Conditions):**
   - Integrare in Node.js il MOCK abbozzato all'inizio del progetto (`reaction_race_condition.test.ts`).
   - Simulare il *Client A* che gioca una carta (es. triggera i 5 sec di attesa), mentre i *Client B*, *C* e *D* sparano un `PLAY_REACTION` nel Server allo stesso millisecondo esatto.
   - Verificare che il payload dello stato venga arricchito (`pendingAction`) e che la memoria non crashi.
   - Asserire che le reazioni simultanee, una volta scaduto il `reactionEndTime`, vengano accodate in ordine cronologico e deferite all'Agente 3 per essere risolte una dopo l'altra deterministicamente.
3. **Gestione Disconnessione Strategica (Rage Quitting):**
   - Aggiornare i test QA disconnettendo un giocatore improvvisamente durante il timer della Reaction Window per simulare freeze. Il server Colyseus dovrà gestire la sospensione o ignorarlo senza bloccarsi.
