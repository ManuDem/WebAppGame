# ARCHITECTURE

Panoramica architetturale aggiornata al 2026-03-04.

## Entrypoint e runtime

- Client Phaser: `client/src/main.ts`
  - Scene chain: `BootScene -> LoginScene -> PreLobbyScene -> GameScene`
- Server Colyseus: `server/src/index.ts`
  - Room definita: `office_room` con `filterBy(["roomCode"])` e listing realtime

## Scene Phaser (responsabilita)

- `client/src/scenes/BootScene.ts`
  - preload asset base, transizione verso login
- `client/src/scenes/LoginScene.ts`
  - Host/Partecipa, nome CEO, codice stanza, lingua
- `client/src/scenes/PreLobbyScene.ts`
  - pre-lobby separata con stato ready/start e regole
- `client/src/scenes/GameScene.ts`
  - tavolo, mano, crisi/monster, overlay reaction, inspect carta, target selector

## Networking e sincronizzazione stato

- Client networking wrapper: `client/src/network/ServerManager.ts`
  - connessione Colyseus
  - azioni client (`DRAW_CARD`, `PLAY_EMPLOYEE`, `PLAY_MAGIC`, `SOLVE_CRISIS`, ...)
  - callback su stato e messaggi server
- Stato authoritative server:
  - schema sync: `server/src/State.ts`
  - logica stanza: `server/src/rooms/OfficeRoom.ts`

## Modello dati condiviso

- Contratti e costanti: `shared/SharedTypes.ts`
  - fasi, messaggi, payload, tipi carta, costanti AP/reaction/min players
- Deck e parser effetti:
  - `shared/DeckManager.ts`
  - `shared/CardEffectParser.ts`
  - `shared/cards_db.json`

## Core loop attuale (as-is nel codice)

- Match: 2-10 giocatori
- Avvio match: host-only, tutti i connessi pronti
- Setup:
  - 3 carte iniziali per giocatore
  - party leader assegnato
  - 3 monster al centro
- Turno:
  - 3 AP
  - pescare costa 1 AP
- Reaction window:
  - 5000 ms
  - risoluzione stack LIFO
- Vittoria:
  - 4 Hero in company
  - oppure 2 Monster risolti

## i18n e UI foundations

- i18n centralizzato: `client/src/i18n.ts`
  - default `it`, toggle `en`, persistenza `localStorage`
- Font app unificato: `client/src/ui/Typography.ts`
- Animazione bottoni condivisa: `client/src/ui/SimpleButtonFx.ts`

## Come riprodurre una partita (manuale)

1. Avvia server:
```bash
cd server
npm run dev
```
2. Avvia client:
```bash
cd client
npm run dev
```
3. Apri due browser/tab sul client.
4. Tab A: scegli `Host`, inserisci nome CEO, crea partita.
5. Tab B: scegli `Partecipa`, inserisci stesso codice stanza e nome CEO diverso.
6. Entrambi cliccano `Sono pronto` in pre-lobby.
7. Host clicca `Avvia partita`.
8. Verifica minima in partita:
   - turno assegnato a un player
   - pesca carta funziona (se AP disponibili)
   - visualizzazione mano/tavolo senza blocchi.

