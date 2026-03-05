# QA - Milestone Match Readability + Live HUD + Anti-Overlap

Data verifica: 2026-03-04

## 0) Audit Bug Bash Carte/Tavolo/i18n (stato iniziale)

Riproduzione breve (prima del fix):
1. Trascina una carta non giocabile sul tavolo in fase/target non valido.
2. In alcuni flussi arriva `ServerEvents.ERROR` senza reconcile immediato della mano.
3. La carta pending puo restare fuori dalla hand (`stuck`) per desync UI locale.

Expected vs Actual (prima del fix):
- Expected: play rifiutata => carta torna in mano, nessun oggetto orfano, nessun duplicato.
- Actual: possibile pending card fuori `handCards` e non distrutta da `rebuildHand()`, con rischio orphan/stuck.

Bug list prioritizzata (prima del fix):
- `P0` Pending card stuck/orphan dopo play fallita:
  - `client/src/scenes/GameScene.ts` (flow `pendingPlayedCard`, `ERROR`, `ACTION_RESOLVED`, `applyState`)
- `P1` Overflow testi mini-card/label:
  - `client/src/gameobjects/CardGameObject.ts`
  - `client/src/scenes/GameScene.ts` (crisis label, opponent row, inspect title/type, selector)
- `P1` Testi hardcoded/non tradotti in card UI:
  - `client/src/gameobjects/CardGameObject.ts`
  - `client/src/scenes/GameScene.ts`
  - `client/src/i18n.ts`
- `P2` Header brand non lineare tra Boot/Login/PreLobby:
  - `client/src/scenes/BootScene.ts`
  - `client/src/scenes/LoginScene.ts`
  - `client/src/scenes/PreLobbyScene.ts`
  - `client/src/ui/Branding.ts`

## 1) Verifiche automatiche eseguite

Comandi:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `npm.cmd test -- --runInBand --forceExit server/tests/gameplay_foundation.test.ts server/tests/room_connection.test.ts`

Esito:
- build client: OK
- build server: OK
- smoke suite stabile: OK
- suite gameplay foundation + room connection: OK

## 2) Smoke manuale ripetibile (match readability)

Prerequisiti:
1. Avvia server: `cd server && npm.cmd run dev`
2. Avvia client: `cd client && npm.cmd run dev`
3. Apri almeno 2 tab/browser distinti.

Checklist funzionale:
1. Host crea stanza e condivide codice.
2. Join entra con codice + nome CEO valido.
3. Pre-lobby: entrambi pronti, host avvia.
4. Start match: ogni giocatore ha 3 carte iniziali.
5. Hand interaction:
   - tap su mini-card => inspect overlay full-card
   - chiusura con `X` e tap fuori overlay
6. Target selector:
   - Magic/Event su opponent
   - Item su Hero (auto-target se Hero unico)
7. Equip item:
   - Hero in company mostra badge equip (`EQ n`)
8. Monster/crisis resolution:
   - crisi con badge `ROLL X+`
   - tiro dadi visibile lato client (toast)
9. Event log:
   - aggiornato con error/reaction/action/turn/dice/win
   - toggle `ESPANDI/RIDUCI` funzionante
10. HUD live:
   - turno/AP/VP/deck/discard/phase/reaction visibili

Checklist layout (anti-overlap):
1. Verifica `360x640` portrait.
2. Verifica `390x844` portrait.
3. Verifica `414x896` portrait.
4. Verifica `768x1024` portrait.
5. Verifica `1366x768` landscape.
6. Nessun testo deve:
   - sovrapporsi
   - uscire da card/panel/toolbar
   - uscire dalla propria sezione
7. Touch target critici >= 44px (bottoni principali, toggle log, selector).

## 3) Debug anti-overlap

Attivazione debug:
- URL con `?uiDebug=1`
- oppure `localStorage.setItem('lucrare_ui_debug', '1')`

Cosa controllare:
- box zone (`topBar`, `board`, `hand`, `log`, `handCards`)
- box testi principali HUD/log/turn

## 4) Nota ambiente CI/sandbox

Il capture browser automatico (`npm.cmd run qa:capture`) in questo ambiente può fallire con:
- `spawn EPERM` su Chromium/Chrome/Edge headless.

In tal caso:
- usare la checklist manuale sopra su browser locale reale.

## 5) Follow-up

- Riduzione log console test lato server (non bloccante).
- Eventuale E2E multi-client automatica stabile fuori sandbox.
- Hardening ulteriore overflow su nomi utente estremamente lunghi.

