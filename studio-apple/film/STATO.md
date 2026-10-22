# Film d'apertura e immagini HD: stato

Seconda sessione (22/10/2026): ramo `claude/intelligent-babbage-ckzf3g`, nato da `claude/dreamy-albattani-g6zdi2`.
Si lavora solo in `studio-apple/film/` e `studio-apple/home-v2/`. Il repo della mappa si usa in sola lettura
(clone in `/tmp/mappa`; le modifiche stanno solo nella risposta del server locale o nel CSS/JS iniettato da `motore.js`).

## Passo 0: la rete dal cloud (provata il 22/10/2026)
| Fonte | Esito |
|---|---|
| Satellite Esri `server.arcgisonline.com` (World_Imagery), anche `services.arcgisonline.com` | ❌ chiuso (il proxy risponde 403 al CONNECT) |
| Sentinel-2 cloudless EOX `tiles.maps.eox.at` (e `s2maps-tiles.eu`) | ❌ chiuso |
| Previsioni di produzione `https://precipitazioni.avventuremicologiche.it/api/previsioni` (e tutto il dominio) | ❌ chiuso |
| Open-Meteo, MET Norway, OpenStreetMap, Google, NASA GIBS, jsDelivr | ❌ chiusi |
| `raw.githubusercontent.com`, `github.com` (git) | ✅ aperti: dati delle stazioni, tessere boschi e rilievo |

Quindi nel cloud satellite e previsioni sono **segnaposto** (con una scritta piccola in basso a destra che lo dice,
nel film e nelle due immagini), e dal PC basta un comando (vedi «Cosa va lanciato dal PC»).
- **Satellite**: `motore.js` disegna le tessere Esri World Imagery (le stesse della mappa del test) sotto i boschi;
  senza rete al loro posto c'è il rilievo scuro. Le tessere scaricate restano in `cache/satellite/`.
- **Previsioni**: `motore.js` scarica `/api/previsioni?capoluoghi=liguria` dalla produzione in
  `cache/previsioni-liguria.json` e disegna le targhette con lo stile della mappa (`.pv-m`: icona, nome, massima e
  minima di domani). C'è anche il **ponte**: la mappa clonata, in locale, chiede `http://127.0.0.1:8788/api/previsioni`
  (così è scritto nel suo `index.html`); `motore.js` intercetta quella richiesta e la gira alla produzione (opzione
  `ponteprevisioni` di `apri()`, per chi vuole fotografare la mappa vera in modo previsioni). Senza rete il
  segnaposto mostra i capoluoghi veri (`data/capoluoghi.json` della mappa) col solo nome.

## Fatto in questa sessione
- [x] **Passo 0**: rete provata e scritta qui sopra.
- [x] **I puntini neri nella pioggia**: erano tre cose diverse, tutte risolte.
  1. **Pluviometri guasti che la mappa tiene fuori e `griglie.py` no.** La mappa ha liste scritte a mano
     (`LOMB_ESCLUSE`, `PIEMONTE_ESCLUSE`, `LIGURIA_ESCLUSE`, `EMILIA_ESCLUSE`, `TOSCANA_ESCLUSE`, `MH_ESCLUSE`):
     `griglie.py` non le leggeva, e un pluviometro fermo a zero, col **veto** (stazione entro 6 km sotto 1 mm =
     punto a 0), faceva un buco trasparente, cioè nero sulla terra scura. Esempi: Cantagallo (Prato, sull'Appennino
     verso Bologna, 0 mm in 30 giorni con i vicini a 49), Benevento, Ponte S.Maria. Ora `griglie.py` legge le liste
     dall'`index.html` della mappa e le applica con le stesse chiavi; toglie anche i doppioni MeteoHub del Friuli
     entro 1 km da OSMER, come la mappa.
  2. **Pluviometri sordi nel periodo** (soprattutto in **Sicilia**: Palermo UIR, Cefalù, Menfi, Ganzirri e altri 20):
     hanno consegnato zeri, o non hanno consegnato proprio i giorni di pioggia, mentre intorno pioveva 25-180 mm.
     La mappa li mostra (passano la copertura del 60%), e anche lei li vede come buchi. Solo per l'immagine si tolgono
     con la regola del controllo automatico della mappa (`check-stazioni-ferme.js`: sotto il 15% della mediana dei
     cinque vicini), con i vicini ad almeno 20 mm; più gli zeri secchi (sotto 1,5 mm e sotto il 20% dei vicini, con
     i vicini ad almeno 5 mm: era il buco di Comacchio). 32 stazioni in tutto, elencate da `griglie.py` quando gira.
  3. **San Marino** (il puntino nero vicino a Rimini): non è una regione italiana, nel contorno dell'Italia era un
     buco e il ritaglio «evenodd» della mappa lo lasciava nero. Ora il contorno tiene solo i bordi esterni.
  Restano senza pioggia solo Lampedusa, Linosa e Lampione (piove poco davvero, e stanno fuori inquadratura).
