# Artwork Mapping Finale

Data aggiornamento: 2026-03-05

## Regola runtime
- Il resolver usa `card.templateId`.
- Path canonico: `/cards/<templateId>.png`.
- Se il file manca: fallback procedurale (nessun crash).

## Asset sorgente trovati in `artworks/`

| File sorgente | Template assegnato | Stato | Note |
|---|---|---|---|
| `hero_luca.png` | `emp_01` | assegnato | Copiato in `client/public/cards/emp_01.png`. |
| `hero_marco.png` | `emp_07` | assegnato | Copiato in `client/public/cards/emp_07.png`. |

## Copertura template carte (`shared/cards_db.json`)

| Template | Stato artwork |
|---|---|
| `emp_01` | assegnato (`emp_01.png`) |
| `emp_02` | mancante |
| `emp_03` | mancante |
| `emp_04` | mancante |
| `emp_05` | mancante |
| `trk_01` | mancante |
| `trk_02` | mancante |
| `trk_03` | mancante |
| `trk_04` | mancante |
| `crs_01` | mancante |
| `crs_02` | mancante |
| `crs_03` | mancante |
| `rea_01` | mancante |
| `rea_02` | mancante |
| `rea_03` | mancante |
| `emp_06` | mancante |
| `trk_05` | mancante |
| `emp_07` | assegnato (`emp_07.png`) |
| `itm_01` | mancante |
| `itm_02` | mancante |
| `mod_01` | mancante |
| `mod_02` | mancante |
| `ldr_01` | mancante |
| `ldr_02` | mancante |

## Naming consigliato (obbligatorio per nuovi asset)
- Salvare sempre in `client/public/cards/`.
- Nome file: `<templateId>.png`.
- Evitare alias runtime quando possibile.

## Verifica automatica
- Comando: `cd client && npm run art:check`
- Report:
  - artwork mancanti per template
  - file extra non mappati
  - file sorgente `artworks/` non ancora risolti