## 6) Bug fixati (M8)

- `P0` Pending card stuck/desync:
  - introdotto `PendingPlayModel` puro (`client/src/systems/PendingPlayModel.ts`)
  - rollback pending su `ServerEvents.ERROR`
  - reconcile pending su `applyState` con hand autorevole
  - cleanup orfani `CardGameObject` dopo rebuild (`cleanupOrphanCardObjects`)
- `P1` Overflow/overlap testi carte:
  - utility `fitTextToBox` + modello puro `TextFitModel`
  - applicazione su mini-card (titolo/sottotitolo/info), badge crisis, selector target, card inspect title/type, opponent row
- `P1` i18n/hardcoded:
  - localizzazione tipo carta + mini info + badge EQ + label sintetiche VP/Hero
  - rimozione `templateId` dalla UI inspect e selector
- `P2` Header non lineare tra scene iniziali:
  - nuova funzione unica `layoutBrandHeader(...)` usata in Boot/Login/PreLobby

## 7) Verifiche automatiche M8

Comandi:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts tests/I18nCoverage.test.ts`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`

Esito:
- build client: OK
- build server: OK
- test nuovi (pending/text-fit/i18n): OK
- smoke suite stabile: OK

## 8) Residui noti

- Nessun blocco P0 aperto nelle aree toccate.
- Da rifinire in follow-up: stress test visuale su nickname estremamente lunghi su dispositivi piccoli reali.

## 9) M9 - Match UX Clarity + Landscape Fix

Fix principali validati:
- action state centralizzato (`MatchActionState`) con motivi blocco localizzati.
- draw/end turn sempre cliccabili con feedback esplicito quando bloccati.
- attacco Imprevisti reso esplicito con CTA `ATTACCA` su ogni carta crisi.
- drag su zona crisi disabilitato come azione di attacco (messaggio guida dedicato).
- layout landscape alleggerito:
  - area board ampliata
  - hand e carte compatte
  - log spostato dalla top bar alla board su landscape
- pipeline artwork: mapping reale `emp_01 -> hero_luca.png`, `emp_07 -> hero_marco.png`.

Checklist flow aggiornata (manuale):
1. Avvio match e verifica turno corrente nel pannello azioni.
2. Tap su `MAZZO` con AP > 0 e turno attivo: richiesta accettata.
3. Tap su `MAZZO` fuori turno / AP 0 / mazzo vuoto: messaggio blocco con motivo.
4. Tap su `ATTACCA` su Imprevisto con AP sufficienti: richiesta inviata.
5. Tap su `ATTACCA` senza requisiti: messaggio blocco con motivo.
6. Verifica passaggio turno e aggiornamento pannello azioni.
7. Verifica inspect carta da hand/company/crisi.
8. Verifica no overlap evidente in viewport:
   - 360x640
   - 390x844
   - 414x896
   - 768x1024
   - 896x414
   - 1024x768
   - 1366x768

Tool QA aggiunto:
- `cd client && npm.cmd run qa:capture:responsive`
  - cattura screenshot multi-viewport per audit visuale rapido.
  - nota ambiente sandbox corrente (2026-03-04):
    - Playwright/Chrome/Edge headless fallisce con `spawn EPERM`.
    - avvio server puo fallire con `EADDRINUSE` su `:2567` se un processo locale e gia attivo.
  - in questi casi usare checklist manuale su browser reale.

## 10) M10 - Artwork reali + inspect adaptive + pending hardening + landscape polish

