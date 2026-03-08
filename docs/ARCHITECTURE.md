# ARCHITECTURE

Data aggiornamento: 2026-03-06

## Runtime
- Client: Phaser 3 + TypeScript (`client/src`)
- Server: Colyseus + Express + TypeScript (`server/src`)
- Shared contracts/data: `shared/`

## Scene chain
`BootScene -> LoginScene -> PreLobbyScene -> GameScene`

## Componenti chiave client
- `GameScene.ts`: orchestrazione match e sync con stato server
- `ui/layout/MatchLayout.ts`: layout deterministico tier A/B/C/D/E
- `ui/dom/MatchUiDom.ts`: shell DOM per HUD/controls/log
- `gameobjects/CardGameObject.ts`: rendering mini-card + playable visual state

## Componenti chiave server
- `rooms/OfficeRoom.ts`: orchestrazione authoritative partita
- `game/*`: moduli regole (turn flow, monster, win, reaction, item equip)

## Contratti condivisi
- `shared/SharedTypes.ts`: enum/eventi/payload
- `shared/cards_db.json`: card templates runtime
- `shared/CardEffectParser.ts`: risoluzione effect

## Principi architetturali
1. Server authoritative: nessuna regola critica lato client.
2. Nessun RNG gameplay lato client.
3. Contratti condivisi tipizzati.
4. UI separata in layout contracts + presenter/model.
5. Priorita a robustezza input e readability mobile.

## Focus tecnico attuale
- ridurre bug grafici/overlap match
- mantenere input safety durante overlay/reconnect
- irrobustire regressioni con test unit + integration
