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
