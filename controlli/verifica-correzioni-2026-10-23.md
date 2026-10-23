# Verifica delle correzioni (23/10/2026)

Pagina verificata: `index.html` di `main` a 108507c. Solo verifica: nessun file del sito toccato.

**In breve: 8 punti su 9 a posto, 1 a metà.** Il mosaico su WebKit adesso è giusto. Resta una cosa: al telefono il poster orizzontale si scarica ancora (6,6 KB, punto 8). In più un margine stretto nel telefono in orizzontale (punto 5), che si vede solo con caratteri larghi.

| # | Correzione | Esito |
|---|---|---|
| 1 | Mosaico YouTube su WebKit | sì |
| 2 | Link «Nord-Ovest, 30 giorni» | sì |
| 3 | «Riduci animazioni» senza video | sì |
| 4 | Margine dei riquadri YouTube e quiz | sì |
| 5 | Telefono in orizzontale | sì, con un margine stretto (nota sotto) |
| 6 | Contrasti | sì |
| 7 | Menu | sì |
| 8 | Cose nuove | a metà: il poster orizzontale si scarica ancora al telefono |
| 9 | Regressioni | nessuna |

## Come ho provato

Come il check di stamattina: server locale con Range e registro dei byte mandati, Google Analytics bloccato. **Chrome for Testing 141** (coi codec) con Playwright, profili dei telefoni di Playwright. **WebKitGTK 2.52** via WebDriver (finestra minima 447 px, quindi niente telefoni stretti su WebKit). **Firefox 158** con Puppeteer (barra di scorrimento da 12 px, che toglie 12 px al layout sotto i 735). Caratteri: Inter al posto di «SF Pro» (il caso più largo), e per menu e orizzontale anche Roboto (Android) e Liberation Sans (metriche di Helvetica e Arial).

## 1. Mosaico YouTube su WebKit: risolto

Le tre foto (`.m1`, `.m2`, `.m3`, ognuna in uno `span` con l'`img` in `position: absolute; inset: 0`), larghezza × altezza in px. L'`img` coincide sempre con il suo `span`, `object-fit: cover` ovunque.

| Larghezza | Chrome | WebKit | Firefox |
|---|---|---|---|
| 1440 | 364×460, 364×227, 364×227 | uguale | uguale |
| 1024 | 283×460, 283×227, 283×227 | uguale | 279×460, 279×227, 279×227 (barra) |
| 768 | 208×508, 208×251, 208×251 | 208×508, 208×251, 208×251 | 205×508, 205×251, 205×251 |
| telefono | iPhone 13: 180×274, 180×134, 180×134 | 447: 208×317, 208×156, 208×156 | 390: 174×265, 174×130, 174×130 |

Le due piccole sono sempre alte esattamente (mosaico − 6 px) / 2, su tutti e tre i motori (stamattina su WebKit erano 365×486). Screenshot `screenshot-verifica-2026-10-23/01-mosaico-chrome-sopra-webkit-sotto.jpg`: il tartufo in mano ad Archie e i due porcini col gambo si vedono uguali.

## 2. Link «Apri la pioggia del Nord-Ovest, 30 giorni»: risolto

Riga 464: `?r=piemonte,valledaosta,lombardia,liguria&g=30`, in scheda nuova. Ho fatto girare la `regioniDalLink` vera della mappa (`Mappa-Precipitazioni-Nord`, `index.html` riga 5172, commit 1b6af53 di oggi) con le caselle che la mappa ha davvero: esce `["piemonte-vda","lombardia","liguria"]`. Il link vecchio dava `["piemonte-vda","lombardia","trentino-aa"]`.

## 3. «Riduci animazioni»: risolto

Byte di video mandati dal server con «riduci animazioni», dopo 6 s e uno scorrimento di tutta la pagina:

| | Telefono | Computer / iPad |
|---|---|---|
| Chrome | 0 (iPhone 13, Pixel 7) | 0 (1440, iPad Mini) |
| Firefox | 0 (390) | 0 (1440, iPad Mini) |
| WebKit | 0 (447) | 0 (1440, iPad Mini) |

Ovunque: poster giusto (verticale al telefono), tondo nascosto, nessuna scritta creata, video fermo a 0. Screenshot `04-riduci-animazioni-telefono.jpg`.

Una nota minima solo su WebKit a larghezza da telefono: con «riduci animazioni» l'elemento `<source>` del 720 lancia un evento `error` e il video resta senza sorgente (`networkState` 3). Non si vede niente (poster al suo posto, il tondo non c'è) e non costa byte. Non serve fare niente.

## 4. Riquadri YouTube e quiz: risolto

Margine sinistro e destro dei due riquadri (uguali tra loro), Chrome:

| Larghezza | 360 | 390 | 734 | 735 | 768 | 1024 | 1280 | 1303 | 1304 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Margine | 12 | 12 | 12 | 22 | 22 | 22 | 22 | 22 | 22 | 90 | 330 |

