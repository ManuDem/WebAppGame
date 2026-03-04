# Card UI Spec (Contratto)

## Mini-card (mano / tavolo)
- Artwork in alto (dominante).
- Titolo carta (1 riga max, ellipsis se lungo).
- Riga tipo/sottotipo (1 riga max, ellipsis).
- Info strip breve (max 2 righe, no paragrafi).
- Footer sintetico (tipo + valori chiave).
- Vietato mostrare informazioni debug/non utili (es. template id).

## Full-card (inspect overlay)
- Artwork grande in alto.
- Titolo leggibile (max 2 righe).
- Tipo + metadati principali (costo AP, ecc.) senza debug id.
- Descrizione completa + note contestuali.
- Chiusura affidabile (`X` + tap esterno).

## Regole anti-overflow
- Nessun testo deve uscire dal box.
- Nessun testo deve sovrapporsi a badge/icone.
- Se non entra: ellipsis in mini-card, dettaglio nella full-card.
- Utility condivisa: `fitTextToBox(...)`.
