# LUCrAre 2.0: Core Rules & Meccaniche (Here to Slay Lite)

Questo documento definisce la direzione ufficiale del gameplay: versione semplificata ispirata a Here to Slay, con priorita su leggibilita mobile, partite rapide e interazioni ad alta tensione.

## 1) Categorie carte

### Main deck (5)
- Hero
- Item
- Magic
- Modifier
- Challenge

### Extra setup (2)
- Monster (tavolo centrale)
- Party Leader (personale)

## 2) Loop turno (quick)
Ogni turno il player attivo riceve 3 AP e puo:
- giocare carte (Hero/Item/Magic)
- tentare un Monster
- pescare
- chiudere turno

Le reazioni Challenge/Modifier avvengono in finestre brevi server-side.

## 3) Dadi
- 2d6 server-authoritative
- Modifier applicati in coda reazione
- Soglie `targetRoll` su Monster e alcune abilita

## 4) Vittoria
- 2 Monster sconfitti
oppure
- 4 Hero in squadra

## 5) Ispirazioni da giochi noti (adattate)
- Here to Slay: struttura Hero/Item/Magic/Challenge/Modifier
- King of Tokyo: tensione push-your-luck sui dadi (qui in forma piu snella)
- 7 Wonders: leggibilita decisionale per turno (pochi passi, alto segnale)

## 6) Design UX richiesto
- Nessun overlap di testi in ogni orientamento
- Carte compact sul tavolo
- Dettaglio full screen su tap
- Sfondo dinamico: solo nuvole lente (no pallini/cerchi)
- Pre-lobby obbligatoria con regole brevi e stato ready

## 7) Stato tecnico (2026-03-04)
1. Completato: enum/tipi shared migrati a modello 5+2 (con alias legacy).
2. Completato: `cards_db.json` riallineato al nuovo schema + aggiunta carte `Modifier` e `Party Leader`.
3. Completato: parser/room aggiornati per `Challenge` e `Modifier` (tag one-shot su tiro dadi).
4. Parziale: UI tavolo/hand e inspect fullscreen migliorati; resta da rifinire il target selector sulle carte senza bersaglio.
5. Completato: build server/client + test mirati core gameplay passati.
