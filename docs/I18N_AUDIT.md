# I18N Audit (Sintesi Attiva)

Data aggiornamento: 2026-03-06

## Stato
- Lingue supportate: `it`, `en`
- Catalogo centralizzato in `client/src/i18n.ts`
- Mock/QA allineati alle stesse chiavi

## Regole
1. Nessuna stringa UX hardcoded nelle scene.
2. Ogni nuova chiave deve avere entrambe le traduzioni.
3. Messaggi di errore gameplay devono essere localizzati.

## Aree critiche da ricontrollare ad ogni release
- Login/PreLobby CTA
- Match HUD/Action panel/Log
- Overlay Help/Inspect/Reconnect
- Feedback blocco azioni (draw/end/attack/reaction)

## Esito corrente
Copertura funzionale adeguata; mantenere guard test su regressioni hardcoded.
