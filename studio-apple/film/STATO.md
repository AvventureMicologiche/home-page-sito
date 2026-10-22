# Film d'apertura e immagini HD: stato

Ramo `claude/dreamy-albattani-g6zdi2` (nato da `claude/dazzling-goldberg-dblun0`).
Si lavora solo in `studio-apple/film/` e `studio-apple/home-v2/`. Il repo della mappa si usa in sola lettura.

## Passo 0: la rete dal cloud (provata il 22/10/2026, seconda sessione, ramo `claude/intelligent-babbage-ckzf3g`)
| Fonte | Esito |
|---|---|
| Satellite Esri `server.arcgisonline.com` (World_Imagery), anche `services.arcgisonline.com` | ❌ chiuso (il proxy risponde 403 al CONNECT) |
| Sentinel-2 cloudless EOX `tiles.maps.eox.at` (e `s2maps-tiles.eu`) | ❌ chiuso |
| Previsioni di produzione `https://precipitazioni.avventuremicologiche.it/api/previsioni` (e tutto il dominio) | ❌ chiuso |
| Open-Meteo, MET Norway, OpenStreetMap, Google, NASA GIBS, jsDelivr | ❌ chiusi |
| `raw.githubusercontent.com`, `github.com` (git) | ✅ aperti: dati delle stazioni, tessere boschi e rilievo |

Quindi nel cloud satellite e previsioni sono **segnaposto**, e dal PC basta un comando per ciascuno (vedi in fondo,
«Cosa va lanciato dal PC»). Il ponte per le previsioni è già nel motore: la mappa clonata, in locale, chiede
`http://127.0.0.1:8788/api/previsioni` (così è scritto nel suo `index.html`); `motore.js` intercetta quella richiesta
e la gira a `https://precipitazioni.avventuremicologiche.it/api/previsioni` (produzione), che accetta le origini locali.

## Fatto
- [x] `tools/griglie.py`: la pioggia vera, giorno per giorno, con la stessa interpolazione della mappa.
- [x] `tools/motore.js`: apre la mappa vera in Chromium, toglie tutta l'interfaccia, disegna una scena.
- [x] `tools/film.js`: il film, fotogramma per fotogramma.
- [x] **Passo 1**: `apertura-1080.mp4` (4,31 MB), `apertura-720.mp4` (1,43 MB), `apertura-poster.webp` (primo fotogramma),
      `stills/` (uno ogni 2 s). 1920x1080, 60 fps veri, 14 s, 840 fotogrammi, muto, H.264 High, CRF 16 con tetto di banda
      (2,6 Mbit/s il 1080, 0,82 il 720: senza tetto i boschi pesavano troppo), yuv420p, BT.709, range TV, faststart.
      Controlli fatti: stills guardati uno per uno (niente interfaccia, niente buchi), differenza fra fotogrammi
      consecutivi senza picchi, ultimo fotogramma = primo (loop senza scatto).
- [x] **Passo 2**, quattro immagini su cinque in `foto/` (WebP qualità 82, 2880 e 1440):
      `pioggia-italia` (61 e 27 KB), `boschi-vicino` (394 e 184 KB, sopra il rilievo), `finestra-funghi` (Toscana,
      2-9 ottobre = 13-20 giorni prima del 22/10; 76 e 34 KB), `scheda-stazione` (Piampaludo, la scheda vera della
      mappa ingrandita; 127 e 63 KB). Tutte sotto i limiti (600 e 250 KB).

## Da fare
- [ ] **Dal PC** (rete aperta): `node studio-apple/film/tools/foto.js boschi-vicino --satellite` per i boschi sopra
      la foto aerea (nel cloud i server Esri sono chiusi), e l'immagine delle **previsioni**: nel cloud non si può,
      la mappa le chiede a `/api/previsioni` (funzione Netlify che va su Open-Meteo, chiuso). Fino ad allora la
      home v2 usa `immagini/poster-previsioni.jpg` (vecchia, piccola). Nel film si può aggiungere il satellite allo
      stesso modo (opzione da portare in `film.js`).