- [x] **Passo 1, il film rifatto per la fluidità** (`tools/motore.js`, `tools/film.js`): vedi «Il film» sotto.
- [x] **Passo 2, le immagini HD** in `foto/` (WebP qualità 82, 2880 e 1440): vedi «Le immagini» sotto.
  La finestra «piogge per funghi» è tolta (immagine, capitolo e ogni riferimento), come chiesto.
- [x] **Passo 3, la pagina `home-v2/index.html`**: vedi «La pagina» sotto. `verify.js --v2` esteso.

## Il film (`apertura-1080.mp4`, `apertura-720.mp4`, `apertura-poster.webp`, `stills/` uno al secondo)
1920x1080, 60 fps veri, **24 s**, 1440 fotogrammi, muto, H.264 High, CRF 17 (720: CRF 18), preset slow, tune film,
yuv420p, BT.709, range TV, faststart. Pesi e misure: vedi «Misure» in fondo.

**Il racconto** (una sola curva di telecamera, che non si ferma mai):

| secondi | cosa |
|---|---|
| 0-2,6 | l'Italia scura; compaiono, scaglionati e morbidi, i pallini di un pluviometro ogni cinque (649 su 3.373, diradati perché stiano distanti: si capisce che sotto ci sono misure vere) |
| 2,2-11 | i 30 giorni di pioggia. La prima pioggia (25/9) **nasce dai pallini**: si vede solo entro un raggio dai pallini che cresce, poi copre tutto; i pallini sfumano con la pioggia grande del 7-10 ottobre |
| 9,2-12,6 | la telecamera parte verso la Liguria e ci arriva senza fermarsi |
| 12-15 | **dissolvenza incrociata pioggia → boschi**: i boschi si accendono prima dove è piovuto di più (soglia da 320 a 25 mm), la pioggia sfuma; il rilievo sale quando la pioggia è quasi andata (regola della mappa) |
| 14,6-18,2 | **sotto i boschi sfuma dentro il satellite**, e si scende fino alle chiome (zoom 15,1 sopra Santo Stefano d'Aveto); vicino i boschi si fanno un po' più trasparenti perché sotto si vedano gli alberi |
| 18,2-21,9 | si torna larghi sulla Liguria; boschi e satellite sfumano, resta il rilievo scuro |
| 20-22,6 | le **previsioni** dei capoluoghi compaiono una dopo l'altra, da ovest a est |
| 23,2-24 | dissolvenza sul primo fotogramma: il loop si richiude senza scatto |

Le **scritte** non sono nel video: le mette la pagina (vedi «La pagina»).

**Cosa è cambiato per la fluidità** (le sue parole: «non è fluido, appare a pezzi la mappa con la heatmap»):
- **L'accumulo è continuo.** Prima il cumulato passava da un giorno al successivo in linea retta, un giorno ogni
  0,21 s: a ogni cambio di giorno la velocità del colore cambiava di colpo (i gradini). Ora ogni giorno di pioggia
  entra nel cumulato con una curva morbida (smootherstep) lunga 2,5 «giorni» e i giorni si sovrappongono: il
  cumulato di ogni cella è una curva liscia. In più il tempo della pioggia è **pesato sulla pioggia**: i giorni
  asciutti di fine settembre passano svelti, i giorni grandi (7-12 e 20-21 ottobre) si allargano, con partenza e
  arrivo morbidi. 8,8 s di accumulo invece di 6,4.
- **Niente pezzi.** Le tessere (rilievo, boschi, satellite) non le disegna più Leaflet, che le mostrava man mano
  che arrivavano e cambiava livello di dettaglio di colpo a metà fra due zoom. Il motore aspetta **tutte** le
  immagini della vista, poi compone; fra un livello e il successivo c'è una dissolvenza continua (le due tele si
  sommano coi pesi giusti, trasparenze comprese). La griglia della pioggia si calcola tutta prima dello scatto
  (`drawGrid` della mappa è sincrona).
