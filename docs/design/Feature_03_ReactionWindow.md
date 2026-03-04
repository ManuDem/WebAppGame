# Feature 03 - Reaction Window e Stack Risoluzione

Specifica aggiornata al comportamento corrente (`server/src/rooms/OfficeRoom.ts`).

## Trigger
Il server apre `REACTION_WINDOW` quando il player attivo gioca:
- `PLAY_EMPLOYEE`
- `PLAY_MAGIC`
- `SOLVE_CRISIS`

Azioni come `DRAW_CARD` o `END_TURN` non aprono la finestra.

## Stato server durante la finestra
Quando una di queste azioni e valida:
1. il server scala i PA richiesti
2. rimuove la carta dalla mano
3. valorizza `pendingAction`
4. imposta:
   - `phase = REACTION_WINDOW`
   - `reactionEndTime = now + REACTION_WINDOW_MS`
   - `actionStack` con azione originale
5. broadcast `START_REACTION_TIMER`

## Reazioni
Durante la finestra:
- solo gli avversari possono usare `PLAY_REACTION`
- validazioni:
  - finestra attiva
  - non puoi reagire alla tua azione
  - carta presente in mano
  - PA sufficienti
- effetto server:
  - scala PA
  - rimuove carta dalla mano
  - inserisce reazione in `actionStack` (LIFO)
  - broadcast `REACTION_TRIGGERED`

## Risoluzione
Allo scadere del timer:
1. `phase -> RESOLUTION`
2. `CardEffectParser.resolveQueue(...)` risolve chain e cancellazioni
3. `OfficeRoom` applica effetti strutturali (assunzione dipendente / rimozione crisi)
4. `ACTION_RESOLVED` in broadcast
5. cleanup:
   - `pendingAction = null`
   - `actionStack = []`
   - `reactionEndTime = 0`
   - `phase = PLAYER_TURN`
6. check win condition

## Note implementative
- `actionStack` e server-side logic (non e sincronizzato come schema Colyseus).
- Il frontend usa `reactionEndTime` + eventi server per countdown e feedback visivo.