Verifiche automatiche eseguite:
- `cd client && npm.cmd run build` -> OK
- `cd server && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/PendingPlayModel.test.ts tests/ArtworkCatalog.test.ts tests/TextFitModel.test.ts tests/CardPresentationModel.test.ts` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts` -> OK
- `cd client && npm.cmd run art:check` -> OK

Esito artwork check:
- template totali: 24
- artwork coperti via file/alias: 2 (`emp_01`, `emp_07`)
- missing: 22
- extra non mappati in `client/public/cards`: 0
- unresolved in `artworks/`: 0

Fix validati nel codice:
- inspect overlay:
  - riquadro artwork non piu fisso, adattato al ratio reale dell'immagine quando presente
  - body description fit-tata in spazio disponibile con ellipsis, evitando overflow
- pending rollback:
  - gestione transizioni pending con `pendingTransitionId`
  - cleanup piu robusto su reconcile autorevole per prevenire pending stale/orfani
- landscape:
  - board piu ampia via `MatchLayout`
  - scaling mini-card ridotto in hand/company/crisis per diminuire affollamento
- animation polish:
  - apertura/chiusura inspect con fade/scale
  - target selector con ingresso fade/slide leggero

QA visuale automatica (responsive capture):
- comando eseguito con server/client in background + `npm.cmd run qa:capture:responsive`
- esito in questo ambiente sandbox: NON eseguibile completamente per limiti sistema:
  - `spawn EPERM` su browser headless (Chrome/Edge/Bundled Chromium)
  - possibile `EADDRINUSE :2567` se server locale gia attivo
  - `spawn EPERM` su startup Vite/esbuild in alcuni run isolati

Checklist manuale raccomandata (browser locale reale):
1. Avvia server+client in locale.
2. Verifica portrait + landscape:
   - no overlap tra HUD/log/cards
   - no overflow testi nelle mini-card e inspect
3. Simula play non valida:
   - carta non deve restare bloccata sul tavolo
4. Apri inspect su carta con artwork reale:
   - immagine centrata, proporzionata, senza crop anomalo
5. Verifica target selector e rollback animazioni su touch/click.

## 11) M11 - Stabilizzazione UI partita + decomposizione scene

Verifiche automatiche eseguite:
- `cd client && npm.cmd run build` -> OK
- `cd server && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/PendingPlayModel.test.ts tests/ArtworkCatalog.test.ts tests/TextFitModel.test.ts tests/CardPresentationModel.test.ts tests/MatchUiPresenter.test.ts tests/CardObjectRegistry.test.ts` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts` -> OK
- `cd client && npm.cmd run art:check` -> OK

Fix tecnici confermati:
- ristrutturazione UI logic:
  - `MatchUiPresenter` per HUD + action panel copy
  - `CardObjectRegistry` per cleanup coerente card live
- bottoni:
  - CTA `ATTACCA` crisi migrate a `createSimpleButtonFx` (stessa animazione base del resto UI)
  - bottone `X` inspect migrato a `createSimpleButtonFx`
- carte/pending:
  - pending play con guard transizionale (`pendingTransitionId`)
  - reconcile autorevole piu robusto contro pending stale
  - cleanup orfani/duplicati delegato a registry plan
- inspect:
  - apertura/chiusura con animazioni leggere e stabili
  - area artwork adattiva su ratio immagine

Checklist manuale suggerita (mobile + desktop):
1. Portrait 360x640 / 390x844 / 414x896:
   - nessun overlap tra HUD/log/action panel/hand
2. Landscape 844x390 / 896x414 / 1366x768:
   - board leggibile, hand non invasiva, bottoni non coperti
3. Flusso partita:
   - turno/AP chiari
   - pesca bloccata con motivo esplicito
   - ATTACCA crisi con stato disponibile/bloccato chiaro
4. Invalid play:
   - play non valida -> rollback in mano senza card stuck/orphan/dup
5. Inspect:
   - tap carta -> overlay leggibile
   - chiusura con `X` e tap fuori affidabile

Note ambiente:
- capture browser automatico puo fallire in sandbox per `spawn EPERM`; usare browser locale reale per validazione visuale finale.

## 12) M12 - Gameplay Audit End-to-End (server authoritative + client affordance)

Verifiche eseguite:
- `cd server && npm.cmd run build` -> OK
- `cd client && npm.cmd run build` -> OK
- smoke+targeted gameplay suite:
  - `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts server/tests/gameplay_audit_repair.test.ts tests/PendingPlayModel.test.ts tests/MatchUiPresenter.test.ts tests/ArtworkCatalog.test.ts tests/CardObjectRegistry.test.ts`
  - esito: `10/10 suite PASS`
- estensione di controllo:
  - `npm.cmd test -- --runInBand --forceExit server/tests/room_connection.test.ts` -> PASS

Fix validati da test M12:
- Start lobby:
  - host-only start
  - vincolo player ready
  - setup iniziale mano a 3 carte
- Turn/AP:
  - reaction senza consumo AP
  - validazione azioni turn-based invariata e server-side
- Item equip:
  - target Hero obbligatorio, errore esplicito senza corruzione stato
- Monster flow:
  - `DICE_ROLLED` include `modifier` e `targetRoll`
  - refill board a 3 slot dopo risoluzione riuscita
- Disconnect cleanup:
  - pending action annullata e stato reaction ripulito
  - fallback `WAITING_FOR_PLAYERS` quando non restano connessi