- **La telecamera è una curva sola**: lo zoom è una Hermite cubica con la velocità scelta a ogni nodo (continua anche
  nella velocità); il centro scivola verso il bersaglio in proporzione a quanto si stringe la vista (niente
  sbandate a zoom alto), lisciato con una gaussiana di 0,35 s dove il bersaglio cambia; in cima, dove lo zoom si
  ferma e torna indietro, la telecamera continua a scorrere di lato (16 px/s).
- Restano le correzioni sotto-pixel della prima sessione (niente arrotondamenti di Leaflet).

## Le immagini (`foto/`, 2880 e 1440)
| immagine | cosa | dal cloud |
|---|---|---|
| `pioggia-nord` | il Nord Italia, 30 giorni, coi pallini dei pluviometri (uno ogni cinque) sopra la pioggia | vera |
| `scheda-stazione` | la scheda di Piampaludo, quella della prima sessione (non rifatta) | vera |
| `boschi-nord` | il Nord con la **stessa identica inquadratura** della pioggia (`NORD` in `foto.js`), boschi sopra il rilievo | vera |
| `satellite` | i boschi (opacità 0,62) sopra la foto aerea, zoom 14,4 a scala 2: sopra Santo Stefano d'Aveto | **segnaposto** (rilievo) |
| `previsioni` | la Liguria scura col rilievo e le targhette delle previsioni di domani sui capoluoghi | **segnaposto** (solo i nomi) |

Pesi: vedi «Misure».

## La pagina (`home-v2/index.html`)
- **Titolo**: due pillole, «Storico piogge» (piena, la mappa) e «Previsioni» (contorno,
  `?r=liguria&m=prev`). ⚠️ Nella mappa un indirizzo previsioni **senza regione** non c'è: `?m=prev` da solo
  aspetta 15 s una regione che non arriva e resta sullo storico (`index.html` della mappa, «link con ?m=prev»).
  Si usa la Liguria, la regione del film. Via «Apri la mappa» e «Le località più bagnate» dal titolo.
- **Ordine**: film → «È piovuto qui.» (Nord coi pluviometri) → «Ogni stazione, giorno per giorno.» (scheda) →
  «Sui boschi giusti.» (stessa inquadratura) → «Come sono davvero.» (satellite) → «E i prossimi giorni.»
  (previsioni) → chiusura → «E poi ci siamo noi». La finestra funghi non c'è più.
- **Un link per capitolo**, che apre la mappa già in quel modo: pioggia `?r=<9 regioni del Nord>&g=30` (e il link
  testuale a `/funghi/`, «Le località più bagnate», che serve a Google), scheda `?r=liguria&g=30`, boschi
  `?boschi=1&r=liguria`, satellite `?boschi=1&sat=1&r=liguria` (il satellite parte solo coi boschi), previsioni
  `?r=liguria&m=prev`. La chiusura ripete le due pillole.
- **Le scritte del film**: «La pioggia caduta davvero.» → «Sui boschi giusti.» → «Come sono davvero, dal
  satellite.» → «E i prossimi giorni.». I tempi stanno in un solo oggetto in cima alla pagina (`SCRITTE_FILM`):
  si ritoccano lì. Seguono il tempo vero del video fotogramma per fotogramma (`requestVideoFrameCallback`, o
  `requestAnimationFrame` su `currentTime`), con entrata e uscita morbide; al loop tornano a zero col video.
  Al computer stanno in basso al centro della parte visibile del film, al telefono sul fondo del video.
