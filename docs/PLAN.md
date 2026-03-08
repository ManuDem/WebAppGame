# PLAN - Roadmap Lineare

Data aggiornamento: 2026-03-06

Obiettivo operativo:
1. eliminare bug grafici e funzionali legati alla grafica/overlap,
2. garantire usabilita reale su telefono (portrait e landscape),
3. consolidare test e regressioni.

## Stato tecnico attuale
- `client build`: OK (`npm run build`, 2026-03-06)
- `test:unit` (client+shared): OK (`22/22` suite, `135/135` test, 2026-03-06)
- `npm test` (unit+integration): OK (`29/29` suite, `169/169` test, 2026-03-06)
- QA visuale automatica: da rieseguire dopo ogni fix grafica rilevante.

## Milestone P0 - Bug Grafica/Funzionale (Priorita Assoluta)
Stato: `in corso`

Scope:
- overlap tra HUD/controlli/log/mano
- blocchi input quando overlay modal e aperto
- leggibilita minima su viewport phone critici

Acceptance:
- nessun overlap critico nei viewport obbligatori
- nessuna azione gameplay inviata mentre un modal blocca input
- layout leggibile in `360x640`, `390x844`, `844x390`, `896x414`

## Milestone P1 - Layout Hardening Mobile
Stato: `pending`

Scope:
- tuning definitivo di spaziature, scala card e tipografia minima
- consolidamento contratto portrait/landscape in spec e test

Acceptance:
- `LayoutContracts` verdi
- nessun testo fuori contenitore nei pannelli principali
- tap target utili >= `44x44`

## Milestone P2 - Refactor Test (Ampio)
Stato: `pending`

Scope:
- riscrittura progressiva suite UI/layout con focus regressioni grafiche
- rafforzamento test su:
  - modal guard
  - playable visual state
  - contract tier A/B/C/D/E
  - overflow/fit-text nelle aree sensibili

Acceptance:
- suite unit e integration verdi
- test leggibili per area funzionale (layout, ui-state, gameplay-flow)
- riduzione test ridondanti/storici

## Milestone P3 - Polish Contenuti
Stato: `pending`

Scope:
- quality pass finale artwork
- QA su device fisici piccoli
- ottimizzazione bundle monitorata

## Regola di esecuzione
- Stop-and-fix: ogni fail di build/test blocca il flusso.
- No scope creep: backlog fuori priorita registrato ma non implementato in milestone corrente.