Checklist playtest manuale aggiornata (partita completa):
1. Pre-lobby: 2+ player pronti, start solo host.
2. Turno iniziale: AP = 3 sul player attivo.
3. Draw:
   - draw valido scala 1 AP;
   - draw bloccato mostra motivo (no turno/no AP/deck empty).
4. Hero:
   - Hero giocabile solo con azione assunzione.
5. Magic/Item:
   - reaction-only rifiutate fuori reaction window;
   - Item richiede Hero target valido.
6. Reaction window:
   - aperta su assunzione/magic/monster;
   - solo avversari possono reagire;
   - fine finestra con risoluzione chiara.
7. Monster:
   - tentativo via azione esplicita su Monster (non via drop carta);
   - feedback dado con 2d6, modifier, targetRoll, esito.
8. Fine turno:
   - passaggio turno coerente al prossimo connesso.
9. Error path:
   - azione invalida -> feedback esplicito, nessun desync mano/tavolo.

Suite legacy ancora failing (fuori scope M12):
- `tests/room_connection.test.ts`
- `tests/core_loop.test.ts`
- `tests/reaction_race_condition.test.ts`

Motivazione residuo:
- usano harness di integrazione Colyseus obsoleto/non allineato all'assetto corrente (`room.__init`, fetch bootstrap test server, import config mancante).
- la correzione richiede rework dell'infrastruttura test e non della logica gameplay core toccata in M12.

## 13) M13 - Onboarding UX + Player Clarity + Production Polish

Verifiche target M13:
- onboarding help disponibile in match (`?`) -> modal `Come si gioca` apribile/chiudibile.
- onboarding help disponibile in prelobby (`?`) -> modal equivalente apribile/chiudibile.
- hint contestuale action panel:
  - pending action
  - reaction window
  - attesa turno
  - attacco mostro disponibile
  - pesca disponibile
  - no monsters / deck empty / blocked reason
- chiarezza board monster:
  - slot visivo dedicato sotto carta Mostro
  - CTA attacco leggibile

Checklist manuale M13 (partita completa):
1. Entrare in prelobby e aprire help: testo leggibile, chiusura via `X` o tap esterno.
2. Avviare partita e aprire help in match: contenuti brevi e comprensibili.
3. Verificare action panel:
   - turno tuo/non tuo
   - AP visibili
   - hint contesto coerente con stato reale
4. Tentare pesca con AP insufficienti -> blocco con motivo.
5. Tentare attacco Mostro:
   - con requisiti validi -> azione consentita
   - senza requisiti -> motivo blocco esplicito
6. Reaction window attiva:
   - hint e stato reaction visibili
7. Targeting Item/Magic:
   - target non valido -> feedback esplicito
8. Portrait/Landscape:
   - nessun overlap evidente in HUD/pannelli/help/modal
   - bottoni cliccabili su touch

Verifica responsive consigliata:
- `360x640`
- `390x844`
- `414x896`
- `768x1024`
- `896x414`
- `1366x768`

Nota ambiente:
- Se `qa:capture:responsive` fallisce in sandbox (`spawn EPERM`), usare checklist manuale su browser locale reale.

## 14) M14 - Responsive Hardening Finale + Brand/Typography Consistency

## 22) M22 - QA Assert Hardening + Button Drift Guard

Data verifica: 2026-03-05

Modifiche principali validate:
- `SimpleButtonFx` hardening anti-drift:
  - se il target non e scalabile senza slittamento (tipico `Graphics` non centrato), fallback ad animazione alpha invece di scale.
  - mantenuto contratto unico: hover `1.015`, press `0.985`, `90ms/75ms`, touch target `>=44`.
- QA visuale:
  - fix assert in `client/qa/capture-responsive.mjs` e `client/qa/capture-match.mjs`:
    - niente falso fail su `#app/canvas` full-viewport rispetto safe area;
    - input hidden/non visibili esclusi dai check;
    - check safe-area applicato ai pannelli DOM critici visibili.

