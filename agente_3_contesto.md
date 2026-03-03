# Contesto e Stato dei Lavori - Agente 3 (Game Logic & Data)

Questo documento riassume il ruolo, le responsabilità, le regole architetturali seguite, il lavoro completato finora e i task futuri assegnati all'Agente 3 nel progetto **"LUCrAre: SEMPRE"**.

## 1. Ruolo e Responsabilità
Come **Agente 3**, sono il proprietario del "cervello" delle carte. Il mio ruolo consiste nel:
* Tradurre le regole di game design e gli effetti delle carte in dati strutturati (JSON).
* Scrivere la logica matematica pura necessaria per risolvere gli effetti delle carte (parser).
* Garantire che la logica di gioco sia completamente isolata (Environment-Agnostic): non deve avere dipendenze dal motore grafico (Phaser) né dai WebSockets/State Management diretti (Colyseus). Il codice restituisce risultati o muta le istanze degli oggetti passati.

## 2. Regole Architetturali e Vincoli
Tutto il lavoro di questo Agente segue rigorosamente le **Linee Guida Architetturali** e il documento **Feature 02: Core Loop**:
* **Source of Truth Assoluta:** I tipi definiti in `shared/SharedTypes.ts` (`IGameState`, `IPlayer`, `ICardData`) sono l'unica base contrattuale. Nessuna deviazione è permessa.
* **Separazione dei Compiti:** Le funzioni di parsing e gestione mazzo devono limitarsi a mutare la memoria delle interfacce. Sarà l'Agente 1 (Backend Node.js/Colyseus) a iniettare lo stato nel mio parser e a diffondere poi i cambiamenti ai client.
* **Nessun RNG su Client:** Ogni logica aleatoria (Fisher-Yates per mescolare il mazzo, estrazioni casuali dalla mano per i furti) è scritta e testata nella mia logica pura in esecuzione sul server.
* **Data Blindness (Fog of War):** Il codice è strutturato tenendo presente che il server maschererà la composizione della mano degli avversari agli altri client, pertanto la logica di utilità manipola liberamente gli UUID.
* **Reaction Window & Pending Actions:** Il parser degli effetti è predisposto per non forzare la risoluzione immediata, rispettando il sistema ad eventi ritardati di 5 secondi in cui l'Agente 1 inserirà le giocate nella coda `pendingAction`.

---

## 3. Moduli Sviluppati (Lavoro Completato)

Fino a questo momento, per supportare la FASE 1, 2 e preparare la FASE 3 del progetto, ho realizzato i seguenti asset all'interno della cartella `shared/`:

### 3.1 `cards_db.json`
Il database strutturato delle carte. Include 15 carte di test progettate seguendo il tema della satira aziendale.
* **Struttura di ogni carta:** `id`, `name`, `type` (Employee, Trick, Crisis, Reaction), `cost`, `description`, `effect` (Oggetto standardizzato).
* **Tipologie create:** Dipendenti (es. "Lo Stagista Sfruttato"), Magheggi (es. "Falso in Bilancio"), Crisi ("Ispezione della Finanza") e Reazioni ("Scaricabarile").

### 3.2 `CardEffectParser.ts`
Il parser logico degli effetti delle carte.
* Espone la funzione statica `resolve(cardData, sourcePlayer, targetPlayer, gameState)`.
* Analizza l'oggetto `effect.action` della carta e re-indirizza verso funzioni atomiche puramente logiche.
* **Effetti già funzionanti:** `produce` (generate PA), `steal_pa` (rubare punti azione), `steal_card` (furto randomico dalla mano), `discard` (costringere a scartare), `draw_cards`, annullamento reazioni basi (`cancel_effect`) e prototipi per le risoluzioni delle crisi (`crisis_resolve`).

### 3.3 `DeckManager.ts`
Il gestore del deck che implementa le regole per la Feature 02 Core Loop.
* Carica in tempo reale il `cards_db.json` e istanzia le carte definendo internamente un multi-set (es. 3 copie per carta per avere un mazzo test di 45 carte).
* Assegna automaticamente un UUID univoco a ciascuna entità carta `ICardData` validata dai Contract in `SharedTypes.ts`.
* Implementa l'algoritmo puro di rimescolamento array Fisher-Yates (`shuffle`).
* Fornisce al server la funzione statica `drawCard(deck)` per estrarre ("pop") gli elementi con controllo di sicurezza per deck vuoto.

---

## 4. Task Futuri e In Sospeso (Backlog della FASE 3 e 4)

Man mano che l'Agente 1 integrerà le chiamate ai parser nello State e nel room message handling, i miei prossimi obiettivi saranno:

1. **Espansione del Parser per Effetti Avanzati FASE 3/4:** Implementare la logica matematica dei seguenti casi (attualmente mockati come stub intercettati ma non processati nel `switch` di fallback):
   * `protect` (creare buffer temporanei di immunità).
   * `passive_bonus` (es. conteggio doppio per la vittoria Monopolio).
   * `discount_cost` (alterare temporaneamente il costo calcolato di giocate future).
   * `redirect_effect` e `steal_played_card` (logiche di manipolazione bersaglio e intercettazione durante la Reaction Window).
2. **Costruire i Test Unitari Logic (Jest / TS-Node):** Testare internamente i rami condizionali estremi del calcolo per garantire solidità (es. tentare un furto carta se la mano della vittima è vuota per assicurare nessuna memory-leak o errore crashante).
3. **Scala Bilanciamento (se richiesta nel DB):** Ampliare `cards_db.json` modificando parametri e inserendo le carte finali previste dal design del gioco una volta consolidato il core.
