# Linee Guida Architetturali

Data aggiornamento: 2026-03-06

## Principi
1. Server authoritative su ogni regola gameplay critica.
2. Client senza RNG gameplay.
3. Contratti condivisi tipizzati e versionati in `shared/`.
4. UI regolata da layout contracts e non da coordinate hardcoded sparse.
5. Ogni fix UI deve essere validato su viewport phone portrait+landscape.

## Regole operative
- Modifiche gameplay: prima server/shared, poi affordance client.
- Modifiche layout: prima spec + test contract, poi implementazione.
- Ogni regressione P0 (overlap/input incoerente) va chiusa subito.

## Focus corrente
- riduzione bug grafici/funzionali in partita
- hardening modal/input safety
- ampliamento test anti-regressione UI