Comandi eseguiti:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit`
- `cd client && npm.cmd run qa:capture:responsive` (con dev server attivo)
- `cd client && npm.cmd run qa:capture:match` (con dev server attivo)

Esito:
- build client: OK
- build server: OK
- test suite: `27/27` suite PASS, `154/154` test PASS
- responsive capture initial screens:
  - `client/qa/output/summary.initial.json`
  - totale 48, fail 0
- match/mock capture:
  - `client/qa/output/match/summary.json`
  - totale 112, fail 0
- page errors bloccanti: 0
- console errors non bloccanti:
  - initial screens (login): `net::ERR_CONNECTION_REFUSED` quando backend non e avviato (QA puramente UI)
  - match/mock: warning Phaser su artwork mancanti (`card-art-*`) con fallback attivo

Note operative:
- In ambiente sandbox, i capture script possono fallire con `spawn EPERM` se eseguiti senza permessi estesi/browser launch.
- Esecuzione consigliata per QA completa:
  - avviare dev server e lanciare capture con browser headless consentito.

Verifiche target M14:
- brand iniziale coerente tra `BootScene`, `LoginScene`, `PreLobbyScene` tramite contratto condiviso in `Branding.ts`.
- login alleggerita e più lineare nelle sezioni:
  - Lingua
  - Modalità
  - Codice stanza
  - Nome CEO
  - CTA
- match portrait/landscape basso con layout più ordinato:
  - top bar meno pesante
  - hand meno invasiva
  - board più leggibile
  - action panel compatto in landscape basso
- bottoni principali confermati su contratto unico `createSimpleButtonFx`.

Comandi eseguiti:
- `cd server && npm.cmd run build` -> OK
- `cd client && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/MatchHelpContent.test.ts tests/MatchActionState.test.ts tests/TextFitModel.test.ts tests/PendingPlayModel.test.ts tests/MatchUiPresenter.test.ts tests/CardPresentationModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts server/tests/gameplay_audit_repair.test.ts` -> OK (12 suite, 65 test)
- `cd client && npm.cmd run qa:capture:responsive` -> non eseguibile in questo ambiente (headless `spawn EPERM`)

Checklist manuale M14 (responsive + coerenza tipografica):
1. Stesso viewport in Boot/Login/PreLobby:
   - titolo e sottotitolo con scala percepita coerente
   - posizione header coerente (niente salto evidente tra scene)
2. Login:
   - nessuna sovrapposizione tra Lingua/Modalità
   - nessuna label vicino in modo errato a input/CTA
   - spazio verticale chiaro tra codice, nome e bottone principale
3. Match portrait:
   - no overlap HUD/log/hand/action panel
   - bottoni draw/end/help/log toggle affidabili al tap
4. Match landscape basso:
   - top bar non affollata
   - board leggibile
   - hand ridotta e non invasiva
   - action panel compatto leggibile
5. Verifica no overflow/no crowding nelle aree toccate.

Viewport obbligatori da validare manualmente:
- `360x640`
- `390x844`
- `414x896`
- `768x1024`
- `844x390`
- `896x414`
- `1024x768`
- `1366x768`

Limiti ambiente (non bloccanti):
- capture responsive automatica non disponibile in sandbox per vincoli `spawn EPERM` sui browser headless.

## 17) M17 - Localizzazione Finale + Responsive Hardening + Artwork Mapping

Verifiche automatiche eseguite:
- `cd server && npm.cmd run build` -> OK
- `cd client && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/I18nCoverage.test.ts tests/CardTextCatalog.test.ts tests/MockMatchStateI18n.test.ts tests/CardPresentationModel.test.ts tests/ArtworkCatalog.test.ts tests/TextFitModel.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts` -> OK
- `cd client && npm.cmd run art:check` -> OK
- `cd client && npm.cmd run qa:capture:match` -> OK (home+match+mock, IT/EN, tutti i viewport obbligatori)
- `cd client && npm.cmd run qa:capture:responsive` -> KO in questo ambiente (`spawn EPERM` su browser headless)

Checklist i18n completata:
1. Schermate iniziali IT/EN: OK.
2. Match HUD/log/help/action reasons IT/EN: OK.
3. Carte mini/full: testi da `CardTextCatalog` IT/EN: OK.
4. Mock match (`?qaMatch=1`) con lingua query (`lang=it|en`): OK.
5. Nessun fallback casuale al solo italiano nelle aree toccate: OK.

Checklist responsive (da `qa:capture:match` + review immagini):
1. `360x640` portrait (IT/EN): no overlap critici su crisis/company/hand/log.
2. `390x844` portrait (IT/EN): no overflow critici.
3. `414x896` portrait (IT/EN): layout stabile.
4. `768x1024` portrait (IT/EN): pannelli leggibili.
5. `844x390` e `896x414` landscape basso (IT/EN): ridotto crowding; CTA crisi e pannelli non sovrapposti.
6. `1024x768` e `1366x768` (IT/EN): layout ordinato.

Note console/page errors:
- Nessun `pageerror` bloccante nei capture match.
- Console warnings previste per artwork mancanti (`card-art-*`) su template non ancora coperti da PNG reali.

Stato artwork:
- Coperti e mappati: `emp_01`, `emp_07`.
- Mancanti: 22 template (fallback procedurale attivo).
- Dettaglio in `docs/ARTWORK_MAPPING.md`.
- possibile `EADDRINUSE :2567` se un server locale è già attivo prima del run QA.

## 15) M15 - Mock Match QA + i18n Sweep + Responsive pass finale

### Verifiche eseguite

Comandi:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/LoginSceneI18nGuard.test.ts tests/MockMatchState.test.ts tests/ButtonFxContract.test.ts tests/MatchUiPresenter.test.ts tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`

