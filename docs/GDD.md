# GDD - Here to Slay Lite (Implementazione Corrente)

Data aggiornamento: 2026-03-06

## Visione
LUCrAre: SEMPRE e un multiplayer web server-authoritative ispirato a Here to Slay, in variante "Lite" orientata a leggibilita mobile e robustezza di stato.

## Regole implementate (as-is)
- Match: `2-10` giocatori
- Mano iniziale: `3` carte
- AP per turno: `3`
- Draw costa `1` AP
- Reaction window: `5000 ms`
- Deck runtime: `24` carte template

Tassonomia carte (5+2):
- Main deck: `Hero`, `Item`, `Magic`, `Modifier`, `Challenge`
- Setup: `Monster`, `Party Leader`

Vittoria:
- `4` Hero in company (con moltiplicatore eventualmente applicato)
- oppure `2` Monster risolti (VP)

## Flusso turno
1. Draw / Play Hero / Play Magic-Item / Attack Monster / End Turn
2. Trigger eventuale reaction window
3. Risoluzione server-authoritative
4. Aggiornamento client con feedback log + HUD

## Vincoli UX di prodotto
- CTA Monster esplicita (`ATTACCA`), niente attacco via drop ambiguo.
- Overlay informativi e di targeting con priorita alta e input blocking.
- Focus assoluto su usabilita phone portrait + landscape basso.

## Gap rispetto a Here to Slay completo
Questi punti sono intenzionalmente fuori dal core attuale o parziali:
1. Condizione vittoria per classi complete non implementata (si usa win lite 4 Hero/2 Monster).
2. Card pool ridotto (24 template), non equivalente al set completo del board game.
3. Effetti carta coprono un sottoinsieme controllato del design originale.
4. Party Leader e class identity semplificate rispetto al gioco completo.
5. Espansioni/varianti avanzate non incluse.

## Direzione roadmap
Priorita immediata non e aggiungere nuove meccaniche, ma:
1. chiudere bug grafici/funzionali di partita,
2. stabilizzare layout mobile,
3. consolidare copertura test anti-regressione UI.
