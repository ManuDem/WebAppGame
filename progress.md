Original prompt: analizza ora anche la aprtita e fai dei test approfonditi. riorganizz ail progetto e ristruttura profondamente tutti i test in modo da velocizzarli e essere approfonditi. quando fai gli screen poi analizzali per capire se ci sono errori grafici e soprattottuo se la UI e UX è utilizzabile sia in portrait che in landscape su telefono. deve essere Portrit first. Svolgi anche un'intera partita e prova tutti i pulsanti per assicurartene il funzionamento.

- 2026-03-07: ristrutturata la suite Jest in domini unit/integration con helper condivisi per client/server.
- 2026-03-07: verificate con successo `npm test`, `npm run test:unit`, `npm run test:integration` e `client npm run build` fuori sandbox.
- 2026-03-07: eseguito un flusso reale host+guest via Playwright fino all'avvio della partita; evidenze in `output/playwright/`.
- TODO: audit responsive portrait-first su login, prelobby e match con viewport telefono portrait/landscape.
- TODO: completare walkthrough partita provando i pulsanti principali nel match e annotare eventuali problemi UX/UI.
- 2026-03-07: eseguito audit responsive con Playwright su login/prelobby/match in 360x640, 390x844 e 844x390; trovati overlap gravi in pre-lobby e clipping dell'overlay reaction in landscape.
- 2026-03-07: completata partita reale host+guest fino a GAME_OVER con Playwright; verificati join, ready, start, draw, info, end turn, reaction window, solve crisis, victory screen e restart.
- BUG: in match desktop e mobile il pannello azione continua a mostrare "nessun Hero in azienda" anche dopo che un Hero e presente in company; lo stato HUD (Hero 1) e la board sono corretti ma il hint testuale e stale.
- BUG: pre-lobby mobile portrait e landscape ha overlap tra regole, roster e CTA; la UI non e usabile cosi su telefono.
- BUG: overlay reaction landscape mobile tronca il titolo in modo evidente.
- TODO: fissare i bug visuali emersi nel pre-lobby e nella action panel del match, poi rilanciare le catture responsive.
- 2026-03-07: fixati MatchActionState e MatchHelpContent per evitare hint stale dopo Hero in azienda e per dare precedenza corretta a GAME_OVER/fasi non giocabili.
- 2026-03-07: rifatto il layout responsive della PreLobbyScene con focus portrait-first; eliminati overlap in 360x640 e resa leggibile la landscape 844x390 con copy piu compatto e roster ottimizzato.
- 2026-03-07: riallineato il layout della reaction overlay alla board reale del match; titolo e barra non vengono piu troncati in landscape telefono.
- 2026-03-07: corretti i testi italiani corrotti in i18n.ts usando escape Unicode ASCII-safe (più, Modalità).
- 2026-03-07: verifiche post-fix completate con successo su 
pm run test:unit, client npm run build e 
pm test.
- 2026-03-07: verifiche live a due client completate su room 8063; confermati INFO, giocata Hero, aggiornamento corretto del pannello azioni dopo il resolve, MAZZO, FINE TURNO e handoff del turno verso l'host.
- 2026-03-07: artifact chiave aggiornati in output/playwright/: ix-qa-prelobby-360x640-v3.png, ix-qa-prelobby-844x390-v3.png, ix-qa-reaction-844x390-v3.png, guest-live-info-fix.png, guest-live-after-hero-fix.png, guest-live-after-draw-fix.png, guest-live-after-endturn-fix.png.
- TODO: se serve un'ulteriore hardening, rieseguire una partita completa post-fix fino a GAME_OVER per avere anche evidenza live del messaggio finale sul client sconfitto (la copertura attuale su quel caso e garantita da test unitari, non da un nuovo replay completo).
- 2026-03-07: completata la milestone di ristrutturazione del repository con script root per build/typecheck, nuova suite Jest `unit:server`, `.editorconfig` e cleanup degli ignore per artifact Playwright/generati.
- 2026-03-07: estratti moduli dedicati per endpoint client (`client/src/network/ServerEndpoint.ts`), testo dadi/UI match (`client/src/ui/match/MatchDiceText.ts`, `client/src/ui/match/MatchUiDomModel.ts`) e identita/bootstrap server (`server/src/rooms/officeRoomIdentity.ts`, `server/src/bootstrap/configureServer.ts`).
- 2026-03-07: rimossi artifact JavaScript generati dentro `client/src`, `server/src`, `shared` e `tests` che rompevano la risoluzione moduli e la build Vite; build e typecheck tornati verdi.
- 2026-03-07: aggiunti test unitari mirati per endpoint rete, testo dadi, modello DOM match e validazione/reconnect di OfficeRoom; confermati PASS su `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run build` e `npm run typecheck`.
- 2026-03-07: eseguita regressione live Playwright a due sessioni (`HostRefactor`/`GuestRefactor`, room `2484`) con join, ready, avvio match, overlay INFO, end turn, draw e catture responsive portrait-first; nessun errore nel summary `output/playwright/milestone-live-summary.json`.
- 2026-03-07: i processi locali di supporto avviati per la regressione finale risultano gia terminati; nessun cleanup manuale residuo necessario.