Esito:
- build server: OK
- build client: OK (eseguita fuori sandbox quando richiesto da `spawn EPERM`)
- suite mirata + smoke gameplay: 11/11 suite PASS, 56/56 test PASS

### QA Match ripetibile senza partita reale

Modalità:
- apri `/?qaMatch=1` per entrare direttamente in `GameScene` mock (senza Colyseus/server)
- opzionale: `&qaState=my_turn|other_turn|reaction_window`
- opzionale: `&uiDebug=1` per visualizzare i bounds layout

Comandi screenshot:
- `cd client && npm.cmd run qa:capture:responsive`
- `cd client && npm.cmd run qa:capture:match`

Output:
- screenshot home responsive: `client/qa/output/*.png`
- screenshot match mock responsive: `client/qa/output/match/*.png`
- summary con errori console: `client/qa/output/match/summary.json`

Viewport coperti:
- `360x640`
- `390x844`
- `414x896`
- `768x1024`
- `844x390`
- `896x414`
- `1024x768`
- `1366x768`

### Checklist manuale rapida (portrait + landscape)

1. Apri `/?qaMatch=1&uiDebug=1`.
2. Verifica hand/HUD/log/controls in portrait (`360x640`, `390x844`) senza overlap testo.
3. Verifica landscape basso (`844x390`, `896x414`) con top bar compatta e board leggibile.
4. Apri inspect carta da hand/company/crisi e chiudi con `X` o tap esterno.
5. Verifica bottoni principali (`draw`, `end turn`, toggle log/help, close overlay) con feedback coerente.
6. Verifica che i mode buttons in login mostrino label localizzate (IT/EN), non hardcoded.

### Note non bloccanti ambiente

- Durante capture integrato possono comparire:
  - `EADDRINUSE :2567` (server già attivo localmente)
  - `ERR_CONNECTION_REFUSED` lato home quando lo script punta a un host senza backend
  - warning artwork mancanti (fallback attivo, non blocca QA layout)

## 12) M16 - Gameplay bugfix QA checklist

Data verifica: 2026-03-05

### Verifiche automatiche eseguite
- `cd server && npm.cmd run build` -> OK
- `cd client && npm.cmd run build` -> OK (run fuori sandbox per vincolo EPERM su esbuild)
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts server/tests/gameplay_audit_repair.test.ts server/tests/gameplay_foundation.test.ts tests/reaction_race_condition.test.ts tests/core_loop.test.ts tests/room_connection.test.ts` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/I18nCoverage.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/LoginSceneI18nGuard.test.ts` -> OK

### Checklist manuale partita completa
1. Join host + join avversario con room code valido.
2. Ready entrambi + start match (mano iniziale 3 carte ciascuno).
3. Draw:
   - turno proprio + AP sufficienti -> consentito.
   - non turno / AP 0 / deck vuoto -> bloccato con motivazione chiara.
4. Play Hero:
   - carta Hero valida -> entra in reaction window.
5. Play Magic:
   - target richiesto mancante -> errore esplicito.
   - target valido -> action pendente con reaction window.
6. Play Item:
   - Hero target valido -> equip riuscito visibile in company.
   - Hero target invalido/non presente al resolve -> rollback in mano.
7. Reaction:
   - solo avversari possono reagire.
   - reazioni fuori window -> rifiutate.
8. Monster attempt:
   - solo CTA `ATTACCA` sulla carta Monster.
   - drop su zona crisi non avvia attacco.
9. Dice resolve:
   - log + toast mostrano player, dadi, modifier, totale, target, esito.
   - reward/penalty mostrati in modo esplicito.
10. Disconnect edge cases:
    - player attivo leave durante `PLAYER_TURN` -> avanzamento turno coerente.
    - player con `pendingAction` leave durante `REACTION_WINDOW` -> cleanup completo.
11. Win condition:
    - vittoria per Hero/company o VP Monster coerente con regole.

