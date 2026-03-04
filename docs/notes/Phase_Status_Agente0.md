---
description: Stato fasi sviluppo e gap tecnici correnti
---

# Stato Fasi - LUCrAre: SEMPRE

Ultimo aggiornamento: 2026-03-04

## Fase 1 - Architettura dati e contratti
- Stato: completata
- Evidenze:
  - `shared/SharedTypes.ts`
  - `server/src/State.ts`

## Fase 2 - Lobby e core loop
- Stato: completata
- Evidenze:
  - host/join con codice stanza a 4 cifre
  - readiness (`JOIN_GAME`) + start host (`START_MATCH`)
  - minimo start: 2 player connessi
  - gestione turni + AP + draw

## Fase 3 - Data layer carte
- Stato: funzionale
- Evidenze:
  - `shared/cards_db.json`
  - `shared/DeckManager.ts`
  - `shared/CardEffectParser.ts`
- Note:
  - mano iniziale attuale: 3 carte
  - win semplificata nel server: 4 dipendenti o 2 crisi risolte

## Fase 4 - Reaction window
- Stato: funzionale, da hardenizzare
- Evidenze:
  - `REACTION_WINDOW_MS = 5000`
  - stack azioni/reazioni e risoluzione server-side
  - timer server con `clock.setTimeout`
- Gap noto:
  - test storico `server/tests/reaction_stress.test.ts` non allineato al nuovo bilanciamento (phase attesa diversa)

## Fase 5 - UI e visual polish
- Stato: in corso
- Evidenze:
  - UI condivisa (font, branding, button fx)
  - login host/join a step
  - overlay full screen per testo carta
  - sfondi dinamici stile old-school

## Stato verifica tecnica
- `server build`: OK
- `client build`: OK
- `npm test -- --runInBand`: FAIL parziale (4 pass, 5 fail)

## Rischi principali aperti
1. Suite root con `@colyseus/testing` bloccate da `express` mancante nel root.
2. Test storici da riallineare alle regole correnti.
3. Test legacy con `process.exit` da ripulire (`server/tests/win_conditions.test.ts`).
4. Cleanup type-safety (`any`) in backend/shared.
