# MASTER DOCUMENT - LUCrAre: SEMPRE

Ultimo aggiornamento: 2026-03-04

## 1) Visione
LUCrAre: SEMPRE e un card game multiplayer web, mobile-first, server authoritative.
Target di design: Here to Slay Lite con ritmo rapido, interazioni chiare e forte leggibilita touch.

## 2) Stack e moduli
- Backend: Node.js + TypeScript + Colyseus + Express
- Frontend: Phaser 3 + TypeScript + Vite
- Shared: contratti rete + deck + parser effetti
- Test: Jest

Moduli chiave:
- `server/src/rooms/OfficeRoom.ts`
- `server/src/State.ts`
- `client/src/scenes/BootScene.ts`
- `client/src/scenes/LoginScene.ts`
- `client/src/scenes/GameScene.ts`
- `shared/SharedTypes.ts`
- `shared/cards_db.json`

## 3) Regole target (v2 Here to Slay Lite)
- Main deck: Hero, Item, Magic, Modifier, Challenge
- Extra setup: Monster, Party Leader
- Match 2-10 giocatori
- Pre-lobby con ready e start host
- Mano iniziale 3 carte
- AP turno: 3
- Dadi 2d6 server-side
- Win: 2 Monster o 4 Hero

## 4) Stato tecnico corrente
- Build server: OK
- Build client: OK
- Test mirati gameplay: OK (`31/31` pass)
- Fix recenti applicati:
  - pre-lobby gestita lato client anche su `PRE_LOBBY`
  - carte reazione/evento giocabili con check su `subtype` e nuovi tipi (`challenge`/`modifier`)
  - rimosse animazioni a pallini in menu e particelle ambientali in game
  - inspect fullscreen con area artwork + testo esteso (effetto + dadi)
  - migrazione `shared` a tassonomia 5+2 con alias legacy
  - `cards_db` migrato a Hero/Item/Magic/Modifier/Challenge + Monster/Party Leader
  - setup server con assegnazione Party Leader
  - parser effetti con supporto `roll_modifier` e consumo one-shot su tiro dadi

## 5) Gap ancora aperti
1. Rifinire layout board in landscape per eliminare densita e overlap residui.
2. Completare equip `Item` per Hero specifico (oggi player-level via tag).
3. Completare artwork carta definitivo (attuale placeholder generativo).
4. Riallineare le suite test legacy root non piu coerenti.
