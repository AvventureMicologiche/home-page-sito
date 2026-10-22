# Film d'apertura: stato

Terza sessione (22/10/2026): ramo `claude/sweet-bell-rbe3jj`, nato da `claude/intelligent-babbage-ckzf3g`.
Si lavora SOLO sul film (`studio-apple/film/`) e sul blocco dei tempi delle scritte in `home-v2/index.html`
(`SCRITTE_FILM`). Immagini HD, previsioni e resto della pagina non si toccano. Il repo della mappa si usa in sola
lettura (un clone qualsiasi, passato con `--mappa <cartella>`).

Il suo giudizio sul film precedente: «non ci siamo, il film iniziale è la base di tutto». Gli era piaciuto molto
l'inizio coi pluviometri; non gli piacevano la pioggia che compariva prima in alcune regioni, lo zoom sulla Liguria
troppo presto e i passaggi. Ha scritto lui la sceneggiatura nuova: qui sotto, seguita alla lettera.

## La sceneggiatura e i tempi (24 s, 60 fps, 1440 fotogrammi)
La telecamera resta **ferma** sull'Italia intera (centro 41,85 N 12,5 E, zoom 6,62: la stessa inquadratura
dell'inizio di prima) per 11,6 secondi, finché il satellite non è comparso. Tutti i tempi stanno in un solo
oggetto, `T` in `tools/racconto.js`.

| secondi | cosa |
|---|---|
| 0-2,6 | **l'Italia scura, i pluviometri si accendono**: identico a prima (un pluviometro ogni cinque, 649 pallini, comparsa scaglionata) |
| 2,4-5,0 | **la pioggia compare uniforme su tutta l'Italia nello stesso momento**: una griglia sola, il cumulato vero dei 30 giorni (22/9-21/10) levigato, che sale con un'opacità globale (smootherstep da 0 a 1). I pallini sfumano mentre sale (3,0-5,0) |
| 5,0-6,2 | **pausa** con la pioggia piena |
| 6,2-9,0 | **la pioggia sfuma e compaiono i boschi** su tutta l'Italia (pioggia 6,2-7,8, boschi 7,0-9,0): la pioggia è a zero (7,8 s) prima che i boschi arrivino a metà (8,0 s). Con i boschi la terra prende il rilievo della mappa |
| 9,0-9,4 | i boschi da soli |
| 9,4-11,4 | **sotto i boschi sfuma dentro il satellite**: la terra scura diventa foto aerea, ritagliata sul contorno dell'Italia (mare e paesi vicini restano neri); il rilievo se ne va |
| 11,6-22,8 | **lo zoom**: una sola curva di van Wijk e Nuij (ρ = 1,42) dall'Italia intera alle chiome, col tempo in smootherstep (velocità e accelerazione zero alla partenza e all'arrivo). Il retino dei boschi sparisce man mano: opacità legata al livello di zoom raggiunto, piena all'inizio, zero ai due terzi (zoom 12,6, a 17,6 s); poi satellite puro |
| 22,8-23,0 | fermi sulle chiome |
| 23,0-24,0 | **loop**: dissolvenza dall'ultimo fotogramma al primo, senza scatto |

Previsioni: fuori dal film, per ora («al resto ci arriviamo»).

**Le scritte della pagina** (`SCRITTE_FILM` in cima a `home-v2/index.html`; `da`-`a` = piena, entra ed esce in 0,6 s):

| scritta | piena da-a | sopra |
|---|---|---|
| «Migliaia di pluviometri veri.» | 0,6-2,4 | i pluviometri |
| «La pioggia caduta davvero.» | 3,6-6,0 | la pioggia che sale e la pausa |
| «Sui boschi giusti.» | 7,6-9,4 | i boschi |
| «Come sono davvero, dal satellite.» | 10,7-21,8 | il satellite e lo zoom |

