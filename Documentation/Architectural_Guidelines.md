# Linee Guida Architetturali - LUCrAre: SEMPRE

Linee guida vincolanti per sviluppo client/server/shared.

## 1) Server authoritative
Il backend Colyseus e la sola source of truth.
Il client invia intenzioni, non risultati.

## 2) Nessun RNG lato client
Deck shuffle, draw, effetti random e qualsiasi decisione non deterministica restano server-side.

## 3) Contratti centralizzati
Tipi, enum e payload stanno in `shared/SharedTypes.ts`.
Nessuna duplicazione locale di contratti.

## 4) Validazione tripla messaggi
Ogni handler server valida sempre:
1. turno/fase
2. risorse (PA/carta/target)
3. condizioni di regola

## 5) Privacy hand (fog of war)
La mano resta privata per owner tramite filtri schema.
Gli altri client non devono ricevere il contenuto completo.

## 6) Reaction window server-driven
Timeout di reaction solo sul server (`clock.setTimeout`).
Il client visualizza countdown ma non chiude la finestra.

## 7) Eventi visuali separati dallo stato
Stato persistente via Colyseus state.
Feedback transitorio via `ServerEvents` + queue visuale client.

## 8) Payload minimali
Scambiare solo id e dati essenziali (`cardId`, `crisisId`, `roomCode`), non logica derivata.

## 9) Rejoin robusto
Il server deve gestire reconnect e migrazione stato senza desincronizzare turn order o ownership.

## 10) Mobile-first reale
UI progettata per schermi piccoli:
- testi leggibili
- zero overlap
- hitbox comode
- layout resiliente in portrait e landscape