### Note residue non bloccanti
- Log test rumorosi su console (`console.log/warn`) ancora presenti ma non bloccano comportamento.
- QA visuale screenshot automatica dipende dall'ambiente browser/headless disponibile.

### QA capture match (mock mode)
- Comando: `cd client && npm.cmd run qa:capture:match`
- Esito: OK su tutti viewport richiesti (`home` + `match`).
- Output screenshot: `client/qa/output/match/*`
- Nota console errors emerse nel capture:
  - errori ripetuti `Failed to process file image card-art-*` su template senza PNG dedicato.
  - comportamento non bloccante: il client usa fallback artwork coerente.

## 18) M18 - Layout system deterministico + responsive hardening finale

Verifiche automatiche eseguite:
- `cd server && npm.cmd run build` -> OK
- `cd client && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/ButtonFxContract.test.ts tests/LoginSceneI18nGuard.test.ts tests/MatchUiPresenter.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts tests/I18nCoverage.test.ts tests/MockMatchStateI18n.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts` -> OK (13 suite, 63 test)
- `cd client && npm.cmd run qa:capture:match` -> OK
- `cd client && npm.cmd run qa:capture:responsive` -> KO in questo ambiente (`spawn EPERM` su browser headless)

Checklist viewport IT/EN (da `qa:capture:match`):
- `360x640` -> home/match/mock OK
- `390x844` -> home/match/mock OK
- `414x896` -> home/match/mock OK
- `768x1024` -> home/match/mock OK
- `844x390` -> home/match/mock OK
- `896x414` -> home/match/mock OK
- `1024x768` -> home/match/mock OK
- `1366x768` -> home/match/mock OK

Check layout applicati:
1. Initial screens: header brand uniforme per tier (Boot/Login/PreLobby).
2. Login: blocchi separati lingua/modalita/input/cta e spacing verticale stabile.
3. Match portrait (`A/B`): stack top/board/controls/hand con log compatto.
4. Match landscape basso (`C`): due colonne board+sidebar con HUD/action/log/hand impilati in sidebar.
5. Inspect card: panel width/height vincolati, artwork ratio-adaptive con min/max.
6. Bottoni: contratto unico hover/press + min hit target `44x44`.

Note non bloccanti:
- nei capture match restano warning console per texture `card-art-*` mancanti (fallback attivo).
- capture responsive home non eseguibile in sandbox per vincoli di launch browser.

## 19) M19 - Reconnect End-to-End + QA Flow

Verifiche automatiche eseguite:
- `cd client && npm.cmd run build` -> OK
- `cd server && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit tests/ReconnectPolicy.test.ts tests/MockMatchState.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts` -> OK
- `cd client && npm.cmd run qa:capture:match` -> KO in questo ambiente (`spawn EPERM` su browser/headless + avvio Vite)

Fix introdotti:
- reconnect client robusto su `ServerManager` con:
  - persistenza locale contesto stanza/sessione
  - retry/backoff entro finestra 25s
  - fallback a login su timeout
- overlay reconnect in `GameScene`:
  - stato "riconnessione in corso"
  - countdown/tentativi testuali
  - blocco azioni gameplay durante reconnect
- ritorno pulito a login con messaggio esplicito in `LoginScene`
- checklist e flow end-to-end documentati in `docs/QA_FLOW.md`

Checklist reconnect manuale:
1. Avvia partita con 2 player.
2. Durante `PLAYER_TURN` disconnetti player attivo.
3. Verifica overlay reconnect nel client disconnesso.
4. Riconnetti entro 30s:
   - overlay sparisce
   - stato partita riprende senza reset.
5. Ripeti lasciando timeout oltre 30s:
   - redirect a login con messaggio di errore.
6. Ripeti in `REACTION_WINDOW`:
   - nessun deadlock lato turno/phase dopo rientro o timeout.

Riferimento flow completo:
- `docs/QA_FLOW.md`

## 20) M20 - QA deterministica initial/match + hardening query-lang

Data verifica: 2026-03-05

Fix introdotti:
1. Supporto lingua via query (`?lang=it|en`) su `BootScene`, `LoginScene`, `PreLobbyScene`, `GameScene`.
2. Supporto scena QA iniziale:
   - `?qaScreen=boot`
   - `?qaScreen=login`
   - `?qaScreen=prelobby&qaPreLobby=1` (prelobby mock senza server).
3. Supporto overlay QA in match mock:
   - `?qaMatch=1&qaInspect=1`
   - `?qaMatch=1&qaHelp=1`