### Perché così
- **Una griglia sola, levigata.** Lui: non gli interessa la pioggia giorno per giorno, gli interessa che sembri
  reale. `griglie.py` scrive anche `pioggia-2026-09-22-30g-liscia`: il cumulato finale dei 30 giorni con una
  gaussiana di 0,03° (circa 3 km), normalizzata sulla terra (il mare non entra, la costa non sbiadisce). Scioglie
  gli «occhi di bue» che l'IDW lascia attorno a ogni stazione; scarto dal cumulato vero: 2,1 mm in media, entro
  8,2 mm nel 95% delle celle (il massimo scende da 385 a 306 mm: erano picchi di una cella sopra una stazione).
  Si cambia con `--liscia` di `griglie.py` (0 = il cumulato vero, senza levigare).
- **Opacità globale, niente «fioritura» dai pallini.** La fioritura attorno ai pallini avrebbe riempito prima le
  regioni dove le stazioni sono fitte (Toscana, Lombardia) e dopo quelle rade (interno dell'Abruzzo, Sardegna): di
  nuovo una regione prima dell'altra. Con un'opacità sola la pioggia è la stessa immagine dall'inizio alla fine e
  sale uguale ovunque: misurato, vedi «Misure».
- **I boschi a tutta Italia ci sono e si leggono.** Le tessere della mappa vanno dallo z5 allo z13; a zoom 6,62 il
  motore usa lo z7 (con la dissolvenza fra livelli): macchie dei tipi di bosco ben leggibili (faggete verdi sugli
  Appennini, querceti gialli, abetaie blu sulle Alpi). Nessun livello sostituito.
- **Niente fotogramma fangoso**: la pioggia scende a zero in 1,6 s e i boschi passano metà solo dopo; nel momento di
  mezzo (7,4-7,8 s) c'è poca pioggia, pochi boschi e la terra grigia pulita.
- **Il satellite ritagliato sull'Italia**: senza ritaglio, a tutta Italia sarebbero comparsi d'improvviso Francia,
  Balcani e il mare; così la terra scura «diventa» foto aerea e il resto resta nero come all'inizio.
- **Lo zoom parte da fermo**: smootherstep sul cammino di van Wijk e Nuij, nessuno strappo dopo 11 s di
  telecamera ferma. Velocità massima circa 1,4 livelli al secondo a metà volo; quando corre, le tessere hanno un
  mosso leggerissimo (al massimo 1,2 px), come una cinepresa.

### Il punto d'arrivo (si cambia con un parametro)
**43,869 N 11,809 E, zoom 15,6**: la faggeta, con macchie di abete bianco, sul crinale fra Campigna e Sasso Fratino,
nel Parco nazionale delle Foreste Casentinesi, Monte Falterona e Campigna. Perché: è uno dei boschi più grandi e
compatti dell'Appennino (nelle tessere dei boschi della mappa è faggeta piena per più dei 4 x 2,4 km inquadrati alla
fine), e Sasso Fratino è riserva integrale dal 1959 e patrimonio UNESCO: lì non entra nessuno, tanto meno a
raccogliere. Generico, mai un posto di raccolta. A zoom 15,6 un pixel è circa 2 m: si vedono le chiome.
Per cambiarlo: `--bosco lat,lon,zoom` sia a `scarica-satellite.js` sia a `film.js` (lo stesso valore), oppure
`BOSCO_PREDEFINITO` in `tools/racconto.js`.

## Il satellite
- **Dal cloud non si raggiunge** (il proxy chiude `server.arcgisonline.com`, anche EOX): nel cloud il film si fa col
  **segnaposto**, una foto aerea finta disegnata dal motore (campi fra oliva e ocra, boschi verde scuro dove la mappa
  ha bosco, chiome da vicino, ombre del rilievo della mappa), scura, con la scritta piccola «segnaposto satellite» in
  basso a destra. Serve solo a giudicare i tempi.
