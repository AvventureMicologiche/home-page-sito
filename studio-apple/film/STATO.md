# Film d'apertura e immagini HD: stato

Ramo `claude/dreamy-albattani-g6zdi2` (nato da `claude/dazzling-goldberg-dblun0`).
Si lavora solo in `studio-apple/film/` e `studio-apple/home-v2/`. Il repo della mappa si usa in sola lettura.

## Fatto
- [x] `tools/griglie.py`: la pioggia vera, giorno per giorno, con la stessa interpolazione della mappa.
- [x] `tools/motore.js`: apre la mappa vera in Chromium, toglie tutta l'interfaccia, disegna una scena.
- [x] `tools/film.js`: il film, fotogramma per fotogramma (in corso il primo render completo).

## Da fare
- [ ] Passo 1: guardare gli stills, correggere, codificare (`apertura-1080.mp4`, `apertura-720.mp4`, `apertura-poster.webp`).
- [ ] Passo 2: immagini HD (`tools/foto.js`).
- [ ] Passo 3: `home-v2/index.html`.
- [ ] Passo 4: `verify.js` esteso al v2, screenshot in `film/screenshot/`.

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
