# QA - Milestone Card Visuals / Targeting / Pixel Polish

Data verifica: 2026-03-04

## 1. Verifiche automatiche

Comandi usati:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `npm.cmd test -- --runInBand --forceExit server/tests/gameplay_foundation.test.ts`

Esito:
- build server: OK
- build client: OK
- smoke suite stabile: OK
- gameplay_foundation: OK

Nota:
- Esistono ancora suite legacy note non incluse nella smoke stabile (fuori scope di questa milestone).

## 2. Smoke manuale ripetibile (client)

Prerequisiti:
1. Avvia server: `cd server && npm.cmd run dev`
2. Avvia client: `cd client && npm.cmd run dev`
3. Apri due tab/browser separati.

Checklist:
1. Host crea stanza e vede codice a 4 cifre.
2. Join entra con codice valido e nome CEO.
3. In pre-lobby entrambi mettono pronto e host avvia.
4. Ogni giocatore parte con 3 carte in mano.
5. In mano, ogni mini-card mostra:
   - artwork (PNG se presente, fallback se mancante)
   - titolo/tipo/costo leggibili
6. Tap su carta in mano apre overlay full-card.
7. Overlay mostra artwork reale se presente, altrimenti fallback senza errori.
8. Drop di Item su tavolo:
   - con 1 Hero in company: auto-target Hero
   - con piu Hero: apertura target selector Hero
   - con 0 Hero: feedback esplicito e carta non persa
9. Drop di Magic/Event che bersaglia avversario:
   - selettore target opponent
   - se nessun avversario disponibile, feedback esplicito
10. Hero con Item equipaggiati mostra badge `EQ n` nella company.

## 3. QA capture rapido (opzionale)

Script disponibile:
- `cd client && npm.cmd run qa:capture`

Variabili utili:
- `QA_URL` (default `http://localhost:3000/`)
- `QA_WAIT_MS` (default `5000`)
- `QA_CHANNEL` (`chrome`, `msedge`, oppure vuoto)

## 4. Follow-up fuori scope

- Rifinitura completa pixel-art su tutte le scene non toccate in questa milestone.
- Copertura e2e automatica interazione drag/tap multi-client.
- Stabilizzazione suite legacy non incluse nella smoke stabile.
