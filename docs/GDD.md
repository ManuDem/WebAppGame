# GDD - LUCrAre: SEMPRE (M1 + M2)

Documento di design operativo aggiornato al codice attuale (server authoritative Colyseus).

## 1. As-is dal codice (implementato oggi)

Riferimenti principali:
- `server/src/rooms/OfficeRoom.ts`
- `server/src/game/*`
- `shared/SharedTypes.ts`
- `shared/cards_db.json`

### 1.1 Setup, lobby e avvio
- Stanza con codice a 4 cifre.
- Accesso con nome CEO (3-15 alfanumerico).
- Partita avviabile da host con almeno 2 giocatori connessi e pronti.
- Mano iniziale: 3 carte.
- AP di turno: 3.

### 1.2 Core loop turno
- Fase standard: `PLAYER_TURN`.
- Azioni che consumano AP validate lato server.
- `DRAW_CARD` costa 1 AP e pesca dal deck server-side.
- Fine turno con passaggio al prossimo giocatore connesso.

### 1.3 Modello carte (5+2)
- Main deck: `Hero`, `Item`, `Magic`, `Modifier`, `Challenge`.
- Setup/board: `Monster`, `Party Leader`.

### 1.4 Reaction window e risoluzione
- Azioni con finestra reazione: assunzione Hero, risoluzione Monster, Magic.
- `REACTION_WINDOW` di 5000 ms.
- Risoluzione coda via `CardEffectParser.resolveQueue` + mutazioni strutturali server.
- `Challenge`/`Modifier` sono giocabili solo in reaction window.

### 1.5 Monster flow
- Board Monster mantiene 3 slot (refill immediato dopo risoluzione riuscita).
- Tiro crisi: 2d6 + modificatori.
- Successo: rimozione Monster + reward VP.
- Fallimento: applicazione penalty.

### 1.6 Win conditions
- Vittoria con 4 Hero in company (conteggio pesato con `win_multiplier_X`).
- Oppure vittoria con 2 VP da Monster risolti.

## 2. Variante semplificata scelta (finale)

Obiettivo: mantenere feeling Here To Slay ma con regole più leggibili e robuste lato multiplayer.

### 2.1 Decisioni approvate e applicate
- A) `Challenge` e `Modifier` restano **reaction-only**; `Magic` resta azione attiva.
- B) `Item` equipaggiato su **Hero specifico**; fallback player-level solo temporaneo (compatibilità client/dati).
- C) Board Monster sempre a 3 con refill immediato.

### 2.2 Loop semplificato target
- Turno di un giocatore: 3 AP.
- Azioni principali: pescare, giocare Hero, giocare Magic/Item, tentare Monster, chiudere turno.
- Reazioni solo nella finestra dedicata, con risoluzione deterministica server.

### 2.3 Regole Item semplificate
- Item giocato come azione di turno.
- Target primario: Hero del proprietario.
- Equip persistente sull'Hero (`equippedItems`) per modificatori passivi ai tiri.
- Fallback temporaneo mantenuto per compatibilità quando il target Hero non è esplicito.

## 3. Impatto tecnico della variante sui file

### 3.1 Nuovi moduli gameplay (testabilità)
- `server/src/game/turnFlow.ts`
  - validazione/spesa AP
  - calcolo prossimo turno connesso
- `server/src/game/winConditions.ts`
  - calcolo conteggio Hero pesato
  - valutazione vittoria
- `server/src/game/monsterBoard.ts`
  - bag Monster
  - draw template Monster
  - roll 2d6 + modifier
- `server/src/game/reactionResolution.ts`
  - orchestrazione resolve queue
  - consumo tag `pending_draw_X`
- `server/src/game/itemEquip.ts`
  - risoluzione target Hero per equip
  - creazione item equipaggiato

### 3.2 Refactor orchestrazione room
- `server/src/rooms/OfficeRoom.ts`
  - mantiene responsabilità networking/orchestrazione
  - delega logica core ai moduli `server/src/game/*`
  - applica A/B/C in modo server-authoritative

### 3.3 Contratti condivisi aggiornati
- `shared/SharedTypes.ts`
  - aggiunto `targetHeroCardId` su `IPlayMagicPayload` e `IPendingAction`
- `server/src/State.ts`
  - aggiunto `targetHeroCardId` in `PendingActionState`

### 3.4 Surfacing client minimo
- `client/src/network/ServerManager.ts`
  - `playMagic(cardId, targetPlayerId?, targetHeroCardId?)`
- `client/src/scenes/GameScene.ts`
  - selettore target differenziato per Item (selezione Hero)
  - blocco implicito play fuori finestra per reaction cards
- `client/src/i18n.ts`
  - nuove stringhe per selezione Hero e errori Item target

## 4. Rischi e follow-up (fuori scope M1+M2)

- Bilanciamento Item: alcune effect DSL restano ancora player-level e non hero-scoped puro.
- UX completa carte/overlay/pixel-art resta in milestone successive.
- Legacy suite failing non incluse nella smoke stabile restano da trattare in milestone QA finale.

## 5. Decision log

- 2026-03-04: approvate A/B/C.
- 2026-03-04: M1+M2 implementate in server gameplay modules + test dedicati.

## 6. Aggiornamento user-facing M3/M4 (2026-03-04)

- Le carte nel client ora supportano artwork PNG reale tramite chiave esplicita (`artworkKey`/`artworkId`/`artKey`) oppure `templateId`.
- Pipeline robusta con fallback: se il PNG non esiste, resta attivo l'artwork procedurale senza bloccare il gameplay.
- Le mini-card privilegiano testo breve (`shortDesc` quando disponibile) per ridurre rumore visivo.
- Overlay inspect carta usa artwork reale quando disponibile e mostra in modo completo:
  - tipo/template
  - descrizione
  - target roll/modifier/subtype
  - numero item equipaggiati sul Hero
- UX targeting item completata lato client:
  - 0 Hero validi: feedback esplicito e azione annullata
  - 1 Hero valido: auto-target
  - N Hero validi: selettore esplicito
- Il payload carta espone anche `shortDesc` opzionale per supportare UI compatta in modo retrocompatibile.
