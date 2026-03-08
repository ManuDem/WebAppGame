# Testing Guidelines

Data aggiornamento: 2026-03-06

## Obiettivo
Prevenire regressioni gameplay e regressioni UI/layout, con priorita su bug grafici funzionali di partita.

## Suite canoniche
- full: `npm test`
- unit: `npm run test:unit`
- ui standard (environment-safe): `npm run test:ui`
- ui contracts browserless: `npm run test:ui:contracts`
- integration: `npm run test:integration`
- ci/debug: `npm run test:ci`

## Struttura canonica
- `tests/unit/client/*`
- `tests/unit/shared/*`
- `tests/integration/server/*`

## Regole test UI/layout
1. Validare tier e bounds principali.
2. Coprire guard modal/input blocking.
3. Coprire playable visual state delle carte.
4. Evitare snapshot fragili: preferire assert su contratti e comportamento.

## Regole operative
- se un test richiesto fallisce: stop-and-fix immediato
- niente merge con suite rossa
- mantenere test leggibili per area funzionale

## Verifica minima per task UI match
1. `npm run test:unit`
2. `npm run test:ui`
3. `cd client && npm run build`

## Riferimenti ufficiali usati
- Jest Configuration: https://jestjs.io/docs/configuration
- Jest Setup/Teardown: https://jestjs.io/docs/setup-teardown
- Phaser Scale Manager: https://docs.phaser.io/phaser/concepts/scale-manager
