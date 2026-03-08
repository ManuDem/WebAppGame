# Layout Spec (Menu + Match)

Data aggiornamento: 2026-03-06

## Tier e Safe Area

### Tier
- `A`: phone portrait small (`width <= 390`)
- `B`: phone portrait large (`391..430`)
- `C`: landscape low height (`height <= 430` e `width >= 720`)
- `D`: tablet portrait (`width 431..900` e `height >= width`)
- `E`: altri casi

### Safe Area
- `A/B`: `12/12/12/12`
- `C`: `top 8, right 10, bottom 8, left 10`
- `D/E`: `16/16/16/16`

## Header Brand (Boot/Login/PreLobby)
Fonte: `client/src/ui/layout/InitialScreenLayout.ts`

Valori per tier:
- `A`: title `52`, subtitle `17`, titleY `72`, subtitleY `112`, bottomY `142`
- `B`: title `56`, subtitle `18`, titleY `76`, subtitleY `118`, bottomY `148`
- `C`: title `40`, subtitle `14`, titleY `56`, subtitleY `84`, bottomY `108`
- `D`: title `66`, subtitle `20`, titleY `82`, subtitleY `124`, bottomY `156`
- `E`: title `74`, subtitle `21`, titleY `80`, subtitleY `122`, bottomY `156`

## Match Layout Contract
Fonte: `client/src/ui/layout/MatchLayout.ts`

### Top Bar Height
- `A`: `84`
- `B`: `90`
- `C`: `58`
- `D`: `68`
- `E`: `72`

### Portrait (`A/B`)
Stack verticale:
1. top bar
2. board
3. controls
4. hand

Target principali:
- `A`: controls target `74`, hand target `172`
- `B`: controls target `80`, hand target `184`

### Landscape (`C/D/E`)
- main block centrato
- split board + sidebar
- sidebar stack: `HUD -> controls -> log -> hand`

Target principali sidebar:
- `C`: hud `72`, controls `98`, log `98`, hand min `112`
- `D`: hud `84`, controls `118`, log `116`, hand min `136`
- `E`: hud `88`, controls `124`, log `126`, hand min `148`

## Card Contract (corrente)

Mini-card size target:
- `A`: hand `98x138`, board `92x128`
- `B`: hand `102x144`, board `96x134`
- `C`: hand `88x124`, board `88x124`
- `D/E`: hand `110x154`, board `100x140`

Regole:
- titolo e metadati sintetici
- informazioni estese solo in inspect overlay
- playable visual state esplicito in mano

## Button Contract
Fonte: `LayoutTokens` + `SimpleButtonFx`

- Primary height: `A/B 48`, `C 42`, `D/E 46`
- Secondary height: `A/B 40`, `C 36`, `D/E 38`
- Min hit target: `44x44`

## QA Obbligatoria
Viewport:
- `360x640`, `390x844`, `414x896`, `768x1024`
- `844x390`, `896x414`, `1024x768`, `1366x768`

Blocchi release:
- no overlap
- no overflow
- no bottoni irraggiungibili
- no input incoerenti con overlay attivo
