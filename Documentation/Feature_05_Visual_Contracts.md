# Feature 05 - Visual Contracts e Event Queue

Specifica aggiornata al client corrente (`client/src/scenes/GameScene.ts`).

## Obiettivo
Separare:
- stato di gioco authoritative (Colyseus state)
- feedback visivo transitorio (animazioni UI/VFX)

## Contratto
Il client:
- invia intenzioni (`ClientMessages`)
- non decide esiti
- aggiorna UI da `state` + `ServerEvents`

Il server:
- valida azioni
- muta stato
- invia eventi visuali quando utile

## Implementazione attuale
`GameScene` usa `VisualEventQueue` per serializzare feedback visivi su:
- `ServerEvents.ERROR`
- `START_REACTION_TIMER`
- `REACTION_TRIGGERED`
- `ACTION_RESOLVED`
- `CARD_DRAWN`
- `TURN_STARTED`
- `GAME_WON`

Quando la queue e busy:
- lo stato ricevuto viene bufferizzato (`latestState/latestPlayer`)
- applicato appena la coda libera

## Overlay principali
- Reaction overlay con timer visuale
- Card inspect full screen (leggibilita mobile)
- Target selector per carte trick con target player
- Victory overlay finale

## Regole UI chiave
- Nessuna logica di game outcome sul client
- Bottoni con animazione condivisa (`SimpleButtonFx`)
- Layout responsive mobile-first (`Scale.RESIZE`)
- Rebuild dinamico di mano, crisi, company e pannelli lobby/turno
