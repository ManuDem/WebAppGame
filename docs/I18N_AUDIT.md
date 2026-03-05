# I18N Audit (IT/EN)

Data audit: 2026-03-05

## Scope controllato
- `client/src/i18n.ts`
- `client/src/scenes/*` (Boot/Login/PreLobby/Game)
- `client/src/ui/*`
- `client/src/ui/cards/*`
- `client/src/ui/match/*`
- `client/src/qa/MockMatchState.ts`
- `shared/cards_i18n.json`
- `shared/CardTextCatalog.ts`

## Stato per area

| Area | Stato | Note |
|---|---|---|
| Schermate iniziali (Boot/Login/PreLobby) | completo | Label principali e feedback via `t(lang, key)`. |
| Match HUD / action panel / log / help | completo | Stringhe user-facing centralizzate in `client/src/i18n.ts`. |
| Reason messages / blocked reasons | completo | Chiavi dedicate IT/EN allineate. |
| Mock match (`qaMatch`) | completo | Rimossi copy hardcoded locali; ora usa `t(...)`. |
| Tipi carta e testi mini/full card | completo | `CardPresentationModel` + `CardTextCatalog`. |
| Contenuti carte `name/shortDesc/description` | completo | Copertura IT/EN via `shared/cards_i18n.json` per tutte le template del DB. |

## Hardcoded trovati e classificati

| Stringa | File | Stato |
|---|---|---|
| `?` (pulsante help) | scene match/prelobby | intenzionale (icona). |
| `X` (chiusura overlay) | scene match/prelobby | intenzionale (icona). |
| `0%` progress boot | `BootScene` | intenzionale (valore numerico). |

Nessuna stringa hardcoded user-facing critica residua nelle aree toccate.

## Decisioni applicate
- Localizzazione carte centralizzata in `shared/CardTextCatalog.ts` con fallback robusto.
- Mock mode QA allineato alla lingua corrente, inclusi errori simulati e nomi player mock.
- Nuove chiavi aggiunte per CTA compact e messaggi mock (`qa_mock_*`).

## Verifiche consigliate
- `npm test -- --runInBand --forceExit tests/I18nCoverage.test.ts tests/CardTextCatalog.test.ts tests/MockMatchStateI18n.test.ts`
- QA visuale IT/EN:
  - `cd client && npm run qa:capture:responsive`
  - `cd client && npm run qa:capture:match`
