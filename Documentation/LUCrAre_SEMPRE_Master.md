# MASTER DOCUMENT - LUCrAre: SEMPRE

Ultimo aggiornamento: 2026-03-04

## 1) Visione
LUCrAre: SEMPRE e un card game multiplayer web, mobile-first, con server authoritative.
Ispirazione: giochi party card stile Here to Slay, con regole semplificate.

## 2) Stack e moduli
- Backend: Node.js + TypeScript + Colyseus + Express
- Frontend: Phaser 3 + TypeScript + Vite
- Shared: contratti rete + deck + parser effetti
- Test: Jest

Moduli chiave:
- `server/src/rooms/OfficeRoom.ts`: regole authoritative di lobby e match
- `server/src/State.ts`: schema sincronizzato
- `client/src/scenes/*`: Boot/Login/Game UI
- `client/src/network/ServerManager.ts`: comunicazione socket client
- `shared/SharedTypes.ts`: source of truth dei contratti

## 3) Regole correnti implementate
- Room code obbligatorio (4 cifre)
- Match 2-10 giocatori
- In pre-lobby: readiness con `JOIN_GAME`
- Start con `START_MATCH` solo host
- Start consentito con almeno 2 connessi e tutti i connessi ready
- Mano iniziale 3 carte
- AP per turno 3
- Reaction window 5000 ms
- Win semplificata: 4 dipendenti o 2 crisi risolte
- Rejoin a partita avviata solo con nome CEO gia presente

## 4) Stato fasi
- Fase 1 (contratti + stato): completata
- Fase 2 (lobby + core loop): completata
- Fase 3 (effetti carte data-driven): funzionale
- Fase 4 (reaction stack): funzionale con hardening ancora aperto
- Fase 5 (UI/polish): in corso

## 5) Stato tecnico verificato
Verifica eseguita il 2026-03-04:
- `server build`: OK
- `client build`: OK
- `npm test -- --runInBand`: FAIL parziale
  - 4 suite passano
  - 5 suite falliscono (3 per dipendenza `express` mancante nel root, 1 su assert reaction legacy, 1 suite legacy con `process.exit`)

## 6) Rischi e task prioritari
1. Riallineare test storici al comportamento corrente (win condition e flusso room code).
2. Chiudere gap infrastrutturale delle suite root con `@colyseus/testing`.
3. Ripulire test legacy che usano `process.exit`.
4. Ridurre `any` residui su backend/shared.
