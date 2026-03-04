# AGENTS

Guida operativa rapida per lavorare nel repository `WebApp Game`.

## Avvio progetto

1. Server (porta default `2567`):
```bash
cd server
npm run dev
```

2. Client (Vite):
```bash
cd client
npm run dev
```

## Build

1. Build server:
```bash
cd server
npm run build
```

2. Build client:
```bash
cd client
npm run build
```

## Test

1. Smoke suite stabile (attualmente green):
```bash
npm test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts
```

2. Full suite (stato attuale: fallisce su 3 test legacy):
```bash
npm test -- --runInBand --forceExit
```

Fail noti full suite:
- `tests/room_connection.test.ts`
- `tests/core_loop.test.ts`
- `tests/reaction_race_condition.test.ts`

## Convenzioni operative

- Non fare scope creep: se emerge lavoro fuori tema, annotarlo come follow-up senza implementarlo in questa milestone.
- Stop-and-fix: se una build o un test richiesto fallisce, risolvere prima di passare oltre.
- Quando viene richiesto un piano/specifica (plan/spec), non modificare codice di logica/UI finche non arriva approvazione esplicita del piano.
- Fermati e chiedi review dopo ogni milestone prima di procedere alla successiva.
