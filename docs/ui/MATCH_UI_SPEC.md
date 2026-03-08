# MATCH UI SPEC

Data aggiornamento: 2026-03-06

## Obiettivo
Rendere la partita leggibile e usabile in mobile-first eliminando overlap e ambiguita di input.

## Aree principali
1. Top meta
2. Board
3. Controls
4. Hand
5. Log
6. Overlay layer (help/inspect/selector/reconnect)

## Regole bloccanti
1. Nessuna azione gameplay con modal overlay aperto.
2. Overlay chiudibili in modo coerente (tap esterno, bottone, ESC dove previsto).
3. Layout mai fuori safe area.
4. In tier compatti, ridurre contenuto secondario prima di ridurre leggibilita critica.

## Match DOM shell
- HUD/controls/log principali sono renderizzati in DOM shell (`MatchUiDom`) per stabilita responsive.
- Canvas mantiene board e carte, riducendo crowding testo.

## Input safety
- Guard centrale: stato modal aperto blocca draw/end/attack/emote e drag carta.
- Target selector ha priorita visuale e input blocking.
- Reconnect blocca interazioni gameplay.

## Feedback richiesto
- Azione bloccata -> motivo esplicito
- Dice roll -> dettaglio leggibile
- Log persistente consultabile

## Portrait/Landscape
- Portrait: stack verticale con hand leggibile.
- Landscape basso: board + sidebar; log separato dalla board per evitare collisioni.

## Criterio di accettazione
La schermata deve restare giocabile su telefono senza zoom o workaround manuali.
