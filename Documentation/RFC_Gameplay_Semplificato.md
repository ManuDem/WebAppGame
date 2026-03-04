# RFC Gameplay Semplificato

Data: 2026-03-04  
Owner: Agente 0 (Tech Lead)

## Obiettivo
Rendere il core loop giocabile e leggibile su mobile, mantenendo il feeling "Here to Slay" ma con regole piu semplici e un lessico carta coerente.

## Tassonomia Carta (Unica)
- `EMPLOYEE` (`employee`): dipendenti della company.
- `IMPREVISTO` (`crisis`): sfide centrali da affrontare.
- `OGGETTO` (`item`): equipaggiabili ai dipendenti.
- `EVENTO` (`event`): one-shot (spell/challenge/debuff/reaction).

## Compatibilita Legacy
- Alias permessi in enum:
  - `MAGIC` -> `EVENTO`
  - `REACTION` -> `EVENTO`
  - `CRISIS` -> `IMPREVISTO`
- Il runtime deve convergere ai 4 tipi canonici per UI e logica.

## Sottotipi
Campo opzionale `subtype`:
- `none`, `spell`, `challenge`, `debuff`, `reaction`, `equipment`

Uso:
- `EVENTO` usa `spell/challenge/debuff/reaction`.
- `OGGETTO` usa `equipment`.

## Dadi (Server Authoritative)
- Lato server decide sempre il risultato.
- Lato client solo visualizza payload `DICE_ROLLED`.
- Campi carta usati:
  - `targetRoll` (soglia successo)
  - `modifier` (bonus/malus)

## Regole Core
- Giocatori: 2-10.
- Mano iniziale: 3 carte.
- AP turno: 3.
- Draw costa 1 AP.
- Reazione: finestra 5000ms.
- Vittoria semplificata:
  - 4 dipendenti in company, oppure
  - 2 imprevisti risolti.

## UX Gameplay
- Carte sul tavolo e in mano in versione compact:
  - colore tipologia + simbolo + titolo breve + costo.
- Tap su carta apre dettaglio fullscreen:
  - top: artwork placeholder
  - bottom: testo effetto / target roll / modifier

## Vincoli
- Niente RNG client.
- Niente validazioni gameplay client-side decisive.
- Niente nuove animazioni rumorose non funzionali.
