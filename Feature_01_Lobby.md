# Feature 01: Connessione e Lobby ("OfficeRoom")

Questo documento definisce le specifiche tecniche per implementare la connessione iniziale dei giocatori (CEO) alla partita. Le indicazioni qui riportate sono vincolanti per l'Agente 1 (Backend) e l'Agente 2 (Frontend).

## 1. Parametri di Configurazione della Stanza

*   **Nome Stanza:** `office_room`
*   **Capienza Massima:** 10 giocatori (`maxClients = 10`).
*   **Capienza Minima per Start:** 3 giocatori.
*   **Timeout Riconnessione:** 30 secondi (per gestire cali di linea temporanei).

## 2. Direttive per Agente 1 (Backend - Node.js/Colyseus)

L'Agente 1 è responsabile della creazione della Room, della validazione dei dati in ingresso e della prima costruzione dello Stato di gioco.

*   **Creazione Room**: Mappare `office_room` su una classe `OfficeRoom` che estende `Room<IGameState>`.
*   **Validazione Input (`onAuth`)**: 
    *   Il client invierà un payload di tipo `JoinOptions`.
    *   **Regola**: Validare il campo `ceoName`. Deve essere una stringa non vuota e la sua lunghezza deve essere compresa tra 3 e 15 caratteri alfanumerici.
    *   In caso di fallimento della validazione, rigettare la connessione lanciando un errore esplicito al client (es. `ServerException`).
*   **Inizializzazione Giocatore (`onJoin`)**:
    *   Creare un'istanza conforme a `IPlayer`.
    *   Popolare `IPlayer.username` con il `ceoName` validato.
    *   Inizializzare strutture dati di base per il giocatore (Mano vuota, Punti Azione a 0 fino all'inizio effettivo).
*   **Disconnessioni (`onLeave`)**:
    *   Impostare `isConnected = false` sul Player. **Non** cancellare il giocatore o svuotare la sua mano.
    *   Utilizzare il comando di Colyseus `allowReconnection` per metterlo in sospeso. Se non si riconnette entro il timeout, passare il controllo a una funzione di cleanup o terminare il gioco se i giocatori scendono sotto la soglia minima.

## 3. Direttive per Agente 2 (Frontend - Phaser.js)

L'Agente 2 deve occuparsi dell'interfaccia utente (UI) e del feedback per il nuovo arrivato.

*   **Scena di Login**:
    *   Implementare una Scena `LoginScene` che si carichi appena i placeholder asset sono pronti.
*   **Input Name**:
    *   Creare un campo di input testo per raccogliere il `ceoName`. Utilizzare un elemento DOM sovrapposto al Canvas (Phaser DOM Elements) per la massima compatibilità Mobile.
    *   Aggiungere un pulsante "Entra in Riunione" in cui è vincolata la validazione lato-client preventiva (`ceoName` >= 3 e <= 15).
*   **Connessione**:
    *   Istanziare il `Client` di Colyseus.
    *   Invocare `joinOrCreate("office_room", { ceoName: "IlMioNome" })`.
*   **Transizione di Scena e Gestione Errori**:
    *   Rimanere nella schermata di login e bloccare l'interazione finché la promise non si risolve.
    *   Se il Server rifiuta (Promise `catch`), visualizzare il messaggio restituito dal Server (es. formattazione errata del nome) e sbloccare il tasto.
    *   Se il join ha successo (Promise `then`), avanzare alla Scena `LobbyScene` e salvare il riferimento alla Room in modo sicuro (es. `scene.registry` o in uno Store Globale TypeScript).
