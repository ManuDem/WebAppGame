# MASTER DOCUMENT: "LUCrAre: SEMPRE" (GDD & SOW)

## 0. Stato Fasi di Sviluppo (Snapshot)

- **FASE 1 – Architettura Dati e Setup Base**: ✅ Completata  
  - `SharedTypes.ts`, schema Colyseus e linee guida architetturali stabili.
- **FASE 2 – Core Loop Base (Sincronizzazione)**: ✅ Completata  
  - Join/Leave, ordine turni, PA, pesca (`DRAW_CARD`) implementati e testati.
- **FASE 3 – Interattività e Logica Carte**: ✅ Funzionale, in iterazione  
  - `DeckManager`, `CardEffectParser`, integrazione in `OfficeRoom.ts`, test su deck/effects.
- **FASE 4 – Reaction Window & Stack**: 🟡 Avanzata / Hardening in corso  
  - `GamePhase.REACTION_WINDOW / RESOLUTION`, `pendingAction`, `actionStack`, timer e integrazione QA operativi.
- **FASE 5 – Visual Contracts & Polish**: 🟡 In corso  
  - `VisualEventQueue`, eventi visivi (`SHOW_ANIMATION`, `START_REACTION_TIMER`, ecc.) e protocollo "Visual Juice" in via di consolidamento.

---

## 1. VISIONE E SPECIFICHE DEL PROGETTO
* **Titolo:** LUCrAre: SEMPRE
* **Genere:** Party Card Game Competitivo (Web-based, Mobile-First).
* **Tema e Vibe:** Satira feroce sul mondo del lavoro. I giocatori sono "CEO" senza scrupoli pronti a tutto per arricchirsi e sabotare i colleghi.
* **Stack Tecnologico:** Node.js + Colyseus (Backend State Management), Phaser.js + TypeScript (Frontend 2D).
* **Target:** 3-10 giocatori. Durata media: 30-45 minuti.

---

## 2. GAME DESIGN E MECCANICHE

### Obiettivi di Vittoria (Il primo che ne soddisfa uno, vince)
1. **Monopolio Umano:** Avere 5 carte "Dipendente" di ruolo diverso assunte e attive nella propria area di gioco (Azienda).
2. **Problem Solver:** Sconfiggere 3 carte "Crisi Aziendale" pubbliche situate al centro del tavolo.

### Il Turno di Gioco
Il gioco procede a turni rigorosi. Ogni giocatore ha **3 Punti Azione (PA)** per turno. Azioni possibili:
* **Pescare:** Prendere 1 carta dal mazzo (Costo: 1 PA).
* **Assumere un Dipendente:** Giocare una carta Dipendente dalla mano alla propria Azienda. Fornisce bonus passivi (Costo: indicato sulla carta).
* **Fare un Magheggio:** Giocare una carta azione a effetto immediato (Costo: 1-2 PA).
* **Risolvere una Crisi:** Tentare di superare una Crisi Aziendale al centro del tavolo tramite requisiti specifici o tiro di dado RNG (Costo: 2 PA).

### La Meccanica Core: Le "Pugnalate alle Spalle" (Reaction Window)
Per rendere il gioco "caciarone", esiste il tipo di carta **Reazione**. 
* **Trigger:** Quando un giocatore spende PA per *Assumere un Dipendente* o *Risolvere una Crisi*, l'azione non è immediata.
* **Finestra di Reazione:** Il server sospende il turno per **5 secondi esatti**. 
* **Risoluzione:** In questa finestra, *qualsiasi* altro giocatore può giocare una carta "Reazione" (es. Ispezione a sorpresa, Furto di idee) per annullare l'azione originale, rubare la carta o alterare l'esito.

---

## 3. PROFILI DEL TEAM (AGENTI IA) E RESPONSABILITÀ

* **🧠 Agente 1 (Backend Architect):** Proprietario di Node.js e Colyseus. Gestisce la Room, lo State Schema (Giocatori, Mazzo, Aziende, Crisi centrali) e la complessa macchina a stati necessaria per il timer della *Reaction Window*.
* **🎨 Agente 2 (Frontend Dev):** Proprietario di Phaser.js. Crea l'interfaccia 2D Mobile-First. Gestisce il drag-and-drop delle carte, la visualizzazione della mano in basso, il tavolo al centro e i timer visivi per le reazioni.
* **⚙️ Agente 3 (Game Logic & Data):** Proprietario del database delle carte (`cards_db.json`) e del parser degli effetti. Traduce le regole in JSON e funzioni TypeScript per risolvere danni, furti e annullamenti.
* **🕵️‍♂️ Agente 4 (QA Engineer):** Proprietario del testing. Il suo scopo è stressare il server Colyseus scrivendo script che simulano input simultanei durante i 5 secondi della Reaction Window per prevenire crash e cheat.

---

## 4. PIANO DI SVILUPPO SEQUENZIALE (SPRINT)

* **FASE 1 - Architettura Dati e Setup Base:**
  * Backend: Inizializzazione Node/Colyseus, definizione formale dello State Schema (chi è di turno, cosa c'è in tavola).
  * Data: Creazione del file `cards_db.json` con 15 carte di test divise nei 4 tipi (Dipendente, Magheggio, Crisi, Reazione).
  * Frontend: Setup di Phaser.js, asset loading (placeholder) e creazione della Scena principale (tavolo verde vuoto).

* **FASE 2 - Core Loop Base (Sincronizzazione):**
  * Backend: Implementazione dei messaggi `JoinRoom`, `DrawCard`, `EndTurn`.
  * Frontend: Connessione del client Colyseus. Rappresentazione visiva della mano del giocatore e rendering a schermo del passaggio del turno.

* **FASE 3 - Interattività e Logica Carte:**
  * Data: Scrittura della funzione TypeScript `resolveEffect()` per applicare gli effetti delle carte allo stato.
  * Frontend: Implementazione drag-and-drop in Phaser. Giocare una carta invia il comando al server e sposta visivamente la carta.
  
* **FASE 4 - Il Caos (Sistema di Reazione):**
  * Backend: Implementazione della pausa di 5 secondi (`REACTION_WINDOW`) nella State Machine. 
  * Frontend: UI per il timer a schermo e tasto rapido "Interrompi" per gli avversari.
  * QA: Scrittura di test automatizzati per simulare 4 giocatori che lanciano una "Reazione" nello stesso millisecondo.

* **FASE 5 - Polish Visivo (Phaser):**
  * Frontend: Aggiunta di feedback succosi (screen shake quando si subisce una pugnalata, particellari, animazioni fluide delle carte).