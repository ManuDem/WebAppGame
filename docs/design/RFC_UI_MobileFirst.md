# RFC UI Mobile-First

Data: 2026-03-04  
Owner: Agente 0 (Tech Lead)

## Obiettivo
Eliminare sovrapposizioni e densita eccessiva per rendere il gioco consultabile con tocchi, in portrait e landscape.

## Direzione Visuale
- Stile old-school Pokemon coerente in tutte le scene.
- Titolo sempre: `LUCrAre: SEMPRE`.
- Sottotitolo coerente: `Il gioco piu giocato in Marcoleria`.
- Movimento di sfondo consentito: solo nuvole lente.
- Effetti da rimuovere: pallini, cerchi, particelle decorative non informative.

## Layout Regole
- Priorita mobile portrait.
- Tap target minimo: 44x44 px.
- Safe margin laterale minimo: 12 px.
- Spacing verticale minimo tra blocchi interattivi: 10 px.
- Nessun testo critico deve uscire dal pannello.

## Menu/Login
- Sequenza verticale chiara:
  - lingua
  - scelta Host/Partecipa
  - codice partita (host mostra, join inserisce)
  - nome CEO
  - CTA principale
- Input sempre centrati e leggibili.
- Nessun overlap tra blocchi lingua/modalita/codice/input.

## Partita
- Pre-lobby sempre leggibile (regole brevi + pronti + stato host).
- Board leggibile:
  - area imprevisti chiara
  - area company chiara
  - mano con carte compact non sovrapposte in modo critico
- Card inspect fullscreen:
  - artwork in alto
  - dettagli in basso
  - chiusura chiara via tap esterno o bottone.

## Accessibilita
- Contrasto testi in linea con WCAG AA su sfondi usati.
- Font unico e consistente.
- Ridurre testi ridondanti su card compact, lasciare dettaglio alla modal fullscreen.
