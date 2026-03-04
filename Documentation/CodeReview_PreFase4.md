# Code Review Pre-Fase 4 (Storico) 
**Revisore:** Agente 0 (Tech Lead & System Architect)  
**Data originale:** 2026-03-04  
**Scope originale:** `server/src/rooms/OfficeRoom.ts` · `shared/CardEffectParser.ts`  
**Stato attuale:** Tutti i punti critici (🔴) elencati in questo documento sono stati **recepiti e corretti** nel codice attuale. Il file rimane come storico delle decisioni di revisione.

---

> [!NOTE]
> Questo documento rappresenta la **fotografia dei problemi prima della Fase 4**.  
> Oggi il codice di `OfficeRoom.ts` e `CardEffectParser.ts` è stato aggiornato: le annotazioni 🔴 qui sotto sono **già risolte** e vanno lette come storico, non come TODO aperti. I punti 🟡 restano utili come linee guida qualitative.

---

## 1. `OfficeRoom.ts` — Rilievi per Agente 1

### 🔴 [CRITICO — RISOLTO] Riga 32–49 — Tipi locali duplicati di `ICardEffect`/`CardTemplate`
```
// Internal types for the card database
interface CardEffect { action: string; ... }
interface CardTemplate { ... effect: CardEffect; }
```
**Problema:** `OfficeRoom.ts` definisce una propria interfaccia locale `CardEffect` e `CardTemplate` invece di importare `ICardEffectDSL` e `ICardTemplate` da `SharedTypes.ts`. Questo viola il principio di **Single Source of Truth** dell'Agente 0 e rende impossibile garantire coerenza tra Parser e Room nel momento in cui il DSL verrà raffinato.  
**Azione:** Eliminare le interfacce locali (righe 32-57) e importare `ICardTemplate`, `ICardEffectDSL` da `../../../shared/SharedTypes`.

---

### 🔴 [CRITICO — RISOLTO] Riga 225 — `PendingActionState` non popolato con `id`
```typescript
const pending = new PendingActionState();
pending.playerId = triggerPlayerId;
// ... id NON viene mai assegnato
```
**Problema:** L'interfaccia `IPendingAction` da `SharedTypes.ts` richiede ora un campo `id: string`. `PendingActionState` viene istanziato, ma il campo `id` non viene mai popolato con un UUID. Questo causerà errori nel `CardEffectParser.resolveChain()` che usa `action.id` per il logging e la deduplicazione.  
**Azione:** Aggiungere `pending.id = this.generateId();` immediatamente dopo `const pending = new PendingActionState();` (riga 225).

---

### 🔴 [CRITICO — RISOLTO] Riga 253 — `resolveReactions()` non usa `CardEffectParser.resolveChain()`
```typescript
// Riga 253
if (reaction.actionType === "cancel_effect") {
    originalActionCancelled = true;
    break;
}
```
**Problema:** La logica di risoluzione delle reazioni è una sequenza `for` manuale con un singolo case `cancel_effect` hardcodato come stringa. Il `CardEffectParser.resolveChain()` — già implementato dall'Agente 3 — implementa correttamente la semantica LIFO con gestione di `cancel_effect`, `redirect_effect` e `steal_played_card`, ed è il metodo ufficiale da chiamare.  
**Azione:** Sostituire il corpo del loop `resolveReactions()` con una chiamata a `CardEffectParser.resolveChain(this.state.actionStack, (id) => this.getTemplate(id) as ICardTemplate | undefined, this.state)`. La `reactionQueue` locale deve essere eliminata in favore dello `state.actionStack`.

---

### 🔴 [CRITICO — RISOLTO] Riga 56 — `QueuedReaction.actionType` è una stringa libera
```typescript
interface QueuedReaction {
    actionType: string;  // "redirect_effect" | "steal_played_card" | "cancel_effect"
```
**Problema:** Il campo `actionType` è tipizzato come `string` invece di un union type o dell'enum `ActionType`. Il commento dice cosa dovrebbe essere, ma il compilatore non lo verifica.  
**Azione:** Cambiare in `actionType: ActionType;` (importando `ActionType` da `SharedTypes`) oppure rimuovere la struttura `QueuedReaction` interamente nel refactoring indicato sopra (punto 3).

---

### 🟡 [ATTENZIONE] Riga 285 — `pendingAction = null as any`
```typescript
this.state.pendingAction = null as any;
```
**Problema:** L'uso ripetuto di `null as any` bypassa il type system di Colyseus Schema. In Colyseus, uno Schema nullable si gestisce con un'istanza vuota separata o tramite la presenza/assenza di un campo `@type`.  
**Azione (da valutare):** Definire una sentinel value `PendingActionState` vuota con `id = ""` oppure affidarsi unicamente allo `state.actionStack` in Fase 4, rendendo `pendingAction` un derivato calcolato dell'ultimo elemento dello stack.

---

### 🟡 [ATTENZIONE] Riga 82 — `onCreate(_options: any)`
```typescript
onCreate(_options: any): void {
```
**Problema:** Il parametro `_options` è tipizzato `any`. Colyseus permette di tipizzarlo con un'interfaccia di opzioni di creazione room.  
**Azione:** Creare un'interfaccia `IOfficeRoomOptions` (può essere vuota per ora) e sostituire `any`.

