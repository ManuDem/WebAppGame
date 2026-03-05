# PLAN - Stato Milestone

Piano operativo aggiornato come living document.

## M0 - Baseline & Mapping
Stato: `completata`

Output:
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- mappa avvio/progetto/documentazione

Verifica:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`

## M1 - Specifica regole semplificate
Stato: `completata`

Output:
- `docs/GDD.md` compilato con:
  - as-is dal codice
  - variante semplificata scelta
  - decision log A/B/C
  - impatto tecnico sui file reali

Acceptance:
- regole allineate all'implementazione corrente
- nessun placeholder vuoto per le sezioni critiche M1

## M2 - Refactor logica per testabilita
Stato: `completata`

Output:
- logica estratta da `OfficeRoom` verso `server/src/game/*`:
  - `turnFlow.ts`
  - `winConditions.ts`
  - `monsterBoard.ts`
  - `reactionResolution.ts`
  - `itemEquip.ts`
- `OfficeRoom` mantenuta come orchestratore rete/stato authoritative
- decisioni A/B/C applicate server-side
- nuovi test mirati:
  - `server/tests/gameplay_foundation.test.ts`

Comandi verifica M2:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `npm.cmd test -- --runInBand --forceExit server/tests/gameplay_foundation.test.ts`

Acceptance:
- smoke suite stabile verde
- test nuovi verdi su AP, reaction-only, item equip su Hero, monster refill

## M3 - UI/UX carte
Stato: `in_progress`

Scope previsto:
- mini-card + overlay carta grande
- hit areas mobile-first
- miglioramenti leggibilita board/hand

Avanzamento corrente (2026-03-04):
- pipeline artwork PNG pronta con fallback sicuro:
  - `client/src/ui/CardArtworkResolver.ts`
  - preload manifest in `client/src/scenes/BootScene.ts`
  - risoluzione on-demand da `/cards/{templateId}.png`
- mini-card migliorate:
  - artwork PNG quando disponibile, fallback procedurale altrimenti
  - testo compatto con preferenza `shortDesc`
  - badge equip per Hero con Item equipaggiati
- overlay inspect migliorato:
  - artwork reale quando disponibile
  - fallback grafico mantenuto
  - dettagli completi (target roll/modifier/subtype/equip count)
- targeting UX esteso:
  - Item -> selezione Hero (auto-target se 1 Hero, errore esplicito se 0 Hero)
  - Magic/Event target opponent -> feedback esplicito se nessun avversario disponibile

### CARD LAYOUT CONTRACT - stile vicino a Here To Slay

- Mini-card verticali, artwork dominante, info sintetiche e niente paragrafi lunghi.
- Struttura mini-card obbligatoria:
  - area artwork alta con PNG reale o fallback coerente
  - header compatto (nome + tipo/classe + badge valore chiave)
  - info strip singola (shortDesc/riassunto per tipo carta)
  - nessuna descrizione completa in miniatura
- Full-card obbligatoria su tap/click:
  - artwork grande in alto
  - titolo + tipo/classe/subtipo + valori chiave
  - descrizione completa + note contestuali
  - chiusura doppia: tap fuori e pulsante `X` grande
- Coerenza layout tra mano, campo e inspect.
- Mobile first: hit area generose, no overlap, no testo fuori area.

## M4 - Pixel art makeover
Stato: `in_progress`

Scope previsto:
- render crisp + scaling
- feedback visivo coerente
- layout anti-overlap mobile/landscape

Avanzamento corrente (2026-03-04):
- rendering bilanciato:
  - testi UI nitidi (antialias attivo per leggibilita)
  - artwork/asset carta in stile pixel tramite filtro nearest dedicato
  - `roundPixels` mantenuto per stabilita di posizionamento

## M5 - i18n IT/EN completo
Stato: `pending`

Scope previsto:
- centralizzazione stringhe residue
- copertura completa scene UI
- persistenza lingua

## M6 - QA finale
Stato: `pending`

Scope previsto:
- `docs/QA.md`
- playtest checklist completa
- bug bloccanti finali

## M7 - Match Readability + Live HUD + Anti-Overlap
Stato: `in_progress`

Output:
- `docs/ui/MATCH_UI_SPEC.md`
- layout manager: `client/src/ui/layout/MatchLayout.ts`
- integrazione layout in `GameScene` con debug mode (`uiDebug=1`)
- HUD live persistente (turno/AP/VP/deck/discard/phase/reaction)
- event feed persistente collassabile
- surfacing `DICE_ROLLED` (toast + feed)
- miglioramenti leggibilita board/opponents (badge roll crisi + info sintetiche)

Comandi verifica:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`

Acceptance M7:
- zone partita calcolate centralmente
- no overlap strutturale nelle aree toccate
- log eventi persistente visibile in match
- feedback dado esplicito lato client
- testi UI nitidi e wrapping stabile

## M8 - Bug Bash Carte/Tavolo/i18n/Header
Stato: `completata`

Output:
- `client/src/systems/PendingPlayModel.ts` (modello pending/rollback testabile)
- `client/src/systems/TextFitModel.ts` + `client/src/ui/text/FitText.ts`
- hardening `GameScene` su rollback pending + cleanup orfani
- hardening `CardGameObject` su contenuti mini-card localizzati e anti-overflow
- uniformazione header Boot/Login/PreLobby via `layoutBrandHeader(...)`
- test nuovi:
  - `tests/PendingPlayModel.test.ts`
  - `tests/TextFitModel.test.ts`
- spec UI carte: `docs/ui/CARD_UI_SPEC.md`

Comandi verifica:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts`
- smoke suite stabile

## Decisioni bloccanti (attive)

- A: Challenge/Modifier reaction-only; Magic attiva.
- B: Item su Hero specifico, fallback player-level solo temporaneo.
- C: Monster board sempre a 3 con refill immediato.

## M9 - Match UX Clarity + Landscape Fix
Stato: `completata`

Output:
- modularizzazione della logica azioni in modulo testabile:
  - `client/src/ui/match/MatchActionState.ts`
- `GameScene` aggiornata per:
  - pannello stato azioni (turno/attacco/pesca/fine turno + motivi blocco)
  - bottone `ATTACCA` esplicito sotto ogni Imprevisto
  - feedback bloccanti espliciti su draw/end turn/attack
  - rimozione attacco Imprevisto via drag-drop ambiguo
- layout manager potenziato:
  - `controls` area dedicata in `MatchLayout`
  - hand ridotta e board espansa in landscape
  - log riposizionato in board (landscape) per ridurre overlap top HUD
- pipeline artwork reale:
  - mapping manifest in `CardArtworkResolver`
  - integrazione PNG reali in `client/public/cards/`
- QA tooling:
  - script screenshot responsive `client/qa/capture-responsive.mjs`

Comandi verifica M9:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts tests/I18nCoverage.test.ts tests/CardPresentationModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts server/tests/room_connection.test.ts`

Acceptance M9:
- in landscape la schermata match non mostra overlap critici nei pannelli toccati
- draw/end/attacco mostrano motivi blocco chiari
- attacco Imprevisti comprensibile (CTA dedicata) e non ambiguo via drag
- carte piu compatte in board/hand su viewport landscape
- artwork PNG reali usati dove disponibili, fallback invariato altrove

## M10 - Artwork Reali + Inspect Adaptive + Hardening Pending + Landscape Polish
Stato: `completata`

Output:
- artwork catalog testabile estratto:
  - `client/src/ui/cards/ArtworkCatalog.ts`
- resolver aggiornato su catalog centralizzato:
  - `client/src/ui/CardArtworkResolver.ts`
- check artwork aggiornato:
  - `client/scripts/check_artworks.mjs`
- inspect carta adattivo (aspect ratio artwork + body fit anti-overflow):
  - `client/src/scenes/GameScene.ts`
- hardening pending play / rollback / reconcile:
  - `client/src/scenes/GameScene.ts`
- landscape cleanup (piu spazio board, carte piu compatte):
  - `client/src/ui/layout/MatchLayout.ts`
  - `client/src/scenes/GameScene.ts`
- animation polish:
  - apertura/chiusura inspect con tween stabili
  - ingresso target selector con fade/slide leggero
- test nuovi/estesi:
  - `tests/ArtworkCatalog.test.ts`
  - `tests/PendingPlayModel.test.ts` (copertura aggiuntiva)

Comandi verifica M10:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/PendingPlayModel.test.ts tests/ArtworkCatalog.test.ts tests/TextFitModel.test.ts tests/CardPresentationModel.test.ts`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `cd client && npm.cmd run art:check`

Acceptance M10:
- pipeline artwork reale usa `/cards/<templateId>.png` + alias espliciti documentati
- inspect card usa riquadro artwork adattivo al ratio immagine
- rollback pending non lascia carte orfane o duplicate nei flussi toccati
- layout landscape meno affollato con board piu leggibile
- test mirati verdi su pending e artwork catalog

## M11 - Match UI Stabilization (Portrait + Landscape) and Scene Decomposition
Stato: `completata`

Output:
- `GameScene` alleggerita tramite estrazione presenter/sistemi:
  - `client/src/ui/match/MatchUiPresenter.ts`
  - `client/src/systems/CardObjectRegistry.ts`
- HUD/action panel ora costruiti tramite presenter puro:
  - testo turno/AP/fase/reaction/opponents centralizzato
  - copy action panel centralizzata con motivi blocco
- cleanup card live/orfani centralizzato con `CardObjectRegistry`
- bottoni crisi (`ATTACCA`) migrati a animazione condivisa `createSimpleButtonFx`
- bottone chiusura inspect migrato a animazione condivisa `createSimpleButtonFx`
- hardening pending/reconcile ulteriormente consolidato:
  - transizioni protette con `pendingTransitionId`
  - cleanup pending stale su `applyState` autoritativo
- fix layout landscape aggiuntivi:
  - board piu spaziosa, hand/control piu compatti
  - riduzione scala carte in hand/company/crisis su viewport bassi
- inspect overlay migliorato con animazione open/close stabile e art frame adattivo

Test nuovi:
- `tests/MatchUiPresenter.test.ts`
- `tests/CardObjectRegistry.test.ts`

Comandi verifica M11:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/PendingPlayModel.test.ts tests/ArtworkCatalog.test.ts tests/TextFitModel.test.ts tests/CardPresentationModel.test.ts tests/MatchUiPresenter.test.ts tests/CardObjectRegistry.test.ts`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `cd client && npm.cmd run art:check`

Acceptance M11:
- GameScene piu orchestratore, meno logica testuale/registry interna
- bottoni principali coerenti nella stessa animazione base
- rollback invalid play piu robusto contro orphan/duplicate
- portrait + landscape stabilizzati nelle aree toccate (HUD/board/hand/log/inspect)

## M12 - Gameplay Audit End-to-End + Server/Client Alignment
Stato: `completata`

Output:
- audit gameplay reale consolidato:
  - `docs/GAMEPLAY_AUDIT.md`
- contratti gameplay aggiornati:
  - `shared/SharedTypes.ts` (`IDiceRolledEvent.modifier`, `IDiceRolledEvent.targetRoll`)
- hardening server authoritative:
  - `server/src/rooms/OfficeRoom.ts`
  - `server/src/game/turnFlow.ts`
  - `shared/CardEffectParser.ts`
- allineamento affordance client al flusso reale:
  - `client/src/network/ServerManager.ts`
  - `client/src/scenes/GameScene.ts`
  - `client/src/i18n.ts`
- test gameplay mirati:
  - `server/tests/gameplay_audit_repair.test.ts`

Decisioni gameplay applicate:
- Monster flow: azione esplicita su slot Monster (`SOLVE_CRISIS` su `crisisId`), non drop ambiguo di carte dalla mano.
- Reaction: `PLAY_REACTION` non consuma AP; resta vincolata a reaction window, avversari, carta valida.
- Item: equip solo su Hero valido (target Hero obbligatorio), senza fallback ambiguo player-level.

Comandi verifica M12:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts server/tests/gameplay_audit_repair.test.ts tests/PendingPlayModel.test.ts tests/MatchUiPresenter.test.ts tests/ArtworkCatalog.test.ts tests/CardObjectRegistry.test.ts`

Acceptance M12:
- start/turn/AP/draw/reaction/monster/win coerenti lato server authoritative
- flusso Monster leggibile e coerente lato client (azione esplicita + feedback dado esteso)
- cleanup robusto su disconnect durante pending/reaction
- nessun mismatch critico client/server sulle regole principali toccate
- test gameplay mirati verdi

## M13 - Onboarding UX + Player Clarity + Production Polish
Stato: `completata`

Output:
- onboarding in-game accessibile:
  - modal `Come si gioca` in `GameScene`
  - modal help equivalente in `PreLobbyScene`
- hint contestuali gameplay:
  - nuovo modulo puro `client/src/ui/match/MatchHelpContent.ts`
  - contesto azione mostrato nel pannello controlli (turno/AP/pesca/monster/reaction)
- clarity/polish visuale:
  - pulsante help unificato con stessa animazione globale (`SimpleButtonFx`)
  - slot grafici Monster più leggibili in board
  - action panel con gerarchia testuale più chiara
- regressione safety:
  - test puro `tests/MatchHelpContent.test.ts`

Comandi verifica M13:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit server/tests/gameplay_audit_repair.test.ts server/tests/gameplay_foundation.test.ts server/tests/room_connection.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts tests/PendingPlayModel.test.ts tests/MatchUiPresenter.test.ts tests/ArtworkCatalog.test.ts tests/CardObjectRegistry.test.ts tests/MatchActionState.test.ts tests/I18nCoverage.test.ts tests/CardPresentationModel.test.ts tests/MatchHelpContent.test.ts`
- `cd client && npm.cmd run art:check`
- `cd client && npm.cmd run qa:capture:responsive` (se supportato dall'ambiente)

Acceptance M13:
- il giocatore può aprire una spiegazione rapida del gioco da match e prelobby
- il pannello azioni espone chiaramente cosa è disponibile ora e perché
- feedback contestuali riducono ambiguità su pesca/mostri/reaction/azioni bloccate
- integrazione artwork reale mantiene fallback robusto
- QA/checklist copre una partita completa con viewport portrait/landscape

## M14 - Responsive Hardening Finale + Brand/Typography Consistency
Stato: `completata`

Output:
- contratto brand unificato in sorgente unica:
  - `client/src/ui/Branding.ts`
  - layout condiviso con `titleFontSize`, `subtitleFontSize`, `titleY`, `subtitleY`, `bottomY`
- migrazione scene iniziali senza override incoerenti:

## M22 - QA Assert Hardening + UI Stability Guard
Stato: `completata`

Output:
- hardening animazione bottoni condivisa:
  - `client/src/ui/SimpleButtonFx.ts`
  - fallback alpha automatico per target non scalabili senza drift
- allineamento QA visuale a safe-area reale:
  - `client/qa/capture-responsive.mjs`
  - `client/qa/capture-match.mjs`
  - esclusione falsi positivi (`#app/canvas` full-screen, input hidden)
- regressione check layout:
  - `tests/LayoutContracts.test.ts` (tier/safe-area/header/panel contracts)

Comandi verifica M22:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit`
- `cd client && npm.cmd run qa:capture:responsive` (con dev server attivo)
- `cd client && npm.cmd run qa:capture:match` (con dev server attivo)

Acceptance M22:
- build client/server verdi
- suite test completamente verde
- responsive capture initial screens: 0 fail
- match/mock capture: 0 fail
- nessun falso fail sistemico su safe-area dovuto al canvas full-screen

## M23 - Match DOM Shell + Landscape Centering Deterministico
Stato: `completata`

Output:
- nuovo overlay DOM match:
  - `client/src/ui/dom/MatchUiDom.ts`
  - HUD, controlli, log e top meta spostati in shell DOM con CSS grid
- hardening layout landscape:
  - `client/src/ui/layout/MatchLayout.ts`
  - blocco principale centrato verticalmente e orizzontalmente in tier `C`
- update scena:
  - `client/src/scenes/GameScene.ts`
  - sincronizzazione stato -> DOM (`refreshMatchDomUi`)
  - toggle log condiviso canvas/DOM
  - hide canvas HUD/controls/log quando shell DOM attiva
- supporto layout engine:
  - `client/src/ui/layout/ViewportTier.ts`
  - `client/src/ui/layout/LayoutEngine.ts`
- coerenza header iniziali:
  - `client/src/scenes/PreLobbyScene.ts` migrata a `getBrandHeaderMetrics(...)`

Comandi verifica M23:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit`
- `cd client && npm.cmd run qa:capture:responsive` (con dev server attivo)
- `cd client && npm.cmd run qa:capture:match` (con dev server attivo)

Acceptance M23:
- match UI testuale principale governata da DOM/CSS grid
- landscape basso con contenuto centrato e meno crowding
- build/test verdi dopo refactor
- capture responsive iniziali: `48/48` ok
- capture match/mock/overlay IT+EN: `112/112` ok
  - `BootScene`, `LoginScene`, `PreLobbyScene`
- cleanup login:
  - spaziatura verticale riallineata (lingua/modalita/codice/nome/CTA)
  - riduzione densità in viewport bassi
  - fitting testo su label critiche (`fitTextToBox`)
- hardening match portrait/landscape:
  - `MatchLayout` alleggerito in landscape basso (top/hand meno invasivi, board più ampia)
  - `GameScene` ottimizzata per top bar e action panel in compact landscape
  - log compattato e riposizionato per viewport bassi
- verifica finale contratto bottoni:
  - pulsanti principali iniziali + match confermati su `createSimpleButtonFx`

Comandi verifica M14:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/MatchHelpContent.test.ts tests/MatchActionState.test.ts tests/TextFitModel.test.ts tests/PendingPlayModel.test.ts tests/MatchUiPresenter.test.ts tests/CardPresentationModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts server/tests/gameplay_audit_repair.test.ts`
- `cd client && npm.cmd run qa:capture:responsive` (best effort: dipende dai permessi browser/headless dell'ambiente)

Acceptance M14:
- titolo/sottotitolo coerenti per scala e posizione tra Boot/Login/PreLobby a parità di viewport
- LoginScene senza override locale incoerente della tipografia brand
- login meno affollata e più lineare nelle aree lingua/modalità/input/CTA
- match più ordinato in portrait e in landscape basso
- bottoni principali allineati al contratto visivo/interattivo unico
- nessun overlap/overflow evidente nelle aree toccate

## M15 - i18n Sweep Login + Mock Match QA + Responsive Stabilization
Stato: `completata`

Output:
- i18n finale Login:
  - rimosse label hardcoded `HOST` / `JOIN` in `LoginScene`
  - mode buttons ora legati a chiavi i18n (`login_mode_host`, `login_mode_join`)
- guard anti-regressione:
  - `tests/LoginSceneI18nGuard.test.ts` blocca reintroduzione di stringhe hardcoded nei mode buttons
- mock match mode per QA senza server:
  - nuovo modulo `client/src/qa/MockMatchState.ts`
  - ingresso diretto in `GameScene` con `?qaMatch=1` (o `?mockMatch=1`)
  - preset supportati (`my_turn`, `other_turn`, `reaction_window`) via query (`qaState`/`qaTurn`)
  - branch mock isolato dal gameplay reale (nessun impatto su flusso standard)
- QA screenshot match ripetibile:
  - nuovo script `client/qa/capture-match.mjs`
  - nuovo comando `npm run qa:capture:match`
  - output in `client/qa/output/match/*` con `summary.json` (include console errors)
- responsive pass mirato (viewport critici):
  - tuning layout in `MatchLayout` e `GameScene` per landscape basso (`844x390`, `896x414`)
  - riduzione crowding top/action/log in modalità compact
- button consistency:
  - verifica contrattuale tramite test `tests/ButtonFxContract.test.ts`

Comandi verifica M15:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/LoginSceneI18nGuard.test.ts tests/MockMatchState.test.ts tests/ButtonFxContract.test.ts tests/MatchUiPresenter.test.ts tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `cd client && npm.cmd run qa:capture:responsive`
- `cd client && npm.cmd run qa:capture:match`

Acceptance M15:
- `LoginScene` senza `HOST`/`JOIN` hardcoded nei mode buttons
- modalità mock match attiva con `?qaMatch=1` e isolata dal gameplay reale
- pipeline QA produce screenshot match portrait+landscape in modo ripetibile
- fix applicati nei viewport critici con riduzione overlap/crowding
- bottoni principali verificati sul contratto condiviso

## M16 - Gameplay Bugfix + Client/Server Alignment + Anti-Regression
Stato: `completata`

Output:
- audit mirato gameplay:
  - `docs/GAMEPLAY_BUGFIX_AUDIT.md`
- server authoritative hardening:
  - `server/src/rooms/OfficeRoom.ts`
  - `shared/CardEffectParser.ts`
  - `shared/SharedTypes.ts`
- client flow/feedback allineato:
  - `client/src/scenes/GameScene.ts`
  - `client/src/i18n.ts`
- test anti-regressione aggiornati:
  - `server/tests/gameplay_audit_repair.test.ts`
  - `server/tests/gameplay_foundation.test.ts`
  - `tests/CardEffectParser.test.ts`
  - `tests/reaction_race_condition.test.ts`

Fix chiave M16:
- Monster flow univoco: `SOLVE_CRISIS` come azione esplicita su Monster/slot.
- Effetti non fantasma:
  - `protect` ora blocca e consuma lo scudo su effetti ostili targeted.
  - `discount_cost` ora riduce realmente il costo magia e consuma i tag.
- `steal_played_card`: tipo carta rubata preservato correttamente.
- Item invalidi al resolve: rollback in mano, niente consumo senza effetto.
- Disconnect/leave in stati delicati: cleanup robusto di pending/stack/timer.
- `DICE_ROLLED`: payload e surfacing migliorati (modifier, target, outcome, reward/penalty).

Comandi verifica M16:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts server/tests/gameplay_audit_repair.test.ts server/tests/gameplay_foundation.test.ts tests/reaction_race_condition.test.ts tests/core_loop.test.ts tests/room_connection.test.ts`
- `npm.cmd test -- --runInBand --forceExit tests/I18nCoverage.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/LoginSceneI18nGuard.test.ts`

Acceptance M16:
- flow Monster coerente client/server senza drag ambiguo.
- `protect` e `discount_cost` applicati davvero nel loop di gioco.
- nessuna corruzione tipo su `steal_played_card`.
- Item non consumati se l'equip non può essere risolto.
- cleanup leave/disconnect robusto in `PLAYER_TURN` e `REACTION_WINDOW`.
- `DICE_ROLLED` utile e leggibile lato client.
- test gameplay principali verdi.

## M17 - Localizzazione Completa + Responsive Hardening + Artwork Mapping Finale
Stato: `completata`

Output:
- audit i18n completo:
  - `docs/I18N_AUDIT.md`
- mapping artwork definitivo:
  - `docs/ARTWORK_MAPPING.md`
  - stub aggiornato `docs/artworks/MAPPING.md`
- localizzazione mock match centralizzata su i18n:
  - `client/src/qa/MockMatchState.ts`
  - chiavi `qa_mock_*` in `client/src/i18n.ts`
- hardening responsive match (portrait + landscape basso):
  - `client/src/ui/layout/MatchLayout.ts`
  - `client/src/scenes/GameScene.ts`
  - fix crowding crisis/company/hand + CTA crisi compatte + dock log compatto in portrait
- pipeline artwork canonica:
  - `client/public/cards/emp_01.png`
  - `client/public/cards/emp_07.png`
  - resolver con manifest reale (`client/src/ui/CardArtworkResolver.ts`)
  - alias legacy non necessari rimossi (`client/src/ui/cards/ArtworkCatalog.ts`)
- QA automation aggiornata per IT/EN:
  - `client/qa/capture-responsive.mjs` (home IT/EN)
  - `client/qa/capture-match.mjs` (home + mock, IT/EN)
- test aggiunti/estesi:
  - `tests/MockMatchStateI18n.test.ts`
  - aggiornato `tests/I18nCoverage.test.ts`

Comandi verifica M17:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/I18nCoverage.test.ts tests/CardTextCatalog.test.ts tests/MockMatchStateI18n.test.ts tests/CardPresentationModel.test.ts tests/ArtworkCatalog.test.ts tests/TextFitModel.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `cd client && npm.cmd run art:check`
- `cd client && npm.cmd run qa:capture:match`
- `cd client && npm.cmd run qa:capture:responsive` (best effort: in questo ambiente fallisce con `spawn EPERM`)

Acceptance M17:
- contenuti carte `name/shortDesc/description` coperti in IT/EN via catalogo condiviso.
- mock match coerente con lingua selezionata.
- viewport obbligatori coperti in IT/EN via `qa:capture:match`.
- overlap/overflow ridotti nelle aree toccate (crisis/company/hand/log/action panel).
- artwork reali del repo mappati in modo esplicito e documentato.

## M18 - Layout System Deterministico + Responsive Hardening Finale
Stato: `completata`

Output:
- nuovo contratto layout centralizzato:
  - `client/src/ui/layout/LayoutTokens.ts`
  - `client/src/ui/layout/InitialScreenLayout.ts`
  - `client/src/ui/layout/MatchLayout.ts` (riscritta a tier deterministici)
- brand/header unificato (Boot/Login/PreLobby):
  - `client/src/ui/Branding.ts`
  - `BootScene`, `LoginScene`, `PreLobbyScene`
- login/menu riallineato a blocchi verticali con spacing stabile:
  - `client/src/scenes/LoginScene.ts`
- match layout con schema diverso tra portrait e landscape basso (`C`):
  - portrait stack top/board/controls/hand
  - landscape basso a due colonne board + sidebar
  - `GameScene` allineata ai rettangoli del nuovo layout manager
- mini-card e inspect refine:
  - `client/src/gameobjects/CardGameObject.ts`
  - inspect con panel e artwork ratio-driven in limiti min/max
- button contract unico aggiornato:
  - `client/src/ui/SimpleButtonFx.ts` (hover/press scale+timing, min hit target)
- documentazione layout:
  - `docs/ui/LAYOUT_SPEC.md`

Comandi verifica M18:
- `cd server && npm.cmd run build`
- `cd client && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/ButtonFxContract.test.ts tests/LoginSceneI18nGuard.test.ts tests/MatchUiPresenter.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/TextFitModel.test.ts tests/I18nCoverage.test.ts tests/MockMatchStateI18n.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `cd client && npm.cmd run qa:capture:match`
- `cd client && npm.cmd run qa:capture:responsive` (best effort: in questo ambiente fallisce con `spawn EPERM`)

Acceptance M18:
- tier A/B/C/D/E applicati in modo esplicito.
- safe area applicata a schermate iniziali e match.
- Boot/Login/PreLobby con stessa scala tipografica brand per tier.
- login meno densa e con blocchi separati lingua/modalita/input/cta.
- match con layout coerente e differenziato in landscape basso.
- bottoni principali allineati allo stesso contratto interattivo.

## M19 - Reconnect E2E + Flow QA Deterministico
Stato: `completata`

Output:
- reconnect client robusto in `ServerManager`:
  - persistenza contesto locale (`roomId`, `sessionId`, `reconnectToken`, `ceoName`, `roomCode`)
  - retry backoff (`0.5s, 1s, 2s, 3s, 5s`) entro finestra max 25s lato client
  - fallback pulito a login se timeout
- overlay reconnect in `GameScene`:
  - stato tentativi/tempo residuo
  - blocco input azioni durante reconnect
  - ripristino UI automatico su successo
- `LoginScene` supporta messaggio di ritorno da reconnect fallito
- documento flow E2E: `docs/QA_FLOW.md`
- test unitario reconnect policy: `tests/ReconnectPolicy.test.ts`

Comandi verifica M19:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit tests/ReconnectPolicy.test.ts tests/MockMatchState.test.ts tests/MatchActionState.test.ts tests/PendingPlayModel.test.ts tests/DeckManager.test.ts tests/CardEffectParser.test.ts server/tests/core_loop.test.ts server/tests/reaction_stress.test.ts server/tests/win_conditions.test.ts`
- `cd client && npm.cmd run qa:capture:match`

Acceptance M19:
- reconnect entro 30s gestito senza reset partita
- timeout reconnect porta a login con messaggio chiaro
- nessuna azione gameplay inviata durante reconnect
- flow QA documentato e ripetibile (`docs/QA_FLOW.md`)

## M20 - QA Initial/Match Deterministica + Lang Query Hardening
Stato: `completata`

Output:
- lingua da query (`?lang=it|en`) applicata a Boot/Login/PreLobby/Game
- selezione scena QA iniziale:
  - `?qaScreen=boot`
  - `?qaScreen=login`
  - `?qaScreen=prelobby&qaPreLobby=1` (mock prelobby senza server)
- estensione match QA:
  - `?qaMatch=1&qaInspect=1`
  - `?qaMatch=1&qaHelp=1`
- script `qa:capture:match` e `qa:capture:responsive` aggiornati con:
  - target initial + match/mock/overlay
  - assert automatici viewport/safe-area su canvas + input DOM
  - summary JSON con `layoutIssues`, `consoleErrors`, `pageErrors`
- safe-area root CSS allineata ai tier (A/B/C/D/E) in `client/index.html`

Comandi verifica M20:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit`
- `cd client && npm.cmd run art:check`
- `cd client && npm.cmd run qa:capture:match` (best effort: in questo ambiente fallisce per `spawn EPERM`)
- `cd client && npm.cmd run qa:capture:responsive` (best effort: in questo ambiente fallisce per `spawn EPERM`)

Acceptance M20:
- QA ripetibile su initial screens e match/mock con URL deterministiche.
- IT/EN verificabili via query senza dipendere solo da localStorage.
- assert automatici disponibili per overflow/safe-area lato DOM.
- nessuna regressione build/test nel codice toccato.

## M21 - Landscape/UI Stability Hardening + Button FX Drift Fix
Stato: `completata`

Output:
- `SimpleButtonFx` aggiornato con filtro anti-drift:
  - scala applicata solo a target con centro coerente con la hit area
  - fallback alpha-only per target con bounds assoluti (es. `Graphics` non centrati)
- `GameScene` landscape low (`tier C`) alleggerita:
  - top meta ridotta in top bar (evita crowding)
  - log compatto ancorato alla sidebar `log` invece che alla board
  - font min in compact landscape alzati nelle aree critiche (`action panel`, `log`)
- reconnect overlay:
  - priorita al DOM overlay (`#ui-root`) evitando doppio pannello canvas+dom
- test contrattuali layout aggiunti:
  - `tests/LayoutContracts.test.ts` (tier/safe area/header/layout bounds)

Comandi verifica M21:
- `cd client && npm.cmd run build`
- `cd server && npm.cmd run build`
- `npm.cmd test -- --runInBand --forceExit`
- `cd client && npm.cmd run art:check`
- `cd client && npm.cmd run qa:capture:responsive` (best effort: in questo ambiente fallisce per `spawn EPERM`)
- `cd client && npm.cmd run qa:capture:match` (best effort: in questo ambiente ha timeout headless)

Acceptance M21:
- animazioni bottoni stabili anche su `Graphics` in coordinate assolute.
- landscape basso con minore overlap tra board/log/topbar.
- no regressioni su build e suite test complete.
- verifica QA automatica documentata con limiti noti ambiente sandbox.
