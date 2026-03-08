# Repo Structure Guidelines

Data aggiornamento: 2026-03-06

## Albero principale
- `client/`: Phaser scenes, UI, layout, QA scripts
- `server/`: Colyseus room e moduli gameplay authoritative
- `shared/`: contratti, parser effetti, database carte
- `tests/`:
  - `tests/unit/client/*`
  - `tests/unit/shared/*`
  - `tests/integration/server/*`

## Documentazione
- documentazione attiva consolidata in `docs/`
- niente nuovi file in `Documentation/` o cartelle legacy

## Regole pratiche
1. tenere separati rendering UI e logica gameplay
2. centralizzare costanti layout nei moduli layout
3. evitare duplicazioni test/doc
4. aggiornare `docs/index.md` quando nasce/si elimina un documento canonico
