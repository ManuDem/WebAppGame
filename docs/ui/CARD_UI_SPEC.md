# Card UI Spec

Data aggiornamento: 2026-03-06

## Mini-card (mano/board)
- artwork dominante
- titolo sintetico con fit text
- tipo/meta essenziali
- footer breve con info ad alto valore
- stato giocabile/non giocabile visibile in modo netto

## Inspect overlay
- artwork grande e ratio-adaptive
- testo esteso e leggibile
- chiusura affidabile (`X` + tap esterno)

## Regole anti-overflow
- testo sempre contenuto nel box
- overflow gestito con fit + ellipsis
- niente contenuti debug in UX standard

## Regole interazione
- tap su mini-card apre inspect
- drag consentito solo quando l'azione e valida
- in modal state le mini-card non devono restare interattive
