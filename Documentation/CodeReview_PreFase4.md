# Code Review Pre-Fase4 (Storico)

Data originale review: 2026-03-04  
Aggiornamento stato: 2026-03-04

Questo file e storico.  
Per stato reale usare:
- `CodexGPT.md`
- `Documentation/Phase_Status_Agente0.md`

## Stato sintetico dei rilievi storici
- Risolti:
  - allineamento stack reaction (`resolveQueue`)
  - uso `targetCardId` come `templateId` nel flusso reazioni
  - gestione `pending_draw_X` consumata lato server
- Ancora aperti/parziali:
  - `onCreate(_options: any)` in `OfficeRoom.ts` (tipizzazione migliorabile)
  - uso di `ICardEffect` alias legacy in `CardEffectParser.ts` (funziona, ma meno rigoroso)
  - cast `any` residui in zone server/schema interop

## Nota
I rilievi storici non devono essere usati come checklist definitiva:
il codice e cambiato in modo sostanziale dopo Fase 4.
