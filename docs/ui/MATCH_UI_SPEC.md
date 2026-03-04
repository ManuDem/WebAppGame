# MATCH UI SPEC

Data: 2026-03-04  
Milestone: Match Readability + Live HUD + Anti-Overlap

## 1) Obiettivo
Rendere la schermata partita leggibile e stabile su mobile-first:
- HUD live sempre visibile
- board chiara (monster/company/avversari)
- mano leggibile e toccabile
- log eventi persistente
- overlay sempre sopra tutto
- nessun overlap o overflow testo nelle sezioni toccate

## 2) Zone fisse della schermata
Le zone sono calcolate dal layout manager `client/src/ui/layout/MatchLayout.ts`.

Zone:
1. `top bar`
2. `board centrale`
3. `hand bottom`
4. `event feed` (all'interno della zona hand, collassabile/espandibile)
5. `overlay layer` (inspect carta, target selector, dice toast, reaction overlay)

Regola hard: le carte della mano usano solo l'area `handCards` (sotto al log) e non invadono la board.

## 3) Breakpoint minimi supportati
Layout verificato/targettizzato per:
- `360x640`
- `390x844`
- `414x896`
- `768x1024`
- `1366x768`

Nota: su landscape molto basso (`h < 520`) si attiva `compactLandscape`.

## 4) Contratto anti-overlap
Regole obbligatorie:
- mai testo sopra testo
- mai testo fuori contenitore
- mai testo fuori panel/card/toolbar
- touch target minimo `44px` (bottoni/toggle/selettori)
- overlay sempre in depth superiore alle zone base
- hand non deve rompere la board

Strategia applicata:
- wrapping esplicito per HUD/log/inspect
- riduzione gerarchica delle info su viewport compatti
- aumento spazi verticali in landscape compatto
- log collassabile per liberare area mano
- indicatori sintetici su row avversari

## 5) Layering
Ordine logico:
1. background
2. pannelli base (top/board/bottom)
3. elementi interattivi partita (carte, bottoni)
4. HUD + game log
5. overlay inspect/target/reaction/dice
6. debug overlay (solo `uiDebug=1`)

## 6) Debug mode layout
Modalita debug:
- query param: `?uiDebug=1`
- oppure `localStorage.setItem('lucrare_ui_debug', '1')`

Visualizza:
- rettangoli di zone principali (`content`, `topBar`, `board`, `hand`, `log`, `handCards`)
- bounding box principali testi HUD/log/turn

Uso:
- individuare overlap/overflow velocemente durante resize/orientation.

## 7) Event feed persistente
Il feed mostra eventi recenti e mantiene memoria visiva partita:
- errori
- reaction
- action resolved/fail
- card drawn
- turn started
- dice rolled
- game won

Comportamento:
- limite righe in memoria: 28
- toggle `ESPANDI/RIDUCI`
- in modalita ridotta mostra ultima riga

## 8) HUD live
Info minime persistenti:
- turno corrente
- AP giocatore locale
- VP locale
- deck count
- discard stimato client-side
- hand/company/equip count
- stato phase
- stato reaction window
- score sintetico avversari (top 3)

## 9) Dadi / feedback risoluzione
Quando arriva `ServerEvents.DICE_ROLLED`:
- toast strutturato in overlay
- append nel game log
- testo esito (`SUCCESSO/FALLITO`)

Per crisis/monster:
- badge mini `ROLL X+` sopra la carta in board.

## 10) Vincoli testo e tipografia
- font UI non pixelato (nitidezza prioritaria)
- artwork/asset possono mantenere look pixel
- nessun ellipsis su informazioni critiche HUD/log
- ellipsis ammesso solo su nomi lunghi in contesto avversari