- [ ] Telefono: il film è 16:9 come chiesto e al telefono l'Italia viene piccola. Se piace l'idea, una versione
      quadrata o 4:5 per il telefono (ritaglio centrale: l'Italia ci sta intera, della Liguria si perdono le punte).
- [ ] Decidere colore d'azione (blu, verde, oro: un blocco in cima al CSS del v2) e testi definitivi.

- [x] **Passo 3**: `home-v2/index.html` (28 KB). Il film a tutto schermo (al computer occupa i due terzi a destra e
      sfuma nel nero, il testo sta a sinistra sul mare; al telefono il film sta intero in 16:9 e il testo sotto),
      cinque capitoli uno per schermata con un'immagine ciascuno, la chiusura, «E poi ci siamo noi» (YouTube e quiz
      con gli 8 link alle regioni), il piede del v1. Comparse lente dal basso con `--ease-brand`. Il capitolo
      «E domani.» ha un segnaposto finché non c'è l'immagine delle previsioni.
      Apertura senza il film: 288 KB a 1440, 351 KB a 390 (limite 1 MB).
      ⚠️ `<source media>` dentro `<video>` Chromium lo ignora: uno script in linea subito dopo il video toglie la
      sorgente sbagliata, così al telefono arriva davvero il 720.
- [x] **Passo 4**: `node studio-apple/verify.js --v2` (25 controlli: pesi, sorgente giusta per lo schermo, zero errori,
      zero richieste esterne, niente scorrimento orizzontale a 390, immagini caricate dopo lo scorrimento, comparse,
      link, testi senza trattini lunghi né punti esclamativi, poster con «riduci animazioni»). 25/25; l'intero
      `verify.js` 73/73. Screenshot a 1440 e 390 di ogni capitolo in `film/screenshot/`.
      Nota: il Chromium di Playwright non decodifica H.264, quindi nello screenshot il film è sostituito da uno still.

## Le scelte del film
- **Periodo**: 22 settembre → 21 ottobre 2026, cioè «30 giorni» com'erano il 22/10. È la finestra più recente
  e la pioggia è arrivata davvero su tutta Italia (7-12 ottobre, poi il 20 e il 21 ottobre, quest'ultimo il giorno
  più bagnato del periodo: media 25 mm sulle 3.457 stazioni italiane). La prima metà è quasi asciutta: nel film
  l'Italia resta scura per tre secondi e poi si accende, ed è il racconto giusto.
- **Regione**: la Liguria, la più bagnata del periodo (mediana 164 mm, il 99% delle stazioni sopra i 60 mm), e
  con un arco che riempie bene un 16:9. Si vede la regione intera, nessun posto preciso.
- **Sfondo**: nessuna cartina con le scritte. Mare nero, Italia grigio scurissimo (`#1b1b1d`) disegnata dai confini
  della mappa stessa (`italia-regioni-confine.geojson`, regioni unite), i confini fra regioni a filo appena visibile.
  Quando si arriva in Liguria la terra si schiarisce (`#3c3c3f`) e sale il rilievo della mappa (TINITALY, le sue
  tessere `rilievo/`), poi i boschi (tessere `boschi/`, opacità 0,7 come nella mappa).
  Il satellite non c'è: dal cloud i server delle foto aeree (Esri) sono chiusi dalla rete. Si può aggiungere dal PC.
- **Racconto, 14 s a 60 fps (840 fotogrammi)**:
  0-0,5 s Italia scura; 0,5-6,9 s i 30 giorni, uno ogni 0,21 s, con dissolvenza fra un giorno e il successivo
  (si interpola il cumulato cella per cella); la telecamera si avvicina appena. 6,4-11 s volo sulla Liguria
  (curva di van Wijk e Nuij, la stessa di `flyTo` di Leaflet, con tempo «smootherstep»), che continua in una deriva
  lenta fino alla fine: il movimento non si ferma mai. 9,7-12,7 s i boschi si accendono dove è piovuto, prima dove è
  piovuto di più (soglia da 320 a 25 mm sul cumulato), mentre la pioggia si spegne; il rilievo sale solo quando la
  pioggia è quasi sparita (regola della mappa: mai il rilievo sotto la pioggia piena). 13,2-14 s dissolvenza sul
  primo fotogramma: il loop si richiude senza scatto.
