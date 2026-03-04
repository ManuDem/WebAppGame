# Feature 05: Visual Contracts & Event Queue (FASE 4)

## 1. Il Problema del Disaccoppiamento
In un gioco multigiocatore *Server-Authoritative*, lo Stato Globale (la State Room di Colyseus) muta istantaneamente.
*Esempio:* Quando un giocatore subisce 2 danni, lo State passa da `HP: 10` a `HP: 8` all'istante (nell'`onStateChange`). 
Se l'Agente 2 (Frontend) legasse direttamente i cambiamenti grafici all'`onStateChange`, il giocatore vedrebbe scendere i propri Punti Vita *prima* che il missile visivo lo raggiunga.

## 2. La Soluzione: Eventi Puramente Visivi
Per creare un "drastico miglioramento grafico" e spettacolo (particelle, proiettili, popup, shake screen), il Server deve comunicare al Client **cosa mostrare** separatamente da **cosa è cambiato nello Stato**.
L'Agente 0 ha aggiunto nuovi eventi all'enumeratore `ServerEvents`:

- `SHOW_ANIMATION`: Riproduce un'animazione specifica tra due entità.
- `TRIGGER_PARTICLES`: Crea effetti particellari su un target.
- `START_REACTION_TIMER`: Gestisce il timer visivo asincrono quando si apre una `Reaction Window`.
- `VFX_SHAKE`: Triggera una scossa globale o mirata (es. per crisi o sabotaggi).
- `VFX_CONFIDENZA`: Particelle dorate per celebrare assunzioni di alto livello.
- `UI_FEEDBACK_DENIED`: Feedback di errore visivo (scossa dei bottoni) per azioni non permesse.

## 3. La "Visual Event Queue" (Direttiva per l'Agente 2)
Il Frontend in Phaser.js **NON DEVE** applicare gli aggiornamenti dello stato di Colyseus immediatamente alla UI grafica se c'è un'animazione in corso. L'Agente 2 deve implementare una `VisualEventQueue`:

1. Quando arriva un `SHOW_ANIMATION`, metterlo in coda.
2. Sospendere l'applicazione rigida dello State (es. bloccare i contatori PA/HP) sulla UI.
3. Eseguire l'animazione `Tween` (es. carta che vola verso il tavolo).
4. Alla fine dell'`onComplete` del Tween in Phaser, sbloccare la UI graficamente facendole riflettere i nuovi dati reali dello State di Colyseus che intanto sono già mutati in background nel client.

## 4. PendingAction (Payload & Reazioni)
La `Reaction Window` (Finestra di Reazione) crea una frizione temporale. 
La `PendingAction` nello State è il "Segnaposto" dell'azione in corso. 
* Quando l'azione va in sospeso ( `GamePhase.REACTION_WINDOW` ), Colyseus manderà lo State con una `pendingAction` popolata.
* Agente 2 riceve l'evento visivo `START_REACTION_TIMER(duration: 5000)`.
* Agente 2 mostra un enorme timer a schermo.
* Le reazioni avversarie (es. l'avversario gioca "Obiezione!") non mutano la `pendingAction` ma lanciano l'evento `REACTION_TRIGGERED`. 
* Agente 2 prenderà questo evento, mettendolo in Visual Queue: farà apparire la faccia dell'avversario a schermo che grida "Obiezione!" fermando visivamente il timer.
* Allo scadere (o alla risoluzione immediata), lo State tornerà pulito (`phase: PLAYER_TURN`, `pendingAction: null`) e il Server emetterà `ACTION_RESOLVED`, triggerando la Visual Queue per completare o bruciare la carta in base al `success`.

## 5. Protocollo "Visual Juice" (Direttive UX per Agente 2)
Per garantire un feeling premium e dinamico ("Juice"), l'Agente 2 deve seguire questa **Visual Priority List**:

1. **Animazioni di Gioco (Priorità Assoluta)**: Le animazioni come carte giocate, scarti o risoluzioni di crisi devono bloccare l'interazione UI finché non terminano (tramite `VisualEventQueue`).
2. **Micro-Animazioni (Feedback di Input)**: Effetti di hover, pressione bottoni o selezione carte sono non-bloccanti. Per non percepire lag, devono avere una durata **< 150ms**.
3. **Regola della Transizione di Stato**: Nessun elemento dello stato (contatori PA, carte in mano, cambio turno) può cambiare visivamente in modo istantaneo. Ogni variazione numerica o di stato deve essere accompagnata da una transizione fluida (es. count-up/down) di almeno **200ms**.
4. **Error Feedback**: In caso di `UI_FEEDBACK_DENIED`, l'animazione di "scossa" deve essere immediata per dare feedback tattile all'errore di validazione.

