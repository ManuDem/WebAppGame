# Card Artwork PNG

Metti qui gli artwork delle carte e nomina i file come:
- `<templateId>.png`

Esempi validi:
- `emp_01.png`
- `trk_03.png`
- `crs_02.png`

Prefissi template usati nel progetto:
- `emp_` (Hero/Employee)
- `trk_` (Magic/Event)
- `crs_` (Monster/Imprevisto)
- `rea_` (Challenge/Reaction)
- `itm_` (Item)
- `mod_` (Modifier)
- `ldr_` (Party Leader)

Risoluzione runtime:
1. il client usa `card.templateId`
2. prova a caricare `/cards/<templateId>.png`
3. se il file manca, usa il fallback procedurale

Pipeline consigliata:
- usa `artworks/` come sorgente grezza
- copia/rinomina in `client/public/cards/<templateId>.png`
- evita alias runtime quando possibile (piu robusto per QA e build)
