# Layout Spec (Menu + Match)

## Tier e Safe Area

### Tier
- `A` Phone Portrait Small: `width <= 390` e `height > width`
- `B` Phone Portrait Large: `391 <= width <= 430` e `height > width`
- `C` Landscape Low Height: `height <= 430` e `width >= 720`
- `D` Tablet Portrait: `431 <= width <= 900` e `height >= width`
- `E` Standard Landscape/Desktop: tutti gli altri casi

### Safe Area
- Portrait phone (`A/B`): top/right/bottom/left `12px`
- Landscape basso (`C`): top/bottom `8px`, left/right `10px`
- Tablet/Desktop (`D/E`): top/right/bottom/left `16px`

## Header Brand (Boot/Login/PreLobby)

Sorgente unica: `client/src/ui/Branding.ts` + `client/src/ui/layout/InitialScreenLayout.ts`.

### Valori obbligatori per tier
- `A`: title `52`, subtitle `17`, titleY `30`, subtitleY `68`, headerBottomY `94`
- `B`: title `56`, subtitle `18`, titleY `32`, subtitleY `72`, headerBottomY `98`
- `C`: title `40`, subtitle `14`, titleY `24`, subtitleY `54`, headerBottomY `74`
- `D`: title `66`, subtitle `20`, titleY `34`, subtitleY `76`, headerBottomY `104`
- `E`: title `74`, subtitle `21`, titleY `32`, subtitleY `76`, headerBottomY `106`

## Login/Menu Contract

Sorgente: `client/src/ui/layout/InitialScreenLayout.ts` + `LoginScene`.

Struttura verticale:
1. Header
2. Lingua
3. Modalita
4. Input panel
5. CTA primaria
6. CTA secondaria/back

### Misure principali
- `A`: panel `92vw` max `500`, padX `18`, padY `16`, sectionGap `14`, rowGap `10`, input `46`, primary `48`, segmented `40`
- `B`: panel `90vw` max `520`, padX `20`, padY `18`, sectionGap `16`, rowGap `12`, input `48`, primary `48`, segmented `40`
- `C`: panel `58vw` max `620`, maxH `300`, padX `18`, padY `14`, sectionGap `12`, rowGap `10`, input `40`, primary `42`, segmented `36`
- `D/E`: panel `min(62vw, 620)`, padX `22`, padY `18`, sectionGap `16`, rowGap `12`, input `46`, primary `46`, segmented `38`

## Match Layout Contract

Sorgente: `client/src/ui/layout/MatchLayout.ts`.

### Portrait (`A/B`)
Stack:
1. top bar
2. board
3. controls strip
4. hand
5. log dock compatto

Valori:
- `A`: top `78`, board `min(max(38vh,240),320)`, controls `64`, hand `142`, log chip max `220x32`
- `B`: top `84`, board `min(max(40vh,250),360)`, controls `68`, hand `150`, log chip max `240x34`

### Landscape basso (`C`)
Layout:
- top bar full width (`52`)
- area sotto top bar a due colonne:
  - board `64%`
  - sidebar `36%`
- sidebar stack:
  - HUD `54`
  - Action panel `70`
  - Log `64`
  - Hand restante (min `96`)

### `D/E`
- `D`: top `62`, board `66%`, sidebar `34`
- `E`: top `64`, board `68%`, sidebar `32`
- sidebar stack: HUD `64`, log `84`, action panel `82`, hand restante

## Card Contract

### Mini-card size target
- `A`: hand `82x116`, board `78x110`
- `B`: hand `84x118`, board `80x112`
- `C`: hand `70x98`, board `72x100`
- `D/E`: hand `90x126`, board `84x118`

Regole:
- titolo max 2 righe
- tipo/meta max 1 riga
- strip info max 1 riga
- niente testo tecnico (`templateId`) in UX standard

### Inspect/full-card
- Portrait: width `min(92vw, 420)`, maxH `88vh`
- Landscape: width `min(70vw, 760)`, maxH `88vh`
- artwork minH `150`, maxH `260`, ratio adattivo

## Button Contract (globale)

Sorgente: `client/src/ui/SimpleButtonFx.ts` + `LayoutTokens`.

- Primary height: `A/B 48`, `C 42`, `D/E 46`
- Secondary height: `A/B 40`, `C 36`, `D/E 38`
- Min hit target: `44x44`
- Hover scale: `1.015`
- Press scale: `0.985`
- Hover duration: `90ms`
- Press duration: `75ms`
- Press text alpha: `0.96`
- Mai tween su `x/y` o font size

## Text Rules

- UI min font: `A/B 12`, `C 11`, `D/E 12`
- Panel title:
  - `A/B 14-16`
  - `C 13-15`
  - `D/E 14-16`
- CTA:
  - `A/B 14`
  - `C 13`
  - `D/E 14-15`

Fallback ordine:
1. wrapping
2. ellipsis
3. riduzione contenuti secondari
4. dettaglio spostato in inspect/help
5. mai sotto i minimi

## Density Rules (compact/landscape basso)

- HUD max 2 righe
- Log max 2 item visibili
- Action panel: hint breve + detail breve
- no duplicazione della stessa informazione in piu pannelli

## QA Obbligatoria

Viewport:
- `360x640`
- `390x844`
- `414x896`
- `768x1024`
- `844x390`
- `896x414`
- `1024x768`
- `1366x768`

Lingue:
- IT
- EN

Check:
- no overlap testi
- no overflow testi
- no elementi fuori schermo
- no bottoni coperti
- schermate iniziali coerenti
- match leggibile (portrait + landscape basso)
