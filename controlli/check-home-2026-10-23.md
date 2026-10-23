# Check della home nuova (23/10/2026)

Pagina controllata: `index.html` di `main` a 2c89fc7. Solo controllo: nessun file del sito è stato toccato.

**In breve: 8 bug veri (nessuno blocca la pagina), 11 dubbi, il resto a posto.** Il film funziona bene su tutti e tre i motori, nessuna immagine manca, nessun errore JavaScript, GA4 manda gli eventi giusti, l'HTML è valido per il validatore W3C.

I 5 da sistemare per primi:

1. Su Safari (Mac e iPad) il mosaico YouTube ritaglia male le due foto piccole: il tartufo in mano ad Archie sparisce.
2. «Apri la pioggia del Nord, 30 giorni» apre solo 3 regioni su 9 (Piemonte-VdA, Lombardia, Trentino-AA).
3. Con «riduci animazioni» il film non parte ma si scarica lo stesso (13,8 MB al computer, 4,6 MB al telefono).
4. Fra 735 e circa 1300 px (iPad, portatili) i riquadri YouTube e quiz toccano i bordi dello schermo.
5. Telefono in orizzontale: il film è alto 560 px su uno schermo di 320-390, le scritte toccano il tondo.

---

## Come ho provato

- Server locale con le richieste Range (il mio, con il registro di ogni richiesta e dei byte mandati), Google Analytics bloccato.
- **Chrome**: Chrome for Testing 141 con Playwright. Il Chromium di Playwright non ha i codec H.264 e non fa partire il film, quindi ho usato questo.
- **WebKit**: WebKitGTK 2.52 (lo stesso motore di Safari, versione Linux) pilotato via WebDriver. Non è Safari per iPhone: il motore di impaginazione è lo stesso, il lettore video no (qui GStreamer, sull'iPhone quello di Apple). La sua finestra non scende sotto i 447 px, quindi i telefoni stretti li ho provati solo su Chrome e Firefox.
- **Firefox**: Firefox 158 con Puppeteer. Non emula i telefoni: ha la barra di scorrimento del computer (12 px), quindi sotto i 735 px le misure sono un po' falsate.
- **Caratteri**: nel cloud i nomi «SF Pro» della pagina vengono sostituiti con Inter, che è più largo dei caratteri che i telefoni usano davvero con questa pila (iPhone: Helvetica Neue, perché «SF Pro» per nome non si trova; Android: Roboto; Windows: Arial). Dove la larghezza del testo conta (menu, scritte) ho rifatto le misure con Roboto, un clone di Helvetica e Arial.
- Modelli (Chrome, profili di Playwright o misure ufficiali): iPhone SE 1ª gen (320), SE 3ª gen (375), 12, 13, 14 (390), 14 Pro Max e 15 Pro Max (430), Pixel 5 (393), Pixel 7 (412), Galaxy S8 (360), S9+ (320), S20 (360), S20 Ultra (412), Android piccolo (Moto G4, 360), iPad Mini (768), iPad Air (820), iPad Pro 11 (834), iPad Pro 13 (1024). In orizzontale: iPhone SE, iPhone 12, 15 Pro Max, Pixel 7, Galaxy S8, iPad Mini, iPad Air, iPad Pro 11. Computer: 1024, 1280, 1440 (anche retina), 1920. In più le soglie del menu: 359, 360, 734, 735, 999, 1000. In tutto 37 profili.
- Firefox: 11 larghezze da 320 a 1920. WebKit: 11 finestre da 447 a 1920.

---

## Bug veri (dal più grave)

### 1. Safari: il mosaico YouTube ritaglia male le due foto piccole

- **Dove si vede**: WebKit (Safari su Mac e iPad, e iPhone in orizzontale da 735 px in su), da 735 px in su. Al telefono in verticale è giusto. Chrome e Firefox giusti.
- **Cosa succede**: le due foto di destra («archie_tartufo» e «archie_corre») invece di essere alte 240 px sono alte quanto tutto il mosaico (486 px) e poi tagliate dal riquadro. Si vede un ritaglio stretto e alto: del tartufo in mano resta il muso del cane e la camicia, dei porcini restano i cappelli senza gambo.
- **Prova**: misure in WebKit a 1440: `.m2` 365×486 e `.m3` 365×486 (in Chrome 365×240). Screenshot `screenshot-2026-10-23/04-mosaico-youtube-chrome-sopra-webkit-sotto.jpg` (sopra Chrome, sotto WebKit).
- **Riga**: 253-255 (`.mosaico`, `.mosaico img`, `.mosaico .m1`). WebKit non risolve `height: 100%` delle immagini dentro righe `1fr 1fr`.
- **Correzione** (provata su WebKit e Chrome a 1440, 768 e 447 px: le foto tornano 365×227, al telefono non cambia niente): mettere le foto in posizione assoluta dentro la loro cella della griglia, al posto della riga 255:

```css
.mosaico { position: relative; }
.mosaico img { position: absolute; inset: 0; }
.mosaico .m1 { grid-area: 1 / 1 / 3 / 2; }
.mosaico .m2 { grid-area: 1 / 2 / 2 / 3; }
.mosaico .m3 { grid-area: 2 / 2 / 3 / 3; }
```

  Unico effetto collaterale: al computer il mosaico diventa alto 460 px (il suo `min-height`) invece di 486. Ho provato anche le correzioni più semplici (`minmax(0, 1fr)`, `align-self: stretch`, `min-height`): su WebKit non bastano.

### 2. «Apri la pioggia del Nord, 30 giorni» apre solo 3 regioni

- **Dove**: riga 397, primo capitolo, su tutti i motori (è la mappa che decide).
- **Cosa succede**: il link passa 9 regioni (`r=piemonte,valledaosta,lombardia,trentino,altoadige,veneto,friuli,liguria,emilia`), ma la mappa ne accetta al massimo 3 scelte (funzione `regioniDalLink` nell'`index.html` della mappa, «tetto delle 3 scelte», 18/10/2026). Riunite le coppie, restano **Piemonte-VdA, Lombardia e Trentino-AA**. Veneto, Friuli, Liguria ed Emilia non si aprono. Il testo del link e la foto sopra («tutto il Nord», scattata col tetto alzato, come dice il commento alla riga 400) promettono di più.
- **Prova**: ho letto il codice della mappa (repo `Mappa-Precipitazioni-Nord`, commit fdfc2fb di oggi) e fatto girare la sua stessa funzione con le regioni del link: esce `[piemonte-vda, lombardia, trentino-aa]`. Da provare comunque dal PC sul sito vero.
- **Correzione** (scelta tua): o il link passa 3 regioni scelte apposta e il testo lo dice (per esempio «Apri la pioggia del Nord-Ovest»: `r=piemonte,valledaosta,lombardia,liguria`, che diventano Piemonte-VdA, Lombardia, Liguria), oppure si alza il tetto nella mappa per i link.

### 3. Con «riduci animazioni» il film si scarica lo stesso

- **Dove**: riga 372 (`if (tolte) v.load();`), su Chrome, Firefox e WebKit.
- **Cosa succede**: con «riduci animazioni» la pagina giustamente non fa partire il film e lascia il poster (righe 358-360: toglie `autoplay`, mette `preload = 'none'`). Ma subito dopo `v.load()` fa ricominciare la scelta della sorgente, e i browser trattano un `load()` esplicito come una richiesta di caricare: scaricano il video lo stesso.
- **Prova**, byte mandati dal server con «riduci animazioni»: Chrome al computer 6,3 MB del 1080 in pochi secondi, Chrome al telefono tutto il 720 (4,6 MB), Firefox tutto il 720 al telefono e 12,8 MB del 1080 al computer, WebKit tutto il 720. Ho isolato la causa con copie della pagina: togliendo solo `autoplay` o mettendo `preload="none"` nell'HTML non cambia niente; saltando solo `v.load()` i byte del video scendono a 0 sia in Chrome sia in Firefox.
- **Correzione**: non chiamare `load()` quando c'è «riduci animazioni»:

```js
if (tolte && !matchMedia('(prefers-reduced-motion: reduce)').matches) v.load();
```

  (meglio ancora: calcolare una volta `var ridotto = …` in cima a quel blocco e usarla in tutti e due i punti).

### 4. Fra 735 e circa 1300 px i riquadri YouTube e quiz non hanno margine

- **Dove**: righe 242-244 (`.yt-blocco, .quiz-blocco`). Tutti i motori. Tocca gli iPad (verticale e orizzontale) e i portatili a 1024 e 1280.
- **Cosa succede**: i due riquadri bianchi hanno `max-width: 1260px` e nessun margine ai lati. Sotto i 1304 px vanno da bordo a bordo, con gli angoli arrotondati tagliati dallo schermo, mentre le foto dei capitoli sopra hanno 22 px di margine. A 1280 il margine è di soli 10 px.
- **Prova**: a 1024 px i riquadri vanno da 0 a 1024, le foto da 22 a 1002. Screenshot `05-riquadri-senza-margine-1024.jpg`.
- **Correzione** (provata a 390, 734, 735, 1024, 1280, 1304, 1440: dal telefono e da 1304 in su non cambia niente):

```css
.yt-blocco, .quiz-blocco { width: calc(100% - 44px); }
@media (max-width: 734px) { .yt-blocco, .quiz-blocco { width: auto; } }
```

### 5. Telefono in orizzontale: il film non sta nello schermo

- **Dove**: righe 160 (`.film`, `min-height: 560px`), 172 (`.vbtn`), 180 (`.scritte`). Tutti i motori.
- **Cosa succede**:
  - Telefoni larghi 735-932 px in orizzontale (iPhone 12-15, Pixel 7, Galaxy S8): prendono il layout del computer, ma lo schermo è alto 340-430 px e il film è alto almeno 560. Nella prima schermata si vede solo il titolo e metà delle pillole; le scritte del film e il tondo stanno sotto, fuori vista, mentre il film gira. In più le scritte «Ogni punto», «La pioggia», «Faggete» toccano il tondo pausa (a 750×340 la riga «Faggete, castagneti, abetaie.» arriva a 736 px, il tondo sta fra 692 e 728).
  - iPhone SE in orizzontale (568×320): prende il layout del telefono, e il film verticale 4:5 è alto 710 px su 320.
- **Prova**: Chrome, profili «landscape»; WebKit e Firefox a 750×340. Screenshot `02-telefono-orizzontale-750x340.jpg` (la pagina intera, le prime 340 righe sono la prima schermata).
- **Correzione**: serve una scelta di disegno. La strada più semplice: una regola per gli schermi bassi, per esempio `@media (min-width: 735px) and (max-height: 500px)`, con il film a tutta altezza (`min-height: 0`), il titolo più piccolo e le scritte più in alto; oppure in orizzontale il film 16:9 a tutta larghezza con il testo sotto, come al telefono.

### 6. Contrasto: la data del film nel piede si legge male

- **Dove**: riga 267, `footer .fonte-film { color: var(--muted-dark); }`. Testo «Il film in apertura usa la pioggia misurata dal 22 settembre al 21 ottobre 2026.».
- **Cosa succede**: `--muted-dark` (#a1a1a6) è pensato per il nero, ma il piede è grigio chiaro (#f5f5f7): contrasto 2,36, ne servono 4,5. Testo da 12 px.
- **Prova**: axe-core, «color-contrast», gravità «serious», al computer e al telefono.
- **Correzione**: `color: var(--muted);` (#6e6e73, contrasto 4,66) oppure togliere la regola e lasciare il colore del piede.

### 7. Contrasto: bianco sul rosso YouTube

- **Dove**: riga 154 (`.nav .links a.nav-yt`, «Iscriviti» nel menu) e riga 250 (`.pill-yt`, «Iscriviti» nel riquadro YouTube).
- **Cosa succede**: bianco su #ff0000 fa 4,0, sotto il 4,5 richiesto per testo piccolo (13 px nel menu, 11,5 px al telefono, 17 px nella pillola). axe lo segna come «serious».
- **Correzione**: un rosso appena più scuro, che a occhio resta «rosso YouTube»: #cc0000 (5,9) o #d40000 (5,5). Il colore al passaggio del mouse (#e00000) fa già 5,0. Se vuoi tenere il rosso esatto del marchio, è un compromesso consapevole: il rischio è solo per chi vede poco.

### 8. Menu a 360 px: nessun margine a destra (rischio)

- **Dove**: riga 280 (`@media (max-width: 359px)`), telefoni Android da 360 px (Galaxy S8, S20, molti Android piccoli). Tutti i motori.
- **Cosa succede**: da 360 px in su il menu mostra «Quiz esame tartufi» per intero. Le quattro voci arrivano già al minimo dello spazio fra loro (8 px) e sforano il margine di destra: con Roboto (Android) «Iscriviti» finisce a 353 px, cioè 7 px dal bordo contro i 16 di sinistra; con Helvetica o Arial a 352. Basta un carattere un po' più largo per farlo uscire: con Inter (simile a SF Pro) esce dallo schermo di 10 px a 360 e resta a meno di 16 px dal bordo fino a 389. Lo stesso succede se la persona ha ingrandito i caratteri del telefono.
- **Prova**: misure del menu a 19 larghezze con 4 caratteri diversi. Screenshot `01-menu-360-chrome-inter.jpg` (con Inter: «Iscriviti» tagliato a destra).
- **Correzione**, due strade: alzare la soglia di «Quiz» corto da 359 a 389 px (`@media (max-width: 389px)`, così da 360 a 389 il menu ha di nuovo il suo margine; a 390 e oltre lo spazio fra le voci è già 15 px con Roboto); oppure tenere la voce lunga e stringere il resto sotto i 390 px (per esempio `.nav .in { padding: 0 12px; }` e `.nav .links a { font-size: 11px; }`), ma con Inter non basta.

---

## Dubbi (da decidere, non rotti)

1. **Scritte del film al telefono su sfondo chiaro.** Il testo è sottile (peso 300) e piccolo (19 px). Dove sotto c'è la mappa colorata o il satellite il contrasto scende: misurando lo sfondo sotto le scritte, per «Faggete, castagneti, abetaie.» il 10% più chiaro dello sfondo dà 3,8 e l'1% più chiaro 2,8 (al computer 6,4 e 4,5). L'ombra del testo aiuta e a occhio si legge, ma su un telefono al sole è al limite. Idea: al telefono peso 400 invece di 300, o un velo scuro più deciso sotto le scritte.
2. **iPad in verticale.** Prende il film orizzontale da 13,8 MB, ma lo mostra in un riquadro alto e stretto: si vede circa un terzo dell'immagine, la Sicilia è tagliata e la Sardegna finisce sotto «Gratis, senza pubblicità…». Screenshot `06-ipad-mini-verticale-film.jpg`. Idea: usare il film verticale anche per i tablet in verticale (`(orientation: portrait) and (max-width: 1024px)`), ma va rivisto anche il posto delle scritte.
3. **Peso del film.** Con `preload="auto"` il film si scarica tutto anche se la persona scorre via subito: 13,8 MB al computer, 4,6 MB al telefono. Ho provato a ricomprimerlo: CRF 24 toglie solo il 10%, a 30 fotogrammi al secondo non si guadagna niente. È già compresso bene; per scendere davvero servirebbe una risoluzione più bassa per gli schermi non retina.
4. **Foto del mosaico YouTube al telefono.** Le tre foto pesano 481 KB per riquadri larghi 180-366 px (sono 5-9 volte più grandi del necessario a 3x). Versioni da 600-700 px farebbero risparmiare circa 350 KB al telefono.
5. **Poster al telefono.** Il poster orizzontale (6,6 KB) parte prima che lo script lo cambi con quello verticale: due richieste invece di una, e Lighthouse segnala che l'immagine più grande della prima schermata (il poster) si scopre tardi. Poco peso, ma si può evitare con un `<link rel="preload" as="image" href="immagini/apertura-v-poster.webp" media="(max-width: 734px)">`.
6. **Google: parole chiave.** Il `title` è solo «Avventure Micologiche» e l'`h1` «Dove è piovuto davvero.»: nessuna delle parole cercate (pioggia, piogge, pluviometri, funghi, mappa) sta nei due punti che contano di più. Nel testo: «pioggia» 6 volte, «mappa» 7, «pluviometri» 3, «boschi» 4, «previsioni» 4, «funghi» una volta sola (nella frase di YouTube), «piogge» una volta (nella pillola), «mappa delle piogge», «precipitazioni», «meteo» e «porcini» mai. La `description` contiene pluviometri, boschi, mappa. Proposta di titolo: «Mappa delle piogge per i funghi: pluviometri reali, boschi e previsioni | Avventure Micologiche». E «funghi» almeno una volta in un `h2` o nel sottotitolo del film.
7. **Anteprima nei social.** `og:image` è ancora la foto di ovoli e porcini di maggio (`immagini/preview.jpg`), non la mappa. Mancano `twitter:card`, `og:site_name` e `og:locale` (WhatsApp e Facebook vanno bene lo stesso con gli `og:` che ci sono).
8. **Sitemap.** La home ha `lastmod` 2026-10-21 (riga 3 di `sitemap.xml`), ma è cambiata il 23/10. Non c'è `robots.txt`: va bene (vuol dire «tutto permesso»), ma la sitemap si trova solo se è registrata in Search Console.
9. **Link alla mappa nel menu.** «Mappa pluviometrica» e «Previsioni» del menu (righe 335-336) si aprono nella stessa scheda; tutti gli altri link alla mappa nella pagina in una scheda nuova. Va bene tutte e due le cose, ma conviene sceglierne una.
10. **Anello del fuoco sul grigio.** L'anello blu della tastiera (#2997ff, riga 140) sul grigio del piede (#f5f5f7) fa 2,77, sotto il 3 consigliato; sul bianco 3,0, sul nero 7,0. Si vede, ma poco, sui link del piede. Idea: nel chiaro usare `var(--color-link)` (#0066cc).
11. **Avanzi e cose minime.** Le regole `.fine` alle righe 221-223 sono di una sezione che non c'è più e hanno lo stesso nome della classe `fine` del tondo «Riguarda» (oggi non fa danni perché `.vbtn.fine` vince, ma è un tranello per il futuro). Al computer con la finestra più stretta di 735 px il tondo e le scritte usano `125vw` (righe 296-297) che comprende la barra di scorrimento: scendono di circa 15 px rispetto al video (si vede solo su Firefox o Windows con finestra stretta, non sui telefoni). A 320-360 px l'occhiello «SCEGLI LE DATE E GUARDA» mentre entra (spaziatura larga) è più largo dello schermo per circa 0,3 secondi, ma in quel momento è quasi trasparente: non si nota.

---

## Cose a posto

### Telefoni, tablet, computer
- **Nessuno scorrimento orizzontale** su nessuno dei 37 profili in Chrome, né in Firefox, né in WebKit.
- **Menu sulla riga giusta con la voce giusta** a ogni soglia: 320 e 359 «Quiz» senza «Contatti»; 360-734 «Quiz esame tartufi» senza «Contatti»; 735-999 «Quiz» con «Contatti»; da 1000 «Quiz esame tartufi» con «Contatti». Il nome e le voci non si sovrappongono mai. Unico neo il margine a 360 (bug 8).
- **Scritte del film**: dentro il video e dentro lo schermo su tutti i modelli in verticale e al computer, sempre su una riga, mai sopra il titolo o le pillole. Da 735 a 1280 px cominciano un po' nella parte sfumata del video, ma restano su fondo scuro e si leggono.
- **Tondo pausa/«Riguarda»**: dentro il video e senza sovrapposizioni su tutti i modelli in verticale e al computer (in orizzontale vedi bug 5).
- **Testi non tagliati**: nessun titolo, pillola o link esce dal suo spazio (a parte «Iscriviti» del bug 8 con caratteri larghi).
- Pagine intere: `07-pixel7-pagina-intera.jpg`, `08-pc1440-pagina-intera.jpg`.

### Film
| Prova | Chrome | Firefox | WebKit |
|---|---|---|---|
| Al telefono `apertura-v-720.mp4` e poster verticale | sì | sì | sì |
| Al computer `apertura-1080.mp4` e poster orizzontale | sì | sì | sì |
| Parte da solo (muted, playsinline) | sì | sì | sì |
| Si ferma sull'ultima immagine, prima della dissolvenza | 21,40 s | 21,41 s | 21,39 s |
| «Fino alle chiome.» resta, pillola «Riguarda» | sì | sì | sì |
| «Riguarda» riparte da 0 (dopo 1,8 s è a 1,7 s) | sì | sì | sì |
| Pausa e play, etichetta del tondo giusta | sì | sì | sì |
| Fuori schermo si ferma, rientrando riparte | sì | sì | sì |
| Fermato da te, rientrando resta fermo | sì | sì | sì |
| Finito, rientrando resta finito | sì | sì | sì |
| «Riduci animazioni»: poster, niente tondo, niente scritte | sì | sì | sì |

- La dissolvenza al nero nel file comincia a 21,55-21,6 s: il fermo a 21,4 lascia 9-12 fotogrammi di margine. Luminosità dell'immagine finale uguale a quella di 21,0 s su tutti i motori (screenshot `03-fine-film-webkit-firefox-chrome.jpg`).
- **Tempi delle scritte** misurati ogni 50 ms durante la prima visione, confrontati con `SCRITTE_FILM`: ogni scritta compare 0,7 s prima di `da` e sparisce 0,7 s dopo `a` con uno scarto sotto 0,1 s su tutti e tre i motori. Fra la prima e la seconda c'è un incrocio di 0,4 s voluto (una sfuma mentre l'altra entra), quasi invisibile.
- Il file ha il `moov` in testa (parte subito anche da rete lenta). «Riguarda» funziona con il server che regge Range; non ho provato un server senza Range.
- Non provati e da provare dal telefono vero: l'iPhone con «risparmio energetico» attivo (iOS blocca l'autoplay; la pagina in quel caso dovrebbe mostrare il tondo «play», visto che `play()` fallisce e `segna()` lo mette in pausa).

### Immagini
- Tutte caricate dopo lo scorrimento, **nessuna 404**, nessuna stirata (scarto di forma sotto lo 0,2%).
- Al telefono vengono scelte le `tel-*`: 1170 per pioggia e previsioni da 2,6x in su, 780 sotto; boschi e satellite sempre 780 (ce n'è solo una). Al computer 1440 a densità 1, 2880 a densità 2 (anche iPad e telefoni in orizzontale).
- `width`/`height` presenti su tutte, nessuno spostamento della pagina mentre si caricano (CLS 0).
- `alt`: le 5 foto della mappa hanno testi lunghi e precisi; le 4 decorative (mosaico e quiz) hanno `alt=""` e stanno dentro link `aria-hidden` con `tabindex="-1"`: corretto, perché accanto c'è lo stesso link in testo.

### Link
Interni (tutti esistono nel repo e si aprono con 200):

| Link | Esito |
|---|---|
| `/esame-tartufi/` (menu, immagine, «Prova il quiz») | 200, nessun errore JS |
| le 8 regioni (`/esame-tartufi/lombardia/` … `/toscana/`) | 200, nessun errore JS |
| `#top` (nome nel menu) | torna in cima |
| `#piede` («Contatti») | porta al piede, visibile |

Nelle pagine del quiz, in locale, falliscono `/dati-video/data/quiz-video.json` e `/api/classifica`: è previsto (sul sito vero il quiz legge i video da raw.githubusercontent.com e la classifica dal suo server).

Esterni: **non raggiungibili dal cloud, da provare dal PC**. Scritti giusti: tutti `https`, quelli in scheda nuova hanno `target="_blank"` con `rel="noopener"`, `mailto:` corretto.

| Link | Parametri | Note |
|---|---|---|
| mappa (menu, «Storico piogge», «Vai alla mappa») | nessuno | |
| `?r=liguria&m=prev` (menu, «Previsioni», «Apri le previsioni») | `r`, `m=prev` esistono nella mappa | la mappa aspetta la regione fino a 15 s, poi apre le previsioni |
| `?r=…9 regioni…&g=30` | `r` e `g` esistono | ne apre 3, bug 2 |
| `/funghi/` («Le località più bagnate») | | la cartella esiste nel repo della mappa |
| `?boschi=1&r=liguria` | `boschi`, `r` esistono | |
| `?boschi=1&sat=1&r=liguria` | `sat=1` funziona solo insieme a `boschi=1`: c'è | |
| YouTube `@avventuremicologiche?sub_confirmation=1` (menu e riquadro) | giusto | |
| YouTube `/videos`, YouTube, Facebook, Instagram, Suno | | |
| `mailto:avventuremicologiche@gmail.com` | | |

### Errori
- **Console**: zero errori JavaScript e zero avvisi su Chrome (37 profili), Firefox (11 larghezze) e WebKit (11 finestre, raccolti con un ascoltatore iniettato dal server di prova). L'unico errore è la richiesta a Google Tag Manager, bloccata da me apposta.
- **Richieste**: nessuna risposta 4xx/5xx dalla home. Le sole richieste interrotte sono il poster orizzontale al telefono (dubbio 5) e, al computer, la prima richiesta del 1080 che lo script interrompe e rifà con `load()`.

### Google e social
- `title` presente (ma vedi dubbio 6), `description` di 150 caratteri, `canonical` su `https://avventuremicologiche.it/`, `og:title`, `og:description`, `og:image` (1280×720, il file esiste), `og:url`, `og:type`.
- Un solo `h1`. Ordine dei titoli giusto: h1, cinque h2 dei capitoli, h2 «E poi ci siamo noi.», due h3 (YouTube, quiz).
- `lang="it"`, nessun `noindex` (c'è solo nella 404, giusto).
- `sitemap.xml` contiene la home e le 9 pagine del quiz.
- Lighthouse SEO 100 su telefono e computer.

### GA4
- Tag `G-4WLB4PFS69` presente, `config` chiamato; in locale (`localhost`, `127.`, `192.168.`) la misura è spenta come previsto.
- Eventi intercettati in `dataLayer` (navigazione fermata), al computer e al telefono:

| Link cliccato | Evento |
|---|---|
| «Quiz esame tartufi» nel menu | `click_quiz_menu` |
| immagine del quiz | `click_quiz_immagine` |
| «Prova il quiz» | `click_quiz_sezione` |
| ognuna delle 8 regioni | `click_quiz_regione` con `regione` = lombardia, piemonte, emilia-romagna, liguria, campania, lazio, marche, toscana |
| «Storico piogge» (controllo) | nessun evento, giusto |

- Non verificabile dal cloud: che l'evento arrivi davvero a Google prima che la pagina cambi. gtag.js di solito usa `sendBeacon`, quindi dovrebbe; si controlla dal PC con la vista «DebugView» di GA4.

### Accessibilità
- axe-core (WCAG 2.2 AA e buone pratiche): solo le violazioni di contrasto dei bug 6 e 7. Nient'altro di serio.
- Tastiera: 31 elementi raggiungibili col Tab, in ordine logico (menu, pillole, tondo, link dei capitoli, YouTube, quiz, regioni, mail, social), anello del fuoco visibile su tutti (vedi dubbio 10 sul grigio), nessuno finisce sotto il menu fisso.
- Bottone del film con `aria-label` che cambia («Metti in pausa», «Avvia», «Riguarda il filmato»); social con `aria-label`; `nav` con `aria-label="Menu"`; video con descrizione; scritte del film `aria-hidden` (la descrizione del video le copre).
- Contrasti sul nero: grigio dei sottotitoli 8,2, testo del film 13,9, link blu 7,0. Sul film al computer le scritte stanno sopra 4,5 anche nel punto più chiaro.

### Peso e velocità
Pesi reali dei file scaricati (Chrome):

| Profilo | Subito (senza scorrere) | Di cui senza video | Pagina intera | Di cui senza video |
|---|---|---|---|---|
| iPhone 12 (390, 3x) | 4,6 MB | 0,27 MB | 5,7 MB | 1,3 MB |
| iPhone SE 1ª gen (320, 2x) | 4,6 MB | 0,25 MB | 5,6 MB | 1,2 MB |
| Pixel 7 | 4,7 MB | 0,34 MB | 5,7 MB | 1,3 MB |
| Computer 1440 e 1920 (1x) | 13,5 MB | 0,35 MB | 14,9 MB | 1,7 MB |
| Computer retina e iPad | 14,0 MB | 0,80 MB | 16,2 MB | 3,0 MB |

- Subito si scaricano: la pagina (49 KB), il poster (6 KB), il film intero (`preload="auto"`) e la foto del primo capitolo (non è `lazy`: 219 KB al telefono, 300 KB o 762 KB al computer). Tutto il resto solo scorrendo (`loading="lazy"`).
- **Lighthouse** (rete simulata): telefono prestazioni 99, LCP 2,3 s su 4G lenta, FCP 1,0 s, blocchi 0 ms, CLS 0; computer prestazioni 100, LCP 0,6 s. L'elemento LCP è il poster del film. Accessibilità 95 (i contrasti), buone pratiche 100, SEO 100.
- Lighthouse segnala anche compressione e cache dei file: dipendono dal server, il mio di prova non le fa. Da controllare sul sito vero.

### HTML
- Validatore W3C (Nu Html Checker 26.10.12): **nessun errore, nessun avviso**, anche il CSS.
- html-validate: 6 segnalazioni, tutte pignolerie di stile (`autoplay` vietato dalla sua regola, `style` in linea su 4 immagini, `aria-label` su `video`), nessun errore vero.
- Fuori dal perimetro ma visto di passaggio: le 9 pagine del quiz hanno 3 errori W3C ciascuna (`<base>` dopo un `<link>`, due `<img>` senza `src` che lo script riempie dopo). Non fanno danni visibili.
