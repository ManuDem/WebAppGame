# LUCrAre 2.0: Core Rules & Meccaniche

Questo documento traccia il pivot direzionale del progetto "LUCrAre: SEMPRE" verso un feeling più dinamico e imprevedibile (ispirato a titoli come *Here to Slay*), semplificando la semantica delle carte e integrando l'RNG esplicito dei dadi nel game loop.

## 1. I 4 Nuovi Tipi di Carta

Per semplificare l'onboarding visivo e logico, i tipi si riducono a 4 categorie nette:

- **EMPLOYEE (Impiegati):** Le unità base. Vengono giocate nella propria *Company* (plancia personale). Forniscono bonus passivi (es. modificatori ai dadi) e possono essere sacrificati o usati per effetti attivi.
- **IMPREVISTO (Mostri / Sfide):** Carte posizionate al centro del tavolo. Per risolverle/sconfiggerle è necessario soddisfare un requisito (es. pagando un certo set di Impiegati) OPPURE superare un tiro di dado (`targetRoll`). Sconfiggerle fornisce Punti Vittoria (VP).
- **OGGETTO (Equipaggiamento):** Si attaccano (equip) a uno specifico `EMPLOYEE` già in gioco. Ne amplificano i modificatori passivi, conferiscono protezioni, o malus se usati su impiegati avversari.
- **EVENTO (Magie / Azioni One-Shot / Reazioni):** Carte istantanee. Hanno un effetto devastante e subitaneo che si risolve (a volte tramite lancio di dado) e finiscono direttamente negli scarti. Possono essere giocate anche nel turno avversario.

## 2. Meccanica dei Dadi (2d6 System)

L'introduzione della meccanica del dado aggiunge un elemento di rischio e gestione delle probabilità.

- **Il Tiro (Roll):** Le carte `IMPREVISTO` o `EVENTO` possono richiedere di tirare 2 dadi a 6 facce (2d6).
- **Modificatori:** Il valore totale del tiro è influenzato dai `modifier` (bonus/malus) forniti passivamente dagli `EMPLOYEE` o `OGGETTO` controllati dal giocatore.
- **Risoluzione (Target Roll):** Il risultato finale arrotondato viene confrontato con il `targetRoll` della carta. Se lo supera o uguaglia (`>=`), l'effetto ha *successo*, altrimenti fallisce.
- **Sicurezza Server:** Il lancio avviene **sempre** sul Server per prevenire cheat. Il Client richiede il tiro (`ClientMessages.ROLL_DICE`) e il Server risponde broadcastando l'esito visivo (`ServerEvents.DICE_ROLLED`), permettendo al Client di attivare l'animazione fisica del dado. `GameState` si aspetterà l'avvenuta animazione visiva prima di applicare le conseguenze dell'azione a livello formale.

## 3. Risoluzione Grafica e UX (Il "Tap to Full-Screen")

In base al nuovo filone intrapreso per un design responsive/mobile first:

- Il tavolo da gioco non presenterà più i testi complessi direttamente sui rendering fisici delle carte (che diventerebbero illeggibili su mobile).
- Le carte sul tavolo (sia in `hand`, che `company`, che `centralCrises`) mostreranno principalmente l'**Icona** del template (`visuals.iconName`), il **Nome** semplificato e il **Costo**.
- **UX Tap:** Per poter consultare l'effetto di una carta, l'`Agente 2` imposterà un listener sui tap lunghi (o doppio click su desktop) che farà esplodere in full-screen un pop-up semitrasparente contenente l'illustrazione grande e tutto il set di regole testuali (l'effettivo payload `description` e `shortDesc`). Nessun calcolo verrà fatto lato server in questa fase.
