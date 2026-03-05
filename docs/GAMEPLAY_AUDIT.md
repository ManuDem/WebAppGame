# GAMEPLAY AUDIT - Stato Reale e Correzioni (M12)

Data: 2026-03-04

## 1) Baseline verificata (server authoritative)

Confermata nel codice:
- lobby con host + ready check;
- start con almeno 2 giocatori pronti;
- mano iniziale 3 carte;
- turno con 3 AP;
- pesca costo 1 AP;
- Hero con `PLAY_EMPLOYEE`;
- Magic/Item azioni attive;
- Challenge/Modifier reaction-only;
- Monster board a 3 slot con refill;
- risoluzione Monster con 2d6 + modificatori;
- win: 4 Hero (conteggio pesato) oppure 2 VP da Monster.

Riferimenti principali:
- `server/src/rooms/OfficeRoom.ts`
- `server/src/game/*`
- `shared/SharedTypes.ts`
- `shared/CardEffectParser.ts`
- `client/src/scenes/GameScene.ts`
- `client/src/network/ServerManager.ts`

## 2) Mismatch trovati nell'audit

### M1 - Monster flow client/server ambiguo
- Problema: il client aveva ancora affordance drag su zone crisi, mentre il server usa `SOLVE_CRISIS` solo con `crisisId`.
- Impatto: UX confusa, possibile percezione di azione "non capita".

### M2 - Item target con fallback ambiguo
- Problema: fallback player-level poteva portare ad azione riuscita ma senza equip reale su Hero.
- Impatto: carta consumata con effetto poco chiaro lato utente.

### M3 - Dado poco leggibile lato client
- Problema: evento `DICE_ROLLED` non esponeva chiaramente bonus/malus e target richiesto.
- Impatto: difficile capire perche un tentativo Monster riesce/fallisce.

### M4 - Edge case disconnect durante pending/reaction
- Problema: uscita permanente del giocatore con `pendingAction` poteva lasciare flow incoerente.
- Impatto: rischio stato bloccato o fase non pulita.

### M5 - Avanzamento turno senza connessi
- Problema: `advanceTurn` poteva non trovare nessuno e lasciare stato opaco.
- Impatto: partita apparentemente congelata.

### M6 - `steal_played_card` con tipo carta errato
- Problema: il parser reinseriva carta rubata come `CHALLENGE` anche quando il template originale era diverso.
- Impatto: incoerenza gameplay e comportamento carta errato ai turni successivi.

## 3) Decisioni gameplay applicate

### D1 - Monster action esplicita
- Modello finale: attacco Monster solo da azione esplicita sul Monster (`ATTACCA`), non da drop carta mano.

### D2 - Reazioni senza costo AP
- Regola finale: `PLAY_REACTION` non consuma AP.
- Vincoli confermati: solo durante reaction window, solo avversari, carta valida.

### D3 - Item equip solo su Hero valido
- Regola finale: Item richiede target Hero valido; fallback ambiguo rimosso.

## 4) Correzioni implementate

### Server authoritative
- `server/src/rooms/OfficeRoom.ts`
  - hardening start/reset stato partita all'avvio (cleanup hand/company/effects/phase fields);
  - `advanceTurn` porta a `WAITING_FOR_PLAYERS` se nessun connesso;
  - `handlePlayMagic` + `applyMagicResolution`: Item con target Hero obbligatorio (niente fallback ambiguo);
  - `applyCrisisResolution`: `DICE_ROLLED` esteso con `modifier` e `targetRoll`;
  - cleanup robusto su rimozione player (`removePlayerPermanently`, `cleanupPendingForRemovedPlayer`).
- `server/src/game/turnFlow.ts`
  - validazione aggiuntiva su player non connesso.

### Shared contracts / parser
- `shared/SharedTypes.ts`
  - `IDiceRolledEvent` esteso con `modifier` e `targetRoll`.
- `shared/CardEffectParser.ts`
  - fix `steal_played_card`: carta rubata ricostruita con tipo/template reali (non piu hardcoded a `CHALLENGE`).

### Client affordance / feedback
- `client/src/network/ServerManager.ts`
  - `solveCrisis(crisisId)` reso coerente con il server (niente parametro carta fittizio).
- `client/src/scenes/GameScene.ts`
  - chiamata `solveCrisis` allineata;
  - zone crisi non piu drop-target (azione Monster esplicita);
  - surfacing dado migliorato con bonus/malus e target nei messaggi toast/log.
- `client/src/i18n.ts`
  - nuove stringhe IT/EN per log/toast dado esteso.

## 5) Stato allineamento finale

Allineamento raggiunto tra:
- design/documentazione: regole baseline + decisioni D1/D2/D3;
- server authoritative: validazione e stato coerenti;
- client affordance: azioni e feedback coerenti con il server;
- contratti shared: eventi gameplay piu espliciti;
- test: copertura estesa su flussi critici.

## 6) Residui non bloccanti

- Bilanciamento carte/effect DSL ancora da tuning (non blocca coerenza del flow).
- Possibile miglioramento futuro: broadcast piu ricco di eventi semantici per analytics replay.
