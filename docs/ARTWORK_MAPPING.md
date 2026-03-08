# Artwork Mapping Runtime

Data aggiornamento: 2026-03-06

## Regola runtime
- Texture cercata in `client/public/cards/<templateId>.png`
- Se assente: fallback grafico procedurale (nessun crash)

## Stato attuale
- Template runtime: `24`
- Copertura file runtime: `24/24`
- Alcuni asset sono placeholder tecnici e richiedono quality pass artistico

## Convenzione
- Nome file: esattamente `templateId` + `.png`
- Evitare alias multipli non necessari

## Verifica
- `cd client && npm run art:check`
- build client deve restare verde dopo ogni update asset
