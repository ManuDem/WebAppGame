# UX GUIDE - Priorita Mobile Usabile

Data aggiornamento: 2026-03-06

## Obiettivo
Rendere la partita chiaramente giocabile da telefono in portrait e landscape basso, senza overlap e senza ambiguita di input.

## Principi non negoziabili
1. Leggibilita prima dell'estetica.
2. Azione disponibile/bloccata sempre esplicita.
3. Nessun elemento critico fuori safe area.
4. Overlay modal sempre dominanti e con chiusura affidabile.

## Onboarding minimo
- Help in PreLobby e Match.
- Pannello azioni con stato contestuale (turno/AP/fase/reaction).
- CTA Monster esplicita.

## Anti-overlap
- Top meta ridotto nei tier compatti.
- Sidebar in landscape basso con stack controllato (HUD -> controls -> log -> hand).
- Fit text forzato in aree sensibili (card, panel, log, opponent rows).

## Bug class da prevenire
- card stuck dopo play non valida
- click passanti sotto overlay
- bottoni non raggiungibili su schermi bassi
- testo troncato fuori contenitore senza fallback

## Regola di design operativo
Ogni scelta grafica deve essere verificata prima su viewport phone (`360x640` e `844x390`) e solo dopo su desktop.
