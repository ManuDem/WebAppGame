# RFC Gameplay Semplificato (v2 Here-to-Slay Lite)

Data: 2026-03-04  
Owner: Agente 0 (Tech Lead)

## Obiettivo
Portare LUCrAre: SEMPRE verso una versione semplificata e leggibile di Here to Slay, mantenendo dadi e bluff ma riducendo la complessita operativa su mobile.

## Tassonomia Ufficiale Carte

### Main Deck (5 tipi)
- `HERO`: equivalente agli Impiegati (core della tua squadra)
- `ITEM`: equip ai tuoi Hero o, se maledetto, ai Hero avversari
- `MAGIC`: effetto one-shot immediato
- `MODIFIER`: +X/-X su un tiro di dado (tuo o avversario)
- `CHALLENGE`: risposta istantanea a HERO/ITEM/MAGIC altrui

### Fuori Main Deck (2 categorie)
- `MONSTER`: 3 carte attive sul tavolo da sconfiggere (ex Imprevisti)
- `PARTY_LEADER`: leader personale con passiva sempre attiva

## Setup Partita
1. Ogni player sceglie o riceve 1 `PARTY_LEADER`.
2. Si scoprono 3 `MONSTER` al centro tavolo.
3. Ogni player pesca 3 carte dal main deck.
4. Start solo con 2-10 player connessi e ready (pre-lobby obbligatoria).

## Turno Semplificato (3 AP)
Con 3 AP il player puo, in qualsiasi ordine:
- giocare 1 HERO (costo AP carta)
- giocare 1 ITEM su un HERO valido
- giocare 1 MAGIC
- attaccare 1 MONSTER (costo AP fisso)
- pescare 1 carta (costo AP)

## Dadi e Rischio
- Base: 2d6 server-authoritative.
- `MODIFIER` si applicano dopo il roll, in finestra reazione breve.
- Risoluzione MONSTER:
  - `total >= targetRoll` => Monster sconfitto, premio
  - `total < targetRoll` => fail, penalita (scarto/perdita hero/blocco)

## Challenge Window
- Quando un player gioca HERO/ITEM/MAGIC, gli altri possono usare `CHALLENGE`.
- Se il challenge vince: carta annullata e scartata.
- Se il challenge perde: azione originale procede.

## Condizioni Vittoria Lite
- Win A: sconfiggi 2 MONSTER
- Win B: controlli 4 HERO vivi in board

## UX Mobile-First obbligatoria
- Carte tavolo e mano in formato compact (simbolo + costo + nome corto)
- Tap su carta => vista fullscreen:
  - top: artwork
  - bottom: testo effetto, target roll, modificatori
- Zero overlap testo/interattivi in portrait/landscape

## Stato Implementazione (oggi)
- Gia allineato:
  - pre-lobby readyness host/start
  - 2d6 server-side + broadcast `DICE_ROLLED`
  - fullscreen inspect con artwork area + testo esteso carta
  - `CardType` shared migrato a modello 5+2 (con alias legacy)
  - `cards_db.json` migrato a HERO/ITEM/MAGIC/MODIFIER/CHALLENGE + MONSTER/PARTY_LEADER
  - assegnazione `PARTY_LEADER` in setup server
  - `MODIFIER` supportati nel parser con tag one-shot `next_roll_mod_X`
- Da rifinire:
  - UX target selection: evitare overlay bersaglio su carte che non richiedono target
  - equip `ITEM` su singoli Hero (attualmente effetto applicato via tag player-level)
  - cleanup log server e test async open handles