---

## 2. `CardEffectParser.ts` — Rilievi per Agente 3

### 🔴 [CRITICO — RISOLTO] Riga 1 — Importazione non usa `ICardEffectDSL`
```typescript
import type { IGameState, IPlayer, ICardEffect, ICardTemplate, IPendingAction, ClientMessages } from "./SharedTypes";
```
**Problema:** Il file importa ed usa `ICardEffect` (ora alias deprecato di `ICardEffectDSL`). Funzionerà grazie all'alias, ma il parser dovrebbe esplicitamente usare `ICardEffectDSL` e i type `ActionType`/`TargetType` ora disponibili.  
**Azione:** Aggiornare l'import aggiungendo `ICardEffectDSL, ActionType, TargetType` e usando `ICardEffectDSL` nelle firme dei metodi privati.

---

### 🔴 [CRITICO — RISOLTO] Riga 269-270 — `resolveChain` usa `pending.targetCardId` come `templateId`
```typescript
const templateId = pending.targetCardId;  // ← BUG SEMANTICO
if (!templateId) continue;
const cardTemplate = cardLookup(templateId);
```
**Problema:** `targetCardId` contiene l'**UUID in-game** dell'istanza della carta (es. `card_a3f2b1`), **non** il `templateId` del DB (es. `emp_01`). Passare un UUID a `cardLookup` restituirà sempre `undefined`, rendendo l'intero chain resolver non funzionale.  
**Azione:** Il `IPendingAction` deve contenere un campo `targetTemplateId?: string` oppure `resolveChain` deve ricevere un secondo map `cardInstanceToTemplate: Map<string, string>` per tradurre gli UUID in templateId. **Questa è la correzione più urgente.**

---

### 🔴 [CRITICO — RISOLTO] Riga 321 — Phase 2 itera lo stack nello stesso ordine della Phase 1 (LIFO)
```typescript
// --- PHASE 2: Apply surviving ... ---
// Process in original chronological order (oldest first)
for (let i = stack.length - 1; i >= 0; i--) {  // ← stessa direzione LIFO
```
**Problema:** Il commento dice "oldest first" ma l'iterazione è da `stack.length - 1` a `0`, ovvero l'opposta (newest first = LIFO). Per applicare gli effetti nell'ordine cronologico corretto (azione originale prima, poi reazioni), il loop deve essere `for (let i = 0; i < stack.length; i++)`.  
**Azione:** Invertire l'indice del ciclo in Phase 2 da LIFO a FIFO.

---

### 🟡 [ATTENZIONE] Riga 111-116 — `resolveDrawCards` non pesca carte reali
```typescript
private static resolveDrawCards(effect: ICardEffect, sourcePlayer: IPlayer): boolean {
    if (!effect.amount) return false;
    // Logic to draw cards from gameState.deck would go here.
    console.log(`[CardEffectParser] Player ${sourcePlayer.username} draws ${effect.amount} cards.`);
    return true;  // Restituisce true senza fare nulla di concreto
}
```
**Problema:** Questo metodo non modifica alcuno stato, restituisce sempre `true` e si affida a un commento. Per la Fase 4, quando `draw_cards` viene chiamato dalla carta `emp_05`, il giocatore non pescherà niente davvero.  
**Azione:** Introdurre `gameState` come parametro opzionale e integrare la chiamata al Server deck oppure documentare esplicitamente come contratto che il _caller_ (`OfficeRoom`) dovrà intercettare questo caso prima di passare al Parser.

---

### 🟡 [ATTENZIONE] Riga 139-143 — `resolveCancelEffect` usa `pendingAction` (legacy)
```typescript
private static resolveCancelEffect(gameState: IGameState): boolean {
    gameState.pendingAction = null;
    ...
}
```
**Problema:** Il metodo cancella solo `pendingAction` (campo legacy) ma non `actionStack`. In Fase 4, l'azione da cancellare sarà sempre nello stack.  
**Azione:** Il metodo è già corretto nel contesto `resolveChain` (che usa `isCancelled`). Questo overload del metodo `resolveCancelEffect` standalone è potenzialmente superfluo e fuorviante — valutare se rimuoverlo.

---

## Riepilogo Azioni per Agente (Storico già completato)

| # | Riga | File | Agente | Priorità |
|---|------|------|--------|----------|
| 1 | 32-57 | OfficeRoom.ts | A1 | 🔴 Critica |
| 2 | 225 | OfficeRoom.ts | A1 | 🔴 Critica |
| 3 | 253 | OfficeRoom.ts | A1 | 🔴 Critica |
| 4 | 56 | OfficeRoom.ts | A1 | 🔴 Critica |
| 5 | 285 | OfficeRoom.ts | A1 | 🟡 Attenzione |
| 6 | 82 | OfficeRoom.ts | A1 | 🟡 Attenzione |
| 7 | 1 | CardEffectParser.ts | A3 | 🔴 Critica |
| 8 | 269-270 | CardEffectParser.ts | A3 | 🔴 Critica |
| 9 | 321 | CardEffectParser.ts | A3 | 🔴 Critica |
| 10 | 111-116 | CardEffectParser.ts | A3 | 🟡 Attenzione |
| 11 | 139-143 | CardEffectParser.ts | A3 | 🟡 Attenzione |
