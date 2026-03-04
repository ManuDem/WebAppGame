# GDD - LUCrAre: SEMPRE

Documento di design operativo (template iniziale).  
Nota: in questa milestone non vengono cambiate regole nel codice, solo documentazione.

## 1. Scope

- Obiettivo: mantenere il core loop Here To Slay semplificato.
- Vincoli:
  - multiplayer web, mobile-first
  - server authoritative
  - reaction window + dadi mantenuti

## 2. As-Is Dal Codice (stato implementato)

Riferimenti:
- `server/src/rooms/OfficeRoom.ts`
- `shared/SharedTypes.ts`
- `shared/cards_db.json`

### Setup e lobby

- Match: 2-10 giocatori
- Host crea stanza con codice 4 cifre
- Join con codice + nome CEO
- Start solo host e solo con giocatori connessi/ready

### Turno

- 3 AP per turno
- pescare carta costa 1 AP
- mano iniziale 3 carte

### Carte e categorie

- Main deck: Hero, Item, Magic, Modifier, Challenge
- Setup: Monster, Party Leader

### Reazioni

- Finestra reazione: 5000 ms
- Risoluzione stack: LIFO
- Challenge/Modifier giocati in reaction window

### Dadi e crisi/monster

- Risoluzione crisi server-authoritative
- Tiro 2d6 + modificatori

### Win condition

- 4 Hero in company
- oppure 2 Monster risolti

## 3. Variante Semplificata Scelta (struttura)

Decisioni approvate:
- A) Challenge/Modifier reaction-only, Magic attiva
- B) Item equip su Hero specifico (fallback player-level temporaneo)
- C) Refill immediato monster per mantenere 3 in tavola

Scelta finale prevista (max 1 variante):
- [TODO] descrivere in modo definitivo una sola variante semplificata da applicare in milestone gameplay.

### 3.1 Pillars (placeholder)

- [TODO] definire principi UX/gameplay in 5 punti

### 3.2 Turn flow target (placeholder)

- [TODO] dettagliare sequenza standard turno (AP, azioni, limiti)

### 3.3 Card interactions (placeholder)

- [TODO] Hero/Item/Magic/Modifier/Challenge/Monster/Leader: regole sintetiche definitive

### 3.4 UI/feedback target (placeholder)

- [TODO] regole di presentazione carte mini/fullscreen e feedback tap

## 4. Rischi Bilanciamento (placeholder)

- [TODO] rischio snowball da hero stacking
- [TODO] rischio lock da chain reaction
- [TODO] rischio eccesso RNG sui monster

## 5. Piano Test Bilanciamento (placeholder)

- [TODO] smoke simulazioni rapide 2/3/4 player
- [TODO] metriche minime (durata match, numero turni medi, win route)

## 6. Decision Log

- 2026-03-04: fissate le decisioni bloccanti A/B/C (solo documentazione, nessun cambio codice).
- [TODO] aggiungere qui le future decisioni di design approvate.