4. Capture script con assert automatici su:
   - elemento dentro viewport
   - elemento dentro safe area tier-based
   - log errori console/page.
5. Safe-area CSS root (`#app`) riallineata ai tier:
   - portrait phone: 12px
   - landscape basso: 8px top/bottom, 10px laterali
   - tablet/desktop: 16px

Comandi eseguiti:
- `cd client && npm.cmd run build` -> OK
- `cd server && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit` -> OK (26/26 suite)
- `cd client && npm.cmd run art:check` -> OK
- `cd client && npm.cmd run qa:capture:match` -> non eseguibile in sandbox (`spawn EPERM`)
- `cd client && npm.cmd run qa:capture:responsive` -> non eseguibile in sandbox (`spawn EPERM`)

Percorsi output QA (quando eseguito su macchina senza blocchi EPERM):
- Initial screens: `client/qa/output/` + `summary.initial.json`
- Match/mock/overlay: `client/qa/output/match/` + `summary.json`

Checklist manuale aggiornata:
1. `?qaScreen=boot&lang=it` e `?qaScreen=boot&lang=en`
2. `?qaScreen=login&lang=it` e `?qaScreen=login&lang=en`
3. `?qaScreen=prelobby&qaPreLobby=1&lang=it` e `...&lang=en`
4. `?qaMatch=1&qaState=my_turn&lang=it` e `...&lang=en`
5. `?qaMatch=1&qaInspect=1&lang=it` / `...&lang=en`
6. `?qaMatch=1&qaHelp=1&lang=it` / `...&lang=en`
7. Verifica no overlap/no overflow/no elementi fuori safe area nei viewport:
   - `360x640`, `390x844`, `414x896`, `768x1024`, `844x390`, `896x414`, `1024x768`, `1366x768`

## 21) M21 - Layout hardening + button animation stability pass

Data verifica: 2026-03-05

Fix principali:
1. `SimpleButtonFx`: animazione resa stabile anche su `Graphics` con coordinate assolute (niente "salti" quando il centro grafico non coincide con la hit area).
2. Match landscape basso:
   - log compatto ancorato al pannello `log` della sidebar (non piu sovrapposto alla board).
   - top meta ridotta in tier `C` per evitare crowding della top bar.
   - min font in compact landscape alzati nelle aree critiche (log + action panel).
3. Overlay reconnect:
   - priorita al pannello DOM (`#ui-root`) per evitare doppio overlay canvas+dom.

Comandi eseguiti:
- `cd client && npm.cmd run build` -> OK
- `cd server && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit` -> OK (27/27 suite, 154/154 test)
- `cd client && npm.cmd run art:check` -> OK
- `cd client && npm.cmd run qa:capture:responsive` -> KO in sandbox (`spawn EPERM`)
- `cd client && npm.cmd run qa:capture:match` -> KO in sandbox (hard-timeout su launch headless)

Nuovi test regressione layout:
- `tests/LayoutContracts.test.ts`
  - tier deterministici A/B/C/D/E
  - safe-area contrattuale per tier
  - brand header metrics esatti per tier
  - match layout e pannelli dentro content bounds
  - split due colonne in tier `C`

## 23) M23 - Match DOM shell + centering landscape + verifica end-to-end

Data verifica: 2026-03-05

Fix principali validati:
1. Shell DOM match introdotta (`MatchUiDom`) per HUD/controls/log/top meta.
2. `GameScene` aggiornata con sync stato DOM, toggle log condiviso e hide canvas UI ridondante.
3. `MatchLayout` centrato in landscape basso (`tier C`) con main block centrato (asse X/Y).
4. `PreLobbyScene` allineata al contratto header condiviso (`getBrandHeaderMetrics`).

Comandi eseguiti:
- `cd client && npm.cmd run build` -> OK
- `cd server && npm.cmd run build` -> OK
- `npm.cmd test -- --runInBand --forceExit` -> OK (`27/27` suite, `154/154` test)
- `cd client && npm.cmd run qa:capture:responsive` -> OK (run con permessi estesi)
- `cd client && npm.cmd run qa:capture:match` -> OK (run con permessi estesi)

Esito capture:
- `client/qa/output/summary.initial.json`:
  - totale 48
  - fail 0
- `client/qa/output/match/summary.json`:
  - totale 112
  - fail 0

Note:
- In sandbox standard i capture possono fallire con `spawn EPERM`; per questa verifica sono stati eseguiti con permessi estesi.
