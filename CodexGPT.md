# CodexGPT - Project Memory Operativa

Ultimo aggiornamento: 2026-03-04 (refactor grafico frontend)
Workspace: `C:\Users\manud\Desktop\WebApp Game`

## 1) Obiettivo del file
Questo documento e la memoria di lavoro sintetica per Codex.
Serve a:
- capire rapidamente cosa e stato gia fatto
- capire cosa manca
- orientarsi nella struttura del progetto
- tenere traccia dei fix prioritari

Regola operativa:
- consultare questo file a inizio task
- ricontrollarlo durante task lunghi
- aggiornarlo a fine task quando cambia lo stato reale del progetto

## 2) Snapshot progetto
- Nome: LUCrAre: SEMPRE
- Tipo: Web card game multiplayer, server-authoritative
- Stack:
  - Backend: Node.js + TypeScript + Colyseus
  - Frontend: Phaser 3 + TypeScript + Vite
  - Shared: contratti di rete, deck manager, parser effetti
  - Test: Jest + suite server/root

## 3) Stato avanzamento (alto livello)
- FASE 1 (architettura dati/contratti): completata
- FASE 2 (lobby/core loop turni+pesca): completata
- FASE 3 (effetti carte data-driven): funzionale, ancora iterabile
- FASE 4 (reaction window + stack): avanzata, da hardenizzare
- FASE 5 (visual contracts/polish frontend): in corso

## 4) Cosa e gia stato svolto
- Contratti condivisi in `shared/SharedTypes.ts` con:
  - `GamePhase`, `ClientMessages`, `ServerEvents`
  - payload principali
  - `IPendingAction`, `IGameState`, DSL effetti carta
- Backend room principale in `server/src/rooms/OfficeRoom.ts`:
  - auth/join/leave con validazione `ceoName`
  - avvio partita, ordine turni, AP, draw, end turn
  - reaction window con timer server-side (`REACTION_WINDOW_MS`)
  - stack azioni/reazioni e fase di resolution
- Data layer:
  - `shared/cards_db.json`
  - `shared/DeckManager.ts`
  - `shared/CardEffectParser.ts`
- Frontend:
  - boot/login/game scene
  - connessione Colyseus via `ServerManager`
  - base HUD/azioni + `VisualEventQueue`
  - refactor grafico completo su:
    - `client/src/main.ts` (scale RESIZE)
    - `client/src/scenes/BootScene.ts` (loading screen responsive + animazioni)
    - `client/src/scenes/LoginScene.ts` (menu/login responsive + animazioni)
    - `client/src/scenes/GameScene.ts` (layout top/center/bottom ridisegnato, leggibilita e motion)
    - `client/src/gameobjects/CardGameObject.ts` (restyle carte + interaction polish)
    - `client/src/network/ServerManager.ts` (payload `SOLVE_CRISIS` allineato)

## 5) Organizzazione codice (mappa veloce)
- `client/`
  - `src/main.ts` bootstrap Phaser
  - `src/scenes/BootScene.ts`
  - `src/scenes/LoginScene.ts`
  - `src/scenes/GameScene.ts`
  - `src/network/ServerManager.ts`
  - `src/systems/VisualEventQueue.ts`
- `server/`
  - `src/index.ts` bootstrap server e room registration
  - `src/State.ts` schema Colyseus
  - `src/rooms/OfficeRoom.ts` logica autoritativa partita
- `shared/`
  - `SharedTypes.ts` single source of truth contratti
  - `DeckManager.ts`
  - `CardEffectParser.ts`
  - `cards_db.json`
- `tests/` e `server/tests/`
  - test core loop, reaction, connessione, parser, deck
- `Documentation/` + `Feature_*.md`
  - specifiche e linee guida architetturali

## 6) TODO principali (priorita)
1. Hardening reaction flow (edge case disconnessioni, consistenza cleanup, logica stack).
2. Rifinire visual contracts avanzati in `GameScene` (eventi VFX secondari, micro-pause, polish finale).
3. Stabilizzare suite test end-to-end/server.
4. Rifinire win conditions e punteggi in modo coerente con GDD.

## 7) Fix da fare (stato attuale noto)
1. Incoerenza commento vs comportamento `PLAY_MAGIC`:
   - in `OfficeRoom` commento dice "immediate (no Reaction Window)"
   - implementazione reale apre `REACTION_WINDOW`
   - va allineato (codice o commento/spec, ma in modo unico).

2. Test non completamente verdi da root:
   - parte test passa (`DeckManager`, `CardEffectParser`)
   - suite room/integrazione falliscono per:
     - modulo mancante `zod` (dipendenza indiretta colyseus testing)
     - errore decorator/runtime schema in alcune suite server
   - serve piano di fix test infra e compatibilita ts/jest/decorator.

3. Alcuni `any` e cast restano in backend:
   - soprattutto in `OfficeRoom.ts` e punti schema interop
   - ridurre dove possibile per robustezza type-safe.

4. Verifica build frontend:
   - `client tsc --noEmit` (tsconfig client) risulta verde
   - build Vite in questo ambiente puo fallire con `spawn EPERM` (limite runtime sandbox/esbuild)

## 8) Regole di ingaggio tecniche (da rispettare sempre)
- Server e source of truth: nessuna logica definitiva lato client
- no RNG lato client
- validazione tripla su messaggi critici
- payload minimali e coerenti con `SharedTypes.ts`
- reaction timeout gestito solo dal server
- frontend reattivo allo state/eventi, no stato locale divergente

## 9) Procedura rapida prima di ogni modifica
1. Leggere `CodexGPT.md`
2. Leggere file target e contratti in `shared/SharedTypes.ts`
3. Verificare impatto su:
   - backend room/state
   - frontend manager/scene
   - test correlati
4. Applicare fix
5. Eseguire verifica (build/test pertinenti)
6. Aggiornare questo file con:
   - cosa e stato fatto
   - eventuali nuovi bug emersi
   - stato TODO

## 10) Log aggiornamenti Codex
- 2026-03-04:
  - creato questo file memory operativo
  - consolidata panoramica progetto da documentazione + codice reale
  - registrati mismatch e criticita tecniche principali da fixare
- 2026-03-04 (sessione refactor grafico):
  - completato refactor grafico responsive su Boot/Login/Game/Card UI
  - migliorata leggibilita (palette/contrasti/gerarchie tipografiche) e motion UI
  - introdotto layout dinamico con `Phaser.Scale.RESIZE`
  - allineato payload client `SOLVE_CRISIS` a `crisisId`
  - verifica tecnica: compilazione client (`tsc --noEmit`) OK