- **YouTube**: logo rosso (lo stesso SVG dell'`index.html` attuale), «Guarda il nostro canale YouTube.», «Le
  nostre avventure a funghi e tartufi.», pillola «Guarda il canale». Quiz e piede invariati.

## Cosa va lanciato dal PC (rete aperta)
Una volta, per preparare (Windows: al posto di `/tmp/mappa` una cartella qualsiasi, la stessa nei tre comandi):
```
git clone --depth 1 --filter=blob:none https://github.com/AvventureMicologiche/Mappa-Precipitazioni-Nord /tmp/mappa
cd /tmp/mappa && python3 -m http.server 8899 --bind 127.0.0.1        # in un'altra finestra, resta aperto
pip install numpy scipy shapely pillow matplotlib                    # una volta
python3 studio-apple/film/tools/griglie.py --mappa /tmp/mappa --da 2026-09-22 --giorni 30
```
Poi, dalla radice del repo, **un comando per il film e uno per le immagini**:
```
node studio-apple/film/tools/film.js --satellite --previsioni          # film col satellite vero e le previsioni di oggi
node studio-apple/film/tools/foto.js satellite previsioni --satellite --previsioni   # le due immagini
node studio-apple/verify.js --v2                                       # controlli e screenshot
```
Il film rifà tutti i fotogrammi (circa 15-20 minuti: le tessere del satellite si scaricano la prima volta), poi
codifica, stills, `fluidita.png`. Se il satellite o le previsioni non rispondono lo dice e lascia il segnaposto.
Le previsioni sono quelle del giorno in cui si lancia: per aggiornarle basta rilanciare (`--previsioni` riscarica).
Serve Playwright con Chromium (`npm i -D playwright && npx playwright install chromium`) e ffmpeg con ffprobe.

Altri comandi:
```
node studio-apple/film/tools/film.js --prova 0,6,13,18   # qualche fotogramma, in film/prova/
node studio-apple/film/tools/film.js --da 300 --a 420    # riprende un render interrotto (salta i fotogrammi fatti)
node studio-apple/film/tools/film.js --solo-codifica     # rifà mp4, poster, stills e misura dai fotogrammi
node studio-apple/film/tools/foto.js                     # tutte le immagini (anche la scheda della stazione)
```
`cache/`, `frames/` e `prova/` non vanno nel repo (`.gitignore`): si rifanno.

## Come si prova la pagina
```
python -m http.server 8000        # dalla radice del repo
```
poi `http://localhost:8000/studio-apple/home-v2/`.

## Da fare / da decidere
- [ ] **Dal PC**: satellite e previsioni (i due comandi sopra). Fino ad allora film e immagini hanno i segnaposto.
- [ ] Telefono: il film è 16:9 e al telefono l'Italia viene piccola. Se piace l'idea, una versione 4:5.
- [ ] Colore d'azione (blu, verde, oro: un blocco in cima al CSS del v2) e testi definitivi.

## Fedeltà alla mappa
- La pioggia è disegnata dalla `drawGrid()` della mappa (sua scala di colori, opacità 0,7, sfumatura, fasce di
  Mercatore, ritaglio sul confine). Per raggiungerla, durante il render si aggiunge una riga a `index.html` **nella
  risposta del server locale** (`window.__film = {...}` dopo `window._mapDebug=map;`): il repo resta intatto.
- La griglia è quella di `buildGrid()`: IDW 1/d², raggio 0,35°, veto locale, copertura 60%, più le esclusioni della
  mappa. Passo 0,01°. Aggiunte solo per l'immagine, scritte in testa a `griglie.py`: le sorde nel periodo, lo
  sfumato a 0,8° dove la stazione più vicina è lontana (interno dell'Abruzzo), la griglia che sborda di 0,04° in mare.
- Boschi e rilievo: le tessere della mappa (stesso commit), opacità dei boschi 0,7 come nella mappa.
- Le targhette delle previsioni: la classe `.pv-m` della mappa e la sua tabella delle icone, ingrandite 1,9 volte.

## Misure
(si aggiornano a ogni render)
