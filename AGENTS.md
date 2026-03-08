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

1. Suite completa (tutti i progetti Jest):
```bash
npm test
```

2. Unit test rapidi (client + shared):
```bash
npm run test:unit
```

3. UI contracts (environment-safe, anti-overlap):
```bash
npm run test:ui
```

4. Integration test server (seriali):
```bash
npm run test:integration
```

5. CI/debug open handles:
```bash
npm run test:ci
```

Struttura test canonica:
- `tests/unit/client/*`
- `tests/unit/shared/*`
- `tests/integration/server/*`

## Convenzioni operative

- Non fare scope creep: se emerge lavoro fuori tema, annotarlo come follow-up senza implementarlo in questa milestone.
- Stop-and-fix: se una build o un test richiesto fallisce, risolvere prima di passare oltre.
- Quando viene richiesto un piano/specifica (plan/spec), non modificare codice di logica/UI finche non arriva approvazione esplicita del piano.
- Fermati e chiedi review dopo ogni milestone prima di procedere alla successiva.