- **Il testo** non è nel video: lo mette la pagina sopra.
- **Il poster** è il primo fotogramma come chiesto: l'Italia scura senza pioggia. Se per chi ha «riduci animazioni»
  si preferisce l'Italia già bagnata, basta generare il poster dal fotogramma 414 (6,9 s).
- **Fluidità**: Leaflet arrotonda al pixel intero l'origine della mappa, i vettori e i livelli di tessere; con una
  deriva di 0,1-0,2 px a fotogramma l'immagine tremava di un pixel. Nel render i tre arrotondamenti sono tolti
  (`motore.js`, in pagina, non nel repo della mappa): misurato dopo, lo spostamento fra fotogrammi è costante.

## Fedeltà alla mappa
- La pioggia è disegnata dalla `drawGrid()` della mappa (sua scala di colori, opacità 0,7, sfumatura, fasce di
  Mercatore, ritaglio sul confine). Per raggiungerla, durante il render si aggiunge una riga a `index.html` **nella
  risposta del server locale** (`window.__film = {...}` dopo `window._mapDebug=map;`): il repo resta intatto.
- La griglia è quella di `buildGrid()`: IDW 1/d², raggio 0,35°, veto locale (stazione entro 6 km sotto 1 mm = 0),
  stazioni con almeno il 60% dei giorni della loro rete. Passo 0,01° (più fine di quello che la mappa usa sull'Italia
  intera, perché da vicino non si vedano quadretti). 3.482 stazioni.
- Due aggiunte, solo per l'immagine, scritte in testa a `griglie.py`: dove la stazione più vicina è oltre 0,22° il
  valore sfuma verso un'IDW a 0,8° (sempre stazioni vere; serve all'interno dell'Abruzzo, che la mappa copre con
  Open-Meteo dal vivo, irraggiungibile dal cloud); la griglia sborda di 0,04° in mare perché la costa resti netta.
- Le stazioni a zero che fanno «buco» (veto) restano: sono la mappa vera (si vedono in Sicilia nei primi giorni).

## Come si prova la pagina
```
python -m http.server 8000        # dalla radice del repo
```
poi `http://localhost:8000/studio-apple/home-v2/`.

## Come si rilancia (dal PC o dal cloud)
```
git clone --depth 1 --filter=blob:none https://github.com/AvventureMicologiche/Mappa-Precipitazioni-Nord /tmp/mappa
cd /tmp/mappa && python3 -m http.server 8899 --bind 127.0.0.1        # in un'altra finestra
pip install numpy scipy shapely                                      # una volta
python3 studio-apple/film/tools/griglie.py --mappa /tmp/mappa --da 2026-09-22 --giorni 30
node studio-apple/film/tools/film.js                 # fotogrammi in film/frames/ (riprende da dove era), poi codifica
node studio-apple/film/tools/film.js --prova 0,7,11  # solo qualche secondo, in film/prova/
node studio-apple/film/tools/film.js --solo-codifica # rifà mp4, poster e stills dai fotogrammi
```
Su Windows il percorso `/tmp/mappa` va sostituito (opzione `--mappa` di `griglie.py`, e il server sulla cartella).
Serve Playwright con Chromium (`npm i -D playwright && npx playwright install chromium`) e ffmpeg
(o `pip install imageio-ffmpeg`). `cache/` e `frames/` non vanno nel repo (`.gitignore`): si rifanno.
Le tessere dei boschi e del rilievo si scaricano da raw.githubusercontent.com in `cache/tessere/`.
Un fotogramma costa circa 0,25 s; il film intero 4-5 minuti.
