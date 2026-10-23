# Check della home nuova (23/10/2026)

Controllo in corso: questa è una versione parziale, il rapporto si completa a ogni passo.

## Come ho provato

- Pagina: `index.html` di `main` a 2c89fc7, servita in locale con un server che regge le richieste Range.
- Motori: Chrome for Testing 141 (il Chromium di Playwright non ha i codec H.264 e non riproduce il film), WebKitGTK 2.52 (il motore di Safari, versione Linux, pilotato via WebDriver), Firefox 158.
- Google Analytics bloccato in tutte le prove.
- Caratteri: nel cloud i nomi «SF Pro» vengono sostituiti con Inter, più largo dei caratteri che i telefoni usano davvero con questa pila (Helvetica Neue su iPhone, Roboto su Android, Arial su Windows). Per il menu ho rifatto le misure con Roboto, un clone di Helvetica e Arial.

## Risultati finora

- Film: parte da solo, si ferma a 21,40 s sull'ultima immagine con «Fino alle chiome.», «Riguarda» riparte da 0, pausa e play, fuori schermo si ferma e rientrando riparte solo se non l'hai fermato tu: tutto giusto su Chrome, Firefox e WebKit, al telefono e al computer.
- Bug: con «riduci animazioni» il video si scarica lo stesso (riga 372, `v.load()`).
- Rischio: a 360 px il menu non ha più margine a destra.
- Telefono in orizzontale: il film è alto 560 px su uno schermo di 340-390.
