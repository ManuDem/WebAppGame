# UX GUIDE - Onboarding e Chiarezza Partita

Data aggiornamento: 2026-03-04

## Obiettivo

Rendere la partita comprensibile anche per chi entra per la prima volta, senza dover intuire le regole dal comportamento del gioco.

## Onboarding in-app

### 1) Match screen
- Pulsante `?` nel pannello controlli.
- Apre modal `Come si gioca` con sezioni brevi:
  - Turno e PA
  - Pesca
  - Mostri
  - Reaction Window
  - Targeting

### 2) Pre-lobby
- Pulsante `?` anche in prelobby.
- Stessa logica di guida, utile prima dell'avvio.

## Clarity in partita

### Action panel
- Mostra stato sintetico:
  - cosa puoi fare ora
  - cosa è bloccato
  - perché è bloccato
- Include hint contestuale dinamico (turno, reaction, AP, deck, mostri).

### Mostri
- Slot visivo dedicato sotto ogni carta Mostro.
- CTA `ATTACCA` sempre esplicita.
- In caso di blocco, motivazione mostrata via hint/feedback.

### Reazioni
- Quando la reaction window è attiva, il contesto azione lo evidenzia.
- Il giocatore capisce che fuori da quella finestra le reaction non sono valide.

## Principi UI applicati
- mobile-first
- testo leggibile, senza sovrapposizioni
- feedback immediato per azioni rifiutate/consentite
- bottoni con stessa animazione base (`SimpleButtonFx`)
- gerarchia visiva semplice: stato -> azione -> dettaglio

## Note asset
- Artwork reale usato dove disponibile (`/client/public/cards` + alias catalogo).
- Fallback procedurale mantenuto per template senza PNG.

## Follow-up (non bloccanti)
- Ampliare la copertura artwork per tutti i template.
- Aggiungere onboarding progressivo step-by-step (opzionale) per il primo accesso.