- **Dal PC**: `scarica-satellite.js` scarica UNA volta le tessere Esri World Imagery (le stesse della mappa) in
  `cache/satellite/<z>/<y>/<x>.jpg`: sono **1.417 tessere, circa 30 MB** (z6-z16), solo quelle che il film chiede
  davvero, fotogramma per fotogramma, e solo dove c'è l'Italia. Stampa numero e MB prima di partire; se si
  interrompe si rilancia e riparte da dov'era. Poi `film.js --satellite` le legge solo da lì: se ne manca anche una
  si ferma prima di cominciare e dice di rilanciare lo scaricatore. **Le tessere non vanno mai nel repo** (sono di
  Esri; `cache/` è in `.gitignore`).
- Provato nel cloud con tessere finte numerate al posto di quelle Esri: il film le legge da `cache/satellite`, sfuma
  fra i livelli, ritaglia sull'Italia, nessuna tessera mancante.

## Dal PC
Windows, PowerShell o Prompt dei comandi. Serve: Git, Node 18 o più recente, Python 3 (con `python` nel PATH), Chrome,
ffmpeg (quello di CapCut va bene se ha un codificatore H.264, vedi sotto). Circa 5 GB liberi per i fotogrammi PNG.

**Una volta sola (circa 5 minuti):**
```
cd C:\percorso\home-page-sito
git fetch origin
git checkout claude/sweet-bell-rbe3jj
git pull
git clone --depth 1 --filter=blob:none https://github.com/AvventureMicologiche/Mappa-Precipitazioni-Nord C:\mappa
npm install --prefix studio-apple/film
python -m pip install numpy scipy shapely pillow matplotlib
```
(`npm install --prefix studio-apple/film` installa solo `playwright-core` in `studio-apple/film/node_modules`: non
scarica nessun Chromium, si usa il Chrome già installato.)

**Il satellite (circa 2-5 minuti, 30 MB):**
```
node studio-apple/film/tools/scarica-satellite.js --mappa C:\mappa
```
Se si interrompe, si rilancia uguale.

**Il film (circa 25-40 minuti):**
```
node studio-apple/film/tools/film.js --satellite --mappa C:\mappa --chrome "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" --ffmpeg "C:/Users/admin/AppData/Local/CapCut2/Apps/1.5.0.230/ffmpeg.exe"
```
Fa tutto: la griglia della pioggia la prima volta (`griglie.py`, 30 s), i 1.440 fotogrammi in `film/frames/`
(stampa ogni secondo di film quanto manca), poi `apertura-1080.mp4`, `apertura-720.mp4`, `apertura-poster.webp`,
gli stills, `fluidita.png` e `uniformita.png`. Se si interrompe, rilanciare lo stesso comando: salta i fotogrammi già
fatti (con la stessa fonte del satellite e lo stesso bosco).

**Controllo e consegna (2 minuti):**
```
node studio-apple/verify.js --v2
git add studio-apple/film
git commit -m "film: satellite vero dal PC"
git push
```
`git add studio-apple/film` non prende né `cache/` (le tessere Esri) né `frames/`: sono in `.gitignore`.

