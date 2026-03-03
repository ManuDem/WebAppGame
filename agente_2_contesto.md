# Contesto Agente 2 (Frontend Developer)

## Ruolo e Obiettivi
Sono l'**Agente 2**, il Frontend Developer responsabile dello sviluppo dell'interfaccia visiva e dell'esperienza utente per "LUCrAre: SEMPRE", un gioco di carte multiplayer web asimmetrico a tema saturazione aziendale. 
Il mio obiettivo principale è tradurre le meccaniche di gioco e i contratti di rete dettati dal Backend in un'interfaccia interattiva e responsiva che gira nel browser del giocatore.

## Regole e Direttive Architetturali
Tutto il mio sviluppo si fonda su rigide linee guida:
1.  **Server come Source of Truth Assoluta:** Il frontend è "stupido". Non mantiene stato interno autonomo (no contatori PA o validazioni logiche), non esegue generazione di numeri casuali (RNG), e non deduce i risultati delle proprie azioni. Ogni interazione utente invia un messaggio, e il frontend si aggiorna *solo* in reazione ai cambiamenti dello stato di Colyseus (`onStateChange`, `onPlayerChange`) spinti dal Server.
2.  **Adozione Rigorosa dei Contratti di Rete:** Ogni classe, payload o enumeratore scambiato deve derivare obbligatoriamente dal file `shared/SharedTypes.ts` scritto dall'Agente 0.
3.  **Tecnologia Esclusiva:** `Phaser.js 3`, `TypeScript`, `Vite` (per il build locale) e `colyseus.js` (client di rete).
4.  **Design "Mobile-First":** Orientamento portrait rigido (es. 390x844 scalato via `FIT`). Interfaccia divisa in Top UI (avversari), Center UI (tavolo pubblico) e Bottom UI (mano propria/azioni rapide).

## Progressi dello Sviluppo (Ad Oggi)

### Fase 1: Setup Progetto
*   Ho inizializzato l'ambiente di build con **Vite + TypeScript**.
*   Ho creato le fondamenta dell'architettura di Phaser: configurazione in `main.ts`, gestione base del loader in `BootScene`, divisione spaziale delle 3 macroaree in `GameScene`.
*   Ho abbozzato le logiche visive per la rappresentazione delle carte (`CardGameObject`).

### Fase 2: Core Loop Base (Sync)
*   Ho instradato il workspace in modo che Vite compili correttamente gli import assoluti puntando alle interfacce di rete del server (`../shared/SharedTypes.ts`).
*   Ho astratto la gestione asincrona dei socket tramite la classe **`ServerManager.ts`**.
*   Ho implementato il binding reattivo in `GameScene.ts` per ricostruire la Mano del giocatore (le carte in basso) reagendo rigorosamente al payload `player.hand` fornito dal server ad ogni callback di stato.

### Fase 3: Connessione e Lobby
*   Ho attivato l'overlay DOM nativo (`dom.createContainer: true`) nel config di Phaser.
*   Ho costruito una **`LoginScene.ts`** contenente un input di testo HTML ibrido per collezionare il `ceoName` (nome ufficio) e pre-validarlo in locale.
*   Ho incapsulato tale payload nelle `JoinOptions` passandolo come parametro critico per l'ingresso nella stanza di Colyseus denominata `office_room`.

### Fase 4: HUD Core Loop
*   In ottemperanza alla Feature 02 dell'Architetto, ho costruito i bottoni **Mazzo** (Pesca carta) e **Fine Turno**.
*   Ho introdotto e bindato l'HUD dei **Punti Azione (PA)**.
*   Ho implementato l'indicatore di rotazione ("DI CHI È IL TURNO") bloccando lo strato interattivo (`disableInteractive()`) di bottoni e mazzo ogni qualvolta il client corrente non coincide con il sessionId dettato dal parametro di Stato del server `currentTurnPlayerId`.

### Verifica ed Error Fixing
*   Compilazione rigida via `tsc --noEmit` completata con Exit Code 0. Risolti un paio di type overloads in Colyseus listener e correzioni di nomi su CardEffectParser in area shared.

## Task Ancora da Completare (Next Steps Presunti)

In attesa delle direttive per la successiva architettura e per allineamenti visivi (mocks Agente 3):
1.  **Fase Reazioni/Collisioni (Drag & Drop):** Implementazione in Phaser del sistema di *Drag & Drop* delle carte in mano su target specifici nel centro del tavolo (Drop Zones) per triggare `ClientMessages.PLAY_EMPLOYEE` e `SOLVE_CRISIS`.
2.  **Animazioni Event-Driven:** Risposta visiva agli `ServerEvents` "Flash". (es. mostrare floating text rosso quando si tenta di pescare senza PA, un'animazione quando una "Reaction Window" di 5 secondi viene aperta sulla UI per difendersi).
3.  **UI Top (Avversari):** Mostrare dinamicamente chi siede al tavolo, formattando su griglia compatta il conteggio carte/hand per ogni avversario noto nello Stato.
4.  **Cards DB:** Integrazione dei template visivi dettati dal DB finale delle carte in `CardGameObject` (colori dinamicamente assegnati che riflettono la natura della carta Employee/Crisis/Reaction ecc.).