Da 735 a 1304 px sono 22 px, come le foto dei capitoli; al telefono 12 px come prima. WebKit identico (447 → 12, da 735 a 1304 → 22, 1440 → 90). Firefox uguale, a parità di spazio utile.

## 5. Telefono in orizzontale: risolto, con un margine stretto

Regola `(min-width: 735px) and (max-height: 500px)` (riga 332). Prima schermata, Chrome:

| Profilo | Titolo (y) | Pillole | «Gratis…» finisce a | Film | Tondo | Scritte contro il tondo |
|---|---|---|---|---|---|---|
| iPhone 12 (750×340) | 70-141 | una riga | 287 | 56-340 | 286-322 | staccate (la riga più lunga finisce 61 px prima) |
| iPhone 12 Safari (844×390) | 103-173 | una riga | 303 | 56-390 | 336-372 | staccate |
| iPhone 15 Pro Max (814×380) | 98-168 | una riga | 298 | 56-380 | 326-362 | staccate |
| iPhone 15 Pro Max (932×430) | 123-193 | una riga | 323 | 56-430 | 376-412 | staccate |
| Pixel 7 (863×360) | 88-158 | una riga | 288 | 56-360 | 306-342 | staccate |
| Galaxy S8 (740×360) | **56-126** | **due righe** | 326 | 56-360 | 306-342 | staccate |
| 750×340 | 70-141 | una riga | 287 | 56-340 | 286-322 | staccate |

Tutto dentro lo schermo, le quattro scritte dentro il film e mai sopra il tondo (né sopra la pillola «Riguarda» a fine film). Firefox dà gli stessi numeri. WebKit a 750×340, 863×360 e 932×430 è uguale.

**Il margine stretto.** Le due pillole stanno in `max-width: min(560px, 34vw)` (riga 213): a 740-750 px lo spazio è 252-255 px e le pillole, con Inter, ne occupano 255. Con un carattere appena più largo vanno su due righe, il blocco si allunga e il titolo sale fino al menu: su Chrome a 740×360 parte proprio a 56 (sotto il menu, senza aria); su WebKit a 750×340 parte a 48, e la parte alta delle lettere finisce **sotto il menu per 8 px** (screenshot `02-orizzontale-750x340-chrome-webkit.jpg`, sotto). Con Roboto e con le metriche di Helvetica le pillole occupano 244 px e stanno su una riga a ogni misura (titolo da 78 px in giù): sui telefoni veri oggi non dovrebbe succedere. Proposta, se vuoi più aria: dentro la regola della riga 332 aggiungere `.film .txt { max-width: min(560px, 40vw); }`.

**iPhone SE in orizzontale (568×320)**, regola `(max-width: 734px) and (orientation: landscape)` (riga 384): film 92-320, quindi dentro lo schermo; tondo 272-308 e scritte 223-264, dentro il film e staccati tra loro (Chrome e Firefox). Il film verticale è mostrato intero al centro (`contain`): le scritte più lunghe escono dall'immagine sul nero ai lati, ma si leggono. Titolo e pillole vengono sotto, scorrendo, com'è giusto. Screenshot `03-iphone-se-orizzontale.jpg`.

## 6. Contrasti: risolto

axe-core 4 (WCAG 2.2 AA e buone pratiche) su Chrome a 1440, 1024 e iPhone 13, con e senza «riduci animazioni»: **zero violazioni**. Restano solo i soliti «da controllare a mano» sul testo sopra il film, che axe non sa misurare.

- Data del film nel piede (riga 315): #6e6e73 su #f5f5f7, **4,66** (era 2,36).
- «Iscriviti» bianco su #d40000 (righe 200 e 293): **5,53**; al passaggio #b80000: 6,91 (era 4,0).
- Anello del fuoco nel chiaro (riga 186): col Tab tutti i 16 elementi della parte chiara e del piede hanno l'anello #0066cc: 5,11 sul #f5f5f7, 5,57 sul bianco, 4,56 sul grigio dei tondi social (era 2,77).

## 7. Menu: risolto

Chrome, con tre caratteri:

| Larghezza | Voce | «Contatti» | Margine destro di «Iscriviti» (Inter / Roboto / Liberation) | Spazio fra le voci con Inter |
|---|---|---|---|---|
| 320, 359 | Quiz | no | 16 / 16 / 16 | 9,5 / 22,5 |
| 360, 375, 389 | Quiz | no | 16 / 16 / 16 | 23 / 28 / 32 |
| 390 | Quiz esame tartufi | no | 16 / 16 / 16 | 9,3 |
| 412, 430 | Quiz esame tartufi | no | 16 / 16 / 16 | 17 / 23 |
| 734 | Quiz esame tartufi | no | 16 | 124 |
| 735, 800, 999 | Quiz | sì | 18-24 | 22 |
| 1000, 1440 | Quiz esame tartufi | sì | 24-35 | 32 |

Sempre su una riga, mai sopra il nome. WebKit uguale (447 e 734 «Quiz esame tartufi» senza «Contatti», 735 e 999 «Quiz» con, 1000 tutto). Su Firefox a 320 e 390 il margine scende a 8 px, ma solo perché la barra di scorrimento del computer toglie 12 px (layout 308 e 378): i telefoni non hanno quella barra.