**Se ffmpeg non ha libx264** (le versioni dentro i programmi a volte non ce l'hanno): `film.js` lo dice e usa il primo
codificatore H.264 che trova (`h264_mf` di Windows, `h264_nvenc`, `h264_qsv`, `h264_amf`, `libopenh264`) in una
passata. Per vedere cosa ha: `"C:/Users/admin/AppData/Local/CapCut2/Apps/1.5.0.230/ffmpeg.exe" -hide_banner -encoders | findstr 264`.
Per la qualità migliore: ffmpeg «essentials» da https://www.gyan.dev/ffmpeg/builds/ (ha libx264), poi solo la codifica:
`node studio-apple/film/tools/film.js --solo-codifica --ffmpeg C:/ffmpeg/bin/ffmpeg.exe`.
Se Python non si chiama `python`: `--python "C:/.../python.exe"` (vale anche per le misure).

Altri comandi:
```
node studio-apple/film/tools/film.js --mappa C:\mappa --prova 0,5,10,16        qualche fotogramma, in film/prova/
node studio-apple/film/tools/film.js --mappa C:\mappa --da 300 --a 420         solo quei fotogrammi
node studio-apple/film/tools/film.js --solo-codifica                          rifà mp4, poster, stills e misure
node studio-apple/film/tools/scarica-satellite.js --solo-conta                 quante tessere servono, senza scaricare
```

## Come è fatto (file in `tools/`)
- `racconto.js`: la sceneggiatura (tempi `T`), la telecamera (van Wijk e Nuij), la lista delle tessere che il film
  chiede (la usano sia `film.js` sia `scarica-satellite.js`, così sono la stessa), l'Italia in tessere dello z12.
- `motore.js`: apre la mappa vera in Chrome senza interfaccia e disegna una scena (come nelle sessioni prima: la
  `drawGrid()` della mappa, le sue tessere di boschi e rilievo, niente arrotondamenti al pixel). Nuovo: satellite da
  `cache/satellite`, ritaglio sull'Italia, segnaposto, la griglia ridisegnata solo quando cambia, e `scena()` dice
  quali immagini non sono arrivate: `film.js` riprova una volta e poi si ferma, mai un fotogramma con un buco.
- `film.js`: prima di scattare scarica tutte le tessere di boschi e rilievo che servono e controlla il satellite;
  poi i fotogrammi, la codifica (libx264 in due passate come prima, 2,6 Mbit/s di media), le misure.
- `comune.js`: parametri, rete (`fetch` di Node, niente `curl`/`sleep`), il server della cartella della mappa
  (niente più `python -m http.server` in un'altra finestra), Chrome, ffmpeg, la griglia se manca.
- `scarica-satellite.js`, `griglie.py` (ora con `--liscia` e i file aperti in UTF-8, se no su Windows i nomi accentati
  delle stazioni lo fermavano), `fluidita.py`, `uniformita.py`, `foto.js` (le immagini HD: non rifatte; adattato solo
  al motore nuovo).
- Nel cloud, dietro il proxy, i comandi con rete vanno lanciati con `NODE_USE_ENV_PROXY=1` (dal PC non serve).

## Misure
_(dal render nel cloud, col segnaposto: vedi sotto)_

## Storia (sessioni precedenti, in breve)
- **Rete dal cloud** (provata il 22/10/2026): Esri, EOX, previsioni di produzione, Open-Meteo, OpenStreetMap, Google,
  jsDelivr chiusi; `raw.githubusercontent.com` e `github.com` aperti (dati delle stazioni, tessere boschi e rilievo).
- **I puntini neri nella pioggia** (seconda sessione), tutti risolti in `griglie.py`: le esclusioni a mano della
  mappa (`LOMB_ESCLUSE`, `PIEMONTE_ESCLUSE`, `LIGURIA_ESCLUSE`, `EMILIA_ESCLUSE`, `TOSCANA_ESCLUSE`, `MH_ESCLUSE`)
  e i doppioni MeteoHub del Friuli; 32 pluviometri sordi nel periodo (sotto il 15% della mediana dei cinque vicini,
  soprattutto in Sicilia); San Marino, che era un buco nel contorno.
- **Fluidità** (seconda sessione): tessere composte solo quando sono arrivate tutte, dissolvenza continua fra i
  livelli, niente arrotondamenti al pixel (costa e confini compresi).
- **Immagini HD** (`foto/`) e **pagina** (`home-v2/`): vedi la cronologia del ramo `claude/intelligent-babbage-ckzf3g`.
  Non toccate in questa sessione. ⚠️ `foto.js` ora vuole anche lui `--mappa <cartella>` (il motore accende da solo il
  server della mappa).

## Da fare / da decidere
- [ ] **Dal PC**: il satellite vero (i comandi sopra). Fino ad allora il film ha il segnaposto.
- [ ] Le previsioni nel film: fuori per ora.
- [ ] Telefono: il film è 16:9 e al telefono l'Italia viene piccola. Se piace l'idea, una versione 4:5.
