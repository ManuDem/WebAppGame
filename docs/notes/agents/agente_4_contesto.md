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
* **Creazione Suite "Reaction Window" (Fase 4):**
  - Implementato `reaction_stress.test.ts` con instanziazione sintetica di `OfficeRoom`.
  - Simulata **Race Condition**: `PLAY_EMPLOYEE` di un giocatore e due `PLAY_REACTION` simultanei nello stesso millisecondo. Verificata corretta coda in `actionStack` e deferimento. La suite passa con esito **Verde**.
  - Simulata **Rage Quitting**: Disconnessione improvvisa durante il timer della Reaction Window. Il server non crasha, resetta lo stato e prosegue regolarmente la partita. La suite passa con esito **Verde**.
  - Simulato **Cheat**: Invio di `PLAY_REACTION` fuori dalla finestra temporale (in `PLAYER_TURN`). Il server intercetta, respinge con `NO_REACTION_WINDOW` e mantiene integro lo stato. Mossa malevola bloccata. La suite passa con esito **Verde**.
* **Creazione Suite "Win Conditions & End-to-End" (Fase 5):**
  - Implementato `win_conditions.test.ts` in modo nativo su Node.js scavalcando i renderer.
  - **Monopolio Umano:** Verificato che all'assunzione del 4° dipendente il server emetta correttamente `GAME_WON` ed entri in `GAME_OVER`. Sventato e fixato bug di duplicazione del server state causato da parser/officeroom paralleli.
  - **Problem Solver:** Verificato che alla risoluzione della 2° crisi il server emetta `GAME_WON` evitando calcoli misti per i VP.
  - **Penalità Crisi:** Testate `lose_employee` e `discard_2` verificate sull'inventario degli altri giocatori. Funzionante.
  - **Prevenzione Cheat (Targeted Tricks):** Accertato che omettere un `targetPlayerId` su carte ad personam fa rimbalzare la richiesta con errore `MISSING_TARGET`. Test **Verde**.

## 4. Task Ancora da Completare

Tutti i foundation tests core ("Fase 1 Lobbies", "Fase 2 Loops", "Fase 4 Reaction", "Fase 5 End-to-End") sono VERDI.
L'architettura Node è solida. Restano da validare solo i futuri protocolli della Visual Queue di Agent 0.