## 8. Cose nuove: a posto, tranne il poster orizzontale

- **Diretta radar** (righe 543-544): la frase nel sottotitolo e il link `?r=lombardia,veneto,emilia&radar=ora` in scheda nuova. Nella mappa `radar=ora` è un valore accettato e le 3 regioni passano tutte da `regioniDalLink`.
- **JSON-LD** (righe 25-61): sintassi valida, un `@graph` con Organization (nome, url, email, sameAs dei 3 social), WebSite (nome, url, `inLanguage`, editore collegato con `@id`), WebApplication (nome, url, categoria, sistema, descrizione, `offers` a 0 EUR). Campi sensati. Due note, nessuna urgente: per lo snippet «app» Google vuole anche `aggregateRating` o `review`, quindi la WebApplication resta un dato valido ma senza stelline in ricerca; a Organization si può aggiungere un `logo`.
- **Social**: `og:site_name`, `og:locale` it_IT, `og:image` `anteprima-home.jpg` (il file c'è, 2400×1260, 171 KB, coincide con width e height dichiarati), `og:image:alt`, `twitter:card` summary_large_image.
- **Preload del poster verticale** (riga 13): funziona. Al telefono `apertura-v-poster.webp` parte per primo dal `link` (Chrome, Firefox, WebKit) e al computer e sull'iPad non si scarica.
- **Poster orizzontale al telefono: no.** Si scarica ancora per intero (6.640 byte) su Chrome (iPhone 13, iPhone SE, Pixel 7), Firefox e WebKit. Il motivo: l'attributo `poster="immagini/apertura-poster.webp"` del `<video>` (riga 415) fa partire la richiesta appena il browser legge il tag, prima dello script della riga 432 che lo cambia. Proposta, provata su una copia della pagina con Chrome e WebKit (telefono e 1440, con e senza «riduci animazioni»: ogni volta un solo poster, quello giusto, e il film parte come prima):
  - riga 415: togliere `poster="immagini/apertura-poster.webp"` dal `<video>`;
  - riga 432: `v.poster = matchMedia('(max-width: 734px)').matches ? 'immagini/apertura-v-poster.webp' : 'immagini/apertura-poster.webp';`
  - sotto la riga 13: `<link rel="preload" as="image" href="immagini/apertura-poster.webp" media="(min-width: 735px)">`.

  Unico effetto: senza JavaScript il film non ha poster (ma nemmeno parte). Sono 6,6 KB, non è grave.
- **Sitemap**: la home ha `lastmod` 2026-10-23, XML valido, 10 indirizzi.
- **Scritte del film al telefono**: peso 400 (computer e iPad 300), misurato su Chrome e Firefox durante il film a 320, 390, 412 e a 568 in orizzontale.
- Le tre foto JPG tolte (`ovoli_mano`, `archie_tartufo`, `archie_corre`) non sono più usate da nessuna pagina del repo (resta solo il nome in un commento della riga 566).

## 9. Regressioni: nessuna

| Profilo | Motori | Scorrimento orizzontale | Errori | 404 | Film: fine | «Riguarda» dopo 1,8 s |
|---|---|---|---|---|---|---|
| iPhone SE (320) | Chrome, Firefox | no | nessuno | nessuno | 21,39 | 1,68 / 1,66 |
| iPhone 13 | Chrome, Firefox | no | nessuno | nessuno | 21,39 / 21,41 | 1,68 / 1,66 |
| Pixel 7 | Chrome, Firefox | no | nessuno | nessuno | 21,40 | 1,68 / 1,66 |
| 447 (telefono su WebKit) | WebKit | no | nessuno | nessuno | 21,35-21,41 | 1,68 |
| iPad Mini | tutti e tre | no | nessuno | nessuno | 21,39-21,40 | 1,66-1,68 |
| 1024 | tutti e tre | no | nessuno | nessuno | 21,37-21,43 | 1,66-1,68 |
| 1440 | tutti e tre | no | nessuno | nessuno | 21,40-21,43 | 1,66-1,68 |

- «Errori»: l'unico è la richiesta a Google Tag Manager, bloccata apposta.
- Video giusto ovunque: 720 verticale al telefono (4,6 MB), 1080 al computer e sull'iPad. Tutte le 9 immagini caricate, nessuna rotta. A fine film il tondo diventa «Riguarda il filmato», premuto riparte da 0.
- Su WebKit a 1024, al primo giro, il film non è partito (fermo a 0 dopo 15 s). Girava insieme a Chrome sulla stessa macchina. Rifatto da solo, è partito ed è arrivato a 21,37 s come gli altri: lo considero un caso della macchina di prova, non della pagina.

## Da provare dal telefono vero

- iPhone in orizzontale con Safari: con Helvetica le pillole dovrebbero stare su una riga (punto 5), ma è da guardare a occhio.
- Che Google legga i dati strutturati: Rich Results Test sull'indirizzo pubblicato.
