/* Motore comune del film e delle foto: apre la mappa VERA in Chrome, toglie ogni interfaccia
   con CSS e script iniettati (mai modifiche al repo della mappa) e disegna una scena alla volta.

   Cosa resta della mappa: la sua istanza Leaflet, la sua drawGrid() con la sua scala di colori
   (mmToRGB, opacita' 0,7, sfumatura bilineare, fasce di Mercatore, ritaglio sul confine), le sue
   tessere dei boschi e del rilievo (repo Mappa-Precipitazioni-Tessere, stesso commit della mappa),
   lo stile delle sue targhette delle previsioni (.pv-m) e i loro dati (/api/previsioni).
   Cosa si aggiunge: la terra scura (contorno dell'Italia dai confini della mappa) al posto della
   cartina di OpenStreetMap, la griglia della pioggia calcolata da griglie.py, i pallini dei pluviometri.

   ⚠️ LE TESSERE NON LE DISEGNA PIU' LEAFLET (seconda sessione). Leaflet cambia livello di tessere di colpo a meta'
   fra due zoom e mostra le tessere man mano che arrivano (la mappa compariva «a pezzi»). Qui ogni strato (rilievo,
   satellite, boschi) si disegna su una tela: si aspettano TUTTE le immagini della vista, poi si compone, e fra un
   livello e il successivo c'e' una dissolvenza continua. Se un'immagine non arriva, scena() lo dice (`mancanti`)
   e chi scatta si ferma: nessun fotogramma con un buco.

   ⚠️ IL SATELLITE (terza sessione). Le tessere Esri World Imagery si scaricano UNA volta con scarica-satellite.js in
   cache/satellite/<z>/<y>/<x>.jpg (mai nel repo: sono di Esri) e il film le legge solo da li'. Si ritaglia sul
   contorno dell'Italia, come la terra scura: il mare e i paesi vicini restano neri. Nel cloud Esri e' chiuso: al
   suo posto un SEGNAPOSTO disegnato qui (una texture scura da foto aerea: campi, boschi coi tipi della mappa, chiome
   da vicino, ombre del rilievo), con la scritta «segnaposto satellite», perche' si possano giudicare i tempi.

   Rete: fetch di Node (comune.js). Le tessere della mappa vengono da raw.githubusercontent.com e restano in
   cache/tessere/; i dati delle stazioni sono gia' nel clone della mappa. Tutto il resto che la pagina chiede fuori
   (Google, OpenStreetMap) riceve una risposta vuota. */
'use strict';
const fs = require('fs');
const path = require('path');
const { FILM, CACHE, scarica, lanciaChrome } = require('./comune');

const TESSERE_COMMIT = '90a532e7a3f95e6cde1fc4fd0ee6fc658ffb2f6d';   // lo stesso di index.html della mappa
const JSDELIVR = `https://cdn.jsdelivr.net/gh/AvventureMicologiche/Mappa-Precipitazioni-Tessere@${TESSERE_COMMIT}/`;
const RAW = `https://raw.githubusercontent.com/AvventureMicologiche/Mappa-Precipitazioni-Tessere/${TESSERE_COMMIT}/`;
const DATI = 'https://raw.githubusercontent.com/AvventureMicologiche/Mappa-Precipitazioni-Nord/main/data/';
const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const SAT_CACHE = path.join(CACHE, 'satellite');
const satFile = (z, x, y) => path.join(SAT_CACHE, String(z), String(y), x + '.jpg');   // come l'indirizzo Esri: z/y/x
const PREVISIONI = 'https://precipitazioni.avventuremicologiche.it/api/previsioni';
const PREV_LOCALE = 'http://127.0.0.1:8788/api/previsioni';   // dove la mappa le chiede quando gira in locale
const PNG_VUOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==', 'base64');

const tessera = rel => scarica(RAW + rel, path.join(CACHE, 'tessere', rel));

/* la rete lascia passare il satellite? (dal cloud no: il proxy risponde 403) */
async function satelliteRaggiungibile() {
  try { const r = await fetch(SAT + '10/373/536', { signal: AbortSignal.timeout(15000) }); return r.status === 200; }
  catch (e) { return false; }
}

/* Le previsioni dei capoluoghi di un'area, dalla PRODUZIONE (la stessa risposta che riceve la mappa).
   Restano in cache/previsioni-<area>.json: le foto usano quella copia. `rinnova` la riscarica.
   Se la produzione non risponde (dal cloud) e non c'e' copia: null, e chi disegna mette il segnaposto. */
async function previsioni(area, rinnova) {
  const f = path.join(CACHE, `previsioni-${area}.json`);
  if (rinnova) { try { fs.unlinkSync(f); } catch (e) {} }
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f));
  try {
    const b = await scarica(`${PREVISIONI}?capoluoghi=${area}&v=12`, f, { tentativi: 2, tempo: 40 });
    const j = b && JSON.parse(b);
    if (!j || !(j.capoluoghi || []).some(c => c.giorni && c.giorni.length)) { try { fs.unlinkSync(f); } catch (e) {} return null; }
    return j;
  } catch (e) { return null; }
}

const AGGANCIO = 'window._mapDebug=map;';
const GANCIO = `window.__film={drawGrid:drawGrid,initCanvas:initCanvas,
  imposta:function(p,r,g){gridPoints=p;gridRings=r;activeGridRes=g;},
  canvas:function(){return cvs;},
  fermaTimer:function(){if(drawTimer){clearTimeout(drawTimer);drawTimer=null;}}};`;

const CSS_PULITO = `
  *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
  html,body{background:#000!important;margin:0!important;overflow:hidden!important}
  body>*:not(#map-wrap):not(#film-loop):not(#film-nota){display:none!important}
  #map-wrap{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;z-index:1!important}
  #map-wrap>*:not(#map){display:none!important}
  #map{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;background:#000!important}
  #map>*:not(.leaflet-pane){display:none!important}
  .leaflet-control-container,.leaflet-marker-pane,.leaflet-shadow-pane,.leaflet-tooltip-pane,.leaflet-popup-pane{display:none!important}
  .leaflet-overlay-pane>*:not(#film-pioggia){display:none!important}
  .leaflet-tile-pane{display:none!important}
  .leaflet-container{background:#000!important;outline:none!important}
  #film-nota{position:fixed;right:18px;bottom:14px;z-index:99998;font:600 15px/1.3 system-ui,sans-serif;color:rgba(255,255,255,.55);
    letter-spacing:.02em;pointer-events:none}
`;

/* Pagina pronta: la mappa vera, senza niente sopra.
   satellite: false (niente foto aerea) | 'cache' (solo da cache/satellite: il film) | 'rete' (dalla cache o da Esri: le foto)
   segnaposto: true = al posto del satellite la texture disegnata qui (nel cloud)
   italia: le tessere dello z12 che toccano l'Italia (racconto.italiaZ12), per non chiedere tessere di mare */
async function apri({ url, larghezza, altezza, scala = 1, griglia, nonPulire = false, satellite = false, segnaposto = false, italia = null, prev = null, ponteprevisioni = false }) {
  const browser = await lanciaChrome();
  const ctx = await browser.newContext({ viewport: { width: larghezza, height: altezza }, deviceScaleFactor: scala, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errori = [];
  page.on('pageerror', e => errori.push(e.message));
  // ⚠️ i timer della pagina si segnano da subito, per poterli spegnere tutti prima del primo fotogramma
  await page.addInitScript(() => {
    const st = window.setTimeout, si = window.setInterval;
    window.__timer = []; window.__st = st; window.__ct = window.clearTimeout; window.__ci = window.clearInterval;
    window.setTimeout = function () { const id = st.apply(window, arguments); window.__timer.push(id); return id; };
    window.setInterval = function () { const id = si.apply(window, arguments); window.__timer.push(id); return id; };
    try { localStorage.setItem('novitaVista', '2026-10-20'); } catch (e) {}
  });
  const base = new URL(url);
  const cors = { 'Access-Control-Allow-Origin': '*' };
  await page.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith(JSDELIVR)) {
      let b = null;
      try { b = await tessera(u.slice(JSDELIVR.length).split('?')[0]); } catch (e) { return r.fulfill({ status: 503, body: '', headers: cors }); }
      return b ? r.fulfill({ status: 200, body: b, contentType: u.endsWith('.json') ? 'application/json' : 'image/png', headers: cors })
               : r.fulfill({ status: 404, body: '', headers: cors });
    }
    if (u.startsWith(SAT)) {   // la foto aerea: da cache/satellite (scarica-satellite.js); con 'rete' anche da Esri
      if (!satellite) return r.fulfill({ status: 404, body: '', headers: cors });
      const [z, y, x] = u.slice(SAT.length).split('?')[0].split('/');
      const f = satFile(z, x, y);
      try {
        const b = fs.existsSync(f) ? fs.readFileSync(f) : satellite === 'rete' ? await scarica(u, f) : null;
        return b ? r.fulfill({ status: 200, body: b, contentType: 'image/jpeg', headers: cors }) : r.fulfill({ status: 404, body: '', headers: cors });
      } catch (e) { return r.fulfill({ status: 503, body: '', headers: cors }); }
    }
    if (u.startsWith(PREV_LOCALE)) {
      // IL PONTE DELLE PREVISIONI: la mappa clonata le chiede al server locale delle Functions (8788), che qui
      // non c'e'; si girano alla produzione. Dal cloud la produzione e' chiusa: risposta d'errore, come un guasto.
      if (!ponteprevisioni) return r.fulfill({ status: 502, body: '{"errore":"ponte spento"}', contentType: 'application/json', headers: cors });
      try {
        const q = new URL(u).search;
        const b = await scarica(PREVISIONI + q, path.join(CACHE, 'ponte', Buffer.from(q).toString('base64url') + '.json'), { tentativi: 2, tempo: 40 });
        return r.fulfill({ status: 200, body: b, contentType: 'application/json', headers: cors });
      } catch (e) { return r.fulfill({ status: 502, body: '{"errore":"produzione irraggiungibile"}', contentType: 'application/json', headers: cors }); }
    }
    if (u.startsWith(base.origin + '/__film/')) {
      const f = path.join(CACHE, decodeURIComponent(new URL(u).pathname.slice('/__film/'.length)));
      return fs.existsSync(f) ? r.fulfill({ status: 200, body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' });
    }
    if (u.startsWith(base.origin) && /^\/(index\.html)?$/.test(new URL(u).pathname)) {
      // il gancio: le funzioni della pioggia vivono in una IIFE, si espongono solo durante il render
      const resp = await r.fetch(); let html = await resp.text();
      if (!html.includes(AGGANCIO)) throw new Error('gancio non trovato in index.html: la mappa e\' cambiata, aggiorna AGGANCIO');
      html = html.replace(AGGANCIO, AGGANCIO + GANCIO);
      return r.fulfill({ response: resp, body: html });
    }
    if (u.startsWith(base.origin)) return r.continue();
    if (u.startsWith(DATI)) {   // i file delle stazioni: dal clone locale della mappa, come fa lei in locale
      const resp = await r.fetch({ url: base.origin + '/data/' + u.slice(DATI.length) });
      return r.fulfill({ response: resp, headers: { ...resp.headers(), 'access-control-allow-origin': '*' } });
    }
    // il resto del mondo: una risposta vuota, cosi' la pagina non resta appesa e la console non si riempie
    if (/\.(png|jpe?g|webp)(\?|$)/.test(u) || /tile/.test(u)) return r.fulfill({ status: 200, body: PNG_VUOTO, contentType: 'image/png' });
    return r.fulfill({ status: 204, body: '' });
  });
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'novita=0', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window._mapDebug && window.__film, null, { timeout: 120000 });
  await page.waitForTimeout(2500);   // la pagina finisce di sistemarsi da sola, poi la si ferma
  if (nonPulire) return { browser, page, errori };   // la scheda della stazione: la pagina resta com'e', viva
  await page.addStyleTag({ content: CSS_PULITO });
  await page.evaluate(async ({ griglia, JSDELIVR, SAT, satellite, segnaposto, italia, prev }) => {
    // 1. ferma timer e intervalli della pagina; da qui in poi la pagina non ne programma piu'
    window.__timer.forEach(id => { window.__ct(id); window.__ci(id); });
    window.setTimeout = () => 0; window.setInterval = () => 0;
    const m = window._mapDebug;
    // 2. via tutti gli strati (cartina, confini, pallini): resta la sola mappa
    m.eachLayer(l => m.removeLayer(l));
    m.options.zoomSnap = 0; m.options.zoomAnimation = false; m.options.fadeAnimation = false;
    m._fadeAnimated = false; m._zoomAnimated = false;
    m.getContainer().classList.remove('leaflet-fade-anim', 'leaflet-zoom-anim');
    m.invalidateSize({ pan: false });
    /* ⚠️ NIENTE ARROTONDAMENTI AL PIXEL. Leaflet arrotonda le coordinate dei vettori (latLngToLayerPoint): a mappa
       ferma non si vede, in un film che si muove di 0,2 px a fotogramma coste e pioggia tremano di un pixel. */
    m.latLngToLayerPoint = function (ll) { return this.project(L.latLng(ll))._subtract(this.getPixelOrigin()); };
    // 3. panes del film (overlayPane, la pioggia, sta a 400)
    const pane = (n, z) => { const p = m.createPane(n); p.style.zIndex = z; p.style.pointerEvents = 'none'; return p; };
    pane('film-terra', 150); pane('film-sat', 158); pane('film-rilievo', 160); pane('film-boschi-tela', 175);
    pane('film-linee', 450); pane('film-pallini', 460); pane('film-prev', 620);   // le targhette: una tela (vedi scena)
    m.getPane('film-rilievo').style.mixBlendMode = 'multiply';
    // una tela per strato, grande quanto lo schermo, nella sua pane
    window.__tele = {};
    ['film-sat', 'film-rilievo', 'film-boschi-tela', 'film-pallini'].forEach(n => {
      const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
      m.getPane(n).appendChild(c); window.__tele[n] = c;
    });
    // 4. terra: il contorno dell'Italia dai confini della mappa
    const contorno = await (await fetch('/__film/italia-contorno.json')).json();
    const linee = await (await fetch('/__film/italia-regioni-linee.json')).json();
    window.__contorno = contorno.geometry.type === 'Polygon' ? [contorno.geometry.coordinates] : contorno.geometry.coordinates;
    window.__terra = L.geoJSON(contorno, { renderer: L.svg({ pane: 'film-terra', padding: 1 }), interactive: false, smoothFactor: 0,
      style: { stroke: false, fill: true, fillColor: '#1b1b1d', fillOpacity: 1 } }).addTo(m);
    window.__linee = L.geoJSON(linee, { renderer: L.svg({ pane: 'film-linee', padding: 1 }), interactive: false, smoothFactor: 0,
      style: { color: '#ffffff', weight: 0.8, opacity: 0 } }).addTo(m);
    // 5. le sorgenti delle tessere: rilievo e boschi della mappa (solo quelle che esistono), satellite Esri o segnaposto
    const indB = await (await fetch(JSDELIVR + 'boschi/indice.json')).json();
    const indR = await (await fetch(JSDELIVR + 'rilievo/indice.json')).json();
    const esisteB = {}; Object.keys(indB.tessere).forEach(z => indB.tessere[z].forEach(([x, y]) => { esisteB[z + '/' + x + '/' + y] = 1; }));
    const esisteR = (z, x, y) => { const pz = indR[z]; if (!pz) return false; const iv = pz[x]; if (!iv) return false;
      return iv.some(v => typeof v === 'number' ? v === y : (y >= v[0] && y <= v[1])); };
    // l'Italia in tessere (vedi racconto.js, italiaZ12): il satellite si chiede solo dove c'e' terra
    let inItalia = () => true;
    if (italia) {
      const ZI = 12, n = 2 ** ZI, set = new Set(italia), sopra = {};
      for (let l = ZI - 1; l >= 0; l--) { const s = new Set(), da = l === ZI - 1 ? set : sopra[l + 1], mm = 2 ** (l + 1);
        da.forEach(k => { const x = Math.floor(k / mm), y = k % mm; s.add((x >> 1) * 2 ** l + (y >> 1)); }); sopra[l] = s; }
      inItalia = (l, x, y) => l >= ZI ? set.has((x >> (l - ZI)) * n + (y >> (l - ZI))) : sopra[l].has(x * 2 ** l + y);
    }
    window.__sorgenti = {
      rilievo: { zmin: 5, zmax: 13, url: (z, x, y) => esisteR(z, x, y) ? JSDELIVR + 'rilievo/' + z + '/' + x + '/' + y + '.png' : null },
      boschi: { zmin: indB.z_min, zmax: indB.z_max, url: (z, x, y) => esisteB[z + '/' + x + '/' + y] ? JSDELIVR + 'boschi/' + z + '/' + x + '/' + y + '.png' : null },
      satellite: segnaposto ? { zmin: 3, zmax: 19, url: (z, x, y) => inItalia(z, x, y) ? 'segnaposto:' + z + '/' + x + '/' + y : null }
                            : { zmin: 3, zmax: 19, url: (z, x, y) => inItalia(z, x, y) ? SAT + z + '/' + y + '/' + x : null },
    };
    window.__satellite = !!(satellite || segnaposto);
    // 6. la pioggia: griglia di griglie.py dentro le variabili della mappa, disegnata dalla SUA drawGrid
    if (griglia) {
      const meta = await (await fetch('/__film/' + griglia + '.json')).json();
      const idx = new Uint16Array(await (await fetch('/__film/' + griglia + '.idx')).arrayBuffer());
      const val = new Uint16Array(await (await fetch('/__film/' + griglia + '.u16')).arrayBuffer());
      const rd = await fetch('/__film/' + griglia + '.dist');
      const dist = rd.ok ? new Uint8Array(await rd.arrayBuffer()) : null;
      const rp = await fetch('/__film/' + griglia + '-pallini.json');
      const pallini = rp.ok ? await rp.json() : [];
      const n = meta.celle, GR = meta.passo;
      const pts = new Array(n);
      for (let k = 0; k < n; k++) pts[k] = { lat: meta.lat0 + idx[2 * k] * GR, lon: meta.lon0 + idx[2 * k + 1] * GR, mm: 0 };
      window.__griglia = { meta, val, pts, n, idx, dist, pallini };
      window.__film.initCanvas(); window.__film.canvas().id = 'film-pioggia';
      window.__film.imposta(pts, window.__contorno, GR);
    }
    // 7. le previsioni (la risposta di /api/previsioni?capoluoghi=..., se c'e')
    if (prev) { const rp = await fetch('/__film/previsioni-' + prev + '.json'); window.__prev = rp.ok ? await rp.json() : null; window.__prevArea = prev; }
  }, { griglia, JSDELIVR, SAT, satellite, segnaposto, italia, prev });
  return { browser, page, errori };
}

/* Disegna una scena. s = {
     centro:[lat,lon], zoom,
     giorno     (giorni di pioggia, con la virgola: l'accumulo e' continuo, vedi sotto; null = il cumulato finale),
     morbido    (giorni: ogni giorno di pioggia entra nel cumulato in modo morbido lungo questa durata),
     pioggia    (opacita' della pioggia 0..1, uguale su tutta la griglia),
     nascita    (gradi: la pioggia si vede solo entro questa distanza dai pallini; null = ovunque),
     pallini    (0..1+: comparsa scaglionata dei pallini), pallinoVia (0..1: i pallini se ne vanno),
     rilievo, sat, boschi (opacita' 0..1), satClip (il satellite ritagliato sul contorno dell'Italia),
     soglia (mm: i boschi si accendono dove e' piovuto almeno tanto),
     terra ('#rrggbb'), linee (opacita' dei confini fra regioni),
     prev (0..1+: comparsa scaglionata delle targhette delle previsioni), prevGiorno (0 = oggi), nota (testo d'angolo) }
   Restituisce { mancanti: [indirizzi delle immagini che non sono arrivate] }: se non e' vuota, il fotogramma ha un buco. */
async function scena(page, s) {
  return page.evaluate(async s => {
    const m = window._mapDebug;
    const raf = () => new Promise(r => requestAnimationFrame(() => r()));
    const liscia = x => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
    const mancanti = [];
    m.setView(s.centro, s.zoom, { animate: false, reset: true });
    /* ⚠️ SOTTO-PIXEL. setView arrotonda l'origine della mappa al pixel intero: con una deriva lenta (0,2 px a
       fotogramma) l'immagine avanzava a scatti di un pixel. Il resto si restituisce spostando il pane della mappa. */
    const vuole = m.project(L.latLng(s.centro), s.zoom).subtract(m.getSize().divideBy(2));
    const resto = vuole.subtract(m.getPixelOrigin());
    m.getPane('mapPane').style.transform = `translate3d(${-resto.x}px,${-resto.y}px,0)`;
    /* ⚠️ E IL CONTORNO SVG. Il renderer SVG di Leaflet, all'evento «zoom» di setView, si sposta da solo di una frazione
       di pixel che annulla il resto qui sopra: si rimette il renderer al suo posto intero, il resto lo fa il pane. */
    [window.__terra, window.__linee].forEach(g => { const r = g.options.renderer; if (r && r._container && r._bounds) L.DomUtil.setPosition(r._container, r._bounds.min); });
    window.__terra.setStyle({ fillColor: s.terra || '#1b1b1d', fillOpacity: s.terraOpacita == null ? 1 : s.terraOpacita });
    window.__linee.setStyle({ opacity: s.linee || 0 });
    const size = m.getSize(), dpr = window.devicePixelRatio || 1, po = m.getPixelOrigin(), z = m.getZoom();
    // dentro le pane, un punto del mondo sta a project(punto) - pixelOrigin (il resto lo fa la translate del pane)
    const qui = ll => m.project(L.latLng(ll), z).subtract(po);
    const prepara = c => {
      if (c.width !== Math.round(size.x * dpr)) { c.width = Math.round(size.x * dpr); c.height = Math.round(size.y * dpr); c.style.width = size.x + 'px'; c.style.height = size.y + 'px'; }
      const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return g;
    };

    /* ── le tessere: si caricano TUTTE, poi si compone; fra due livelli una dissolvenza ── */
    const cacheImg = window.__img || (window.__img = new Map());
    const immagine = url => {
      if (cacheImg.has(url)) { const v = cacheImg.get(url); cacheImg.delete(url); cacheImg.set(url, v); return v; }
      const p = url.startsWith('segnaposto:') ? segnaposto(url) : new Promise(ok => {
        let tent = 0;
        const prova = () => { const im = new Image(); im.crossOrigin = 'anonymous';
          im.onload = () => (im.decode ? im.decode() : Promise.resolve()).then(() => ok(im), () => ok(im));
          im.onerror = () => { if (++tent < 3) prova(); else ok(null); };
          im.src = url + (tent ? (url.includes('?') ? '&' : '?') + 'r=' + tent : ''); };
        prova();
      });
      cacheImg.set(url, p);
      if (cacheImg.size > 1800) cacheImg.delete(cacheImg.keys().next().value);
      return p;
    };

    /* ── IL SEGNAPOSTO DEL SATELLITE: una foto aerea finta, scura, solo per giudicare i tempi nel cloud ──
       Rumore a valori in coordinate del MONDO (metri di Mercatore), a ottave: ogni ottava entra solo se e' larga
       almeno due-quattro pixel a quel livello, cosi' i livelli vicini si somigliano e la dissolvenza fra due livelli
       e' quella di una foto vera. Dove la mappa ha bosco (tessere boschi, alpha) verde scuro con le chiome; altrove
       campi fra l'oliva e l'ocra; sopra le ombre del rilievo della mappa. */
    async function segnaposto(url) {
      const [zz, xx, yy] = url.slice(11).split('/').map(Number);
      const S = window.__sorgenti;
      const antenato = (src, zmax) => { const zb = Math.min(zz, zmax), k = zz - zb; return { zb, k, x: xx >> k, y: yy >> k, u: zb >= src.zmin ? src.url(zb, xx >> k, yy >> k) : null }; };
      const ab = antenato(S.boschi, S.boschi.zmax), ar = antenato(S.rilievo, S.rilievo.zmax);
      const [ib, ir] = await Promise.all([ab.u ? immagine(ab.u) : null, ar.u ? immagine(ar.u) : null]);
      const leggi = (im, a) => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (im) { const sub = 256 / 2 ** a.k; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
          g.drawImage(im, (xx - (a.x << a.k)) * sub, (yy - (a.y << a.k)) * sub, sub, sub, 0, 0, 256, 256); }
        return g.getImageData(0, 0, 256, 256).data;
      };
      const B = leggi(ib, ab), R = leggi(ir, ar);
      const hash = (x, y, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h & 0xffffff) / 0xffffff; };
      const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
      const MONDO = 40075016, px = MONDO / (256 * 2 ** zz);
      const banda = l => { const r = (l / px - 2) / 2; return r <= 0 ? 0 : r >= 1 ? 1 : r * r * (3 - 2 * r); };
      // le ottave: [lunghezza d'onda in metri, peso nel campo «terra», peso nelle «chiome»]
      const OTT = []; for (let k = 0; k < 14; k++) { const l = 25600 / 2 ** k; OTT.push([l, Math.pow(0.6, k), l <= 26 ? 1 : 0, banda(l), k]); }
      const vive = OTT.filter(o => o[3] > 0);
      const out = document.createElement('canvas'); out.width = out.height = 256;
      const go = out.getContext('2d'), img = go.createImageData(256, 256), P = img.data;
      for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
        const wx = ((xx * 256 + i + 0.5) / (256 * 2 ** zz)) * MONDO, wy = ((yy * 256 + j + 0.5) / (256 * 2 ** zz)) * MONDO;
        let terra = 0, tw = 0, chi = 0, cw = 0, campi = 0, fw = 0;
        for (const [l, a, c, b, k] of vive) {
          const v = vn(wx / l, wy / l, k) - 0.5;
          if (l >= 800) { terra += a * b * v; tw += a; }                    // il paesaggio: pianure, colline, montagne
          else if (l >= 40) { campi += a * b * v; fw += a; }                // i campi e i filari
          if (c) { chi += b * v; cw += 1; }                                 // le chiome
        }
        terra = tw ? terra / tw : 0; campi = fw ? campi / fw : 0; chi = cw ? chi / cw : 0;
        const o = (j * 256 + i) * 4;
        // il bosco: dove la tessera dei boschi ha colore; da vicino (sopra lo z13) il bordo si sfrangia col rumore
        let bo = B[o + 3] / 255; if (zz > 13) bo = Math.max(0, Math.min(1, (bo - 0.5 + 0.35 * campi) * 3 + 0.5));
        const ombra = 1 - (R[o + 3] / 255) * (1 - R[o] / 255);
        const t = 0.5 + 1.6 * terra, f = 0.5 + 2.2 * campi;
        let r = 66 + 22 * t + 18 * f, g = 66 + 16 * t + 10 * f, bl = 46 + 8 * t + 6 * f;   // campi: oliva / ocra
        const cr = 1 + 1.5 * chi;                                                     // chiome: luce e ombra
        const fr = (26 + 14 * t) * cr, fg = (38 + 16 * t) * cr, fb = (24 + 8 * t) * cr; // bosco: verde scuro
        r = r + (fr - r) * bo; g = g + (fg - g) * bo; bl = bl + (fb - bl) * bo;
        P[o] = r * ombra * 0.82; P[o + 1] = g * ombra * 0.82; P[o + 2] = bl * ombra * 0.82; P[o + 3] = 255;
      }
      go.putImageData(img, 0, 0);
      return out;
    }

    const off = window.__off || (window.__off = [document.createElement('canvas'), document.createElement('canvas')]);
    async function livello(src, l, k) {
      // il livello l intero, montato su una tela alle sue dimensioni native (tessere attaccate, niente fessure)
      const sc = 256 * Math.pow(2, z - l);
      const x0 = Math.floor(po.x / sc - 0.02), x1 = Math.floor((po.x + size.x) / sc + 0.02);
      const y0 = Math.max(0, Math.floor(po.y / sc - 0.02)), y1 = Math.min(Math.pow(2, l) - 1, Math.floor((po.y + size.y) / sc + 0.02));
      const lista = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const n = Math.pow(2, l), xx = ((x % n) + n) % n, u = src.url(l, xx, y);
        if (u) lista.push([x, y, immagine(u), u]);
      }
      const imgs = await Promise.all(lista.map(t => t[2]));
      const c = off[k]; c.width = (x1 - x0 + 1) * 256; c.height = (y1 - y0 + 1) * 256;
      const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
      lista.forEach((t, i) => { if (imgs[i]) g.drawImage(imgs[i], (t[0] - x0) * 256, (t[1] - y0) * 256, 256, 256); else mancanti.push(t[3]); });
      return { c, dx: x0 * sc - po.x, dy: y0 * sc - po.y, dw: c.width / 256 * sc, dh: c.height / 256 * sc };
    }
    async function strato(g, src, alfa, spinta = 0.35) {
      // livello continuo: +0,35 per avere qualche pixel in piu' del necessario (piu' nitido, mai sgranato)
      const lf = Math.max(src.zmin, Math.min(src.zmax, z + spinta)), l0 = Math.floor(lf), f = lf >= src.zmax ? 0 : liscia(lf - l0);
      const a = await livello(src, l0, 0), b = f > 0.001 ? await livello(src, l0 + 1, 1) : null;
      g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.globalAlpha = alfa * (1 - (b ? f : 0)); g.drawImage(a.c, a.dx, a.dy, a.dw, a.dh);
      // 'lighter' somma i colori premoltiplicati: (1-f)·A + f·B, la media esatta dei due livelli, trasparenze comprese
      if (b) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = alfa * f; g.drawImage(b.c, b.dx, b.dy, b.dw, b.dh); }
      g.restore();
    }
    const T = window.__tele, S = window.__sorgenti;
    // il mosso (solo nel film, quando lo zoom corre): una sfumatura leggera sulle tessere
    ['film-sat', 'film-rilievo', 'film-boschi-tela'].forEach(n => { T[n].style.filter = (s.mosso || 0) > 0.03 ? `blur(${s.mosso.toFixed(2)}px)` : 'none'; });
    // il satellite: la foto aerea (o il segnaposto) sotto i boschi; senza nessuna delle due, il rilievo scuro
    const satOn = window.__satellite && (s.sat || 0) > 0;
    const gs = prepara(T['film-sat']);
    if (satOn) {
      await strato(gs, S.satellite, 1, 0.2);
      if (s.satClip) {   // ritaglio sul contorno dell'Italia, come la terra scura
        gs.save(); gs.globalCompositeOperation = 'destination-in'; gs.beginPath();
        for (const pol of window.__contorno) for (const ring of pol) ring.forEach(([lo, la], k) => { const p = qui([la, lo]); k ? gs.lineTo(p.x, p.y) : gs.moveTo(p.x, p.y); });
        gs.fillStyle = '#fff'; gs.fill('nonzero'); gs.restore();
      }
    }
    T['film-sat'].style.opacity = satOn ? s.sat : 0;
    const ril = Math.max(s.rilievo || 0, window.__satellite ? 0 : (s.sat || 0));
    const gr = prepara(T['film-rilievo']);
    if (ril > 0) await strato(gr, S.rilievo, 1);
    T['film-rilievo'].style.opacity = ril;

    /* ── la pioggia ── */
    const G = window.__griglia;
    if (G) {
      const cv = window.__film.canvas();
      const pioggia = s.pioggia == null ? 1 : s.pioggia;
      /* ⚠️ LA GRIGLIA SI RIDISEGNA SOLO SE CAMBIA QUALCOSA: con la telecamera ferma e la griglia unica (terza
         sessione) e' sempre la stessa immagine, e la pioggia sale con la sola opacita', uguale ovunque. */
      const chiave = [s.centro[0], s.centro[1], s.zoom, s.giorno, s.morbido, s.nascita].join('|');
      if (pioggia > 0 && G.chiave !== chiave) {
        /* ⚠️ L'ACCUMULO E' CONTINUO (seconda sessione): ogni giorno di pioggia entra nel cumulato con una curva
           morbida (smootherstep) lunga `morbido` giorni, e i giorni si sovrappongono. Con giorno = null, il
           cumulato finale (la terza sessione usa solo questo). */
        const N = G.meta.fotogrammi - 1, a = G.val, n = G.n, W = s.morbido || 2.5, mm = G.mm || (G.mm = new Float32Array(n));
        if (s.giorno == null || s.giorno >= N - 1 + W) { const o = N * n; for (let k = 0; k < n; k++) mm[k] = a[o + k]; }
        else {
          const g = Math.max(0, s.giorno);
          const pieni = Math.max(0, Math.min(N, Math.floor(g - W) + 1));   // i giorni gia' entrati del tutto
          const o = pieni * n; for (let k = 0; k < n; k++) mm[k] = a[o + k];
          for (let d = pieni; d < N && d < g; d++) {
            const w = liscia((g - d) / W); if (w <= 0) continue;
            const o0 = d * n, o1 = (d + 1) * n;
            for (let k = 0; k < n; k++) mm[k] += w * (a[o1 + k] - a[o0 + k]);
          }
        }
        for (let k = 0; k < n; k++) G.pts[k].mm = mm[k] / 10;
        window.__film.drawGrid();
        G.chiave = chiave;
        /* LA PIOGGIA NASCE DAI PALLINI (seconda sessione; nel film nuovo non si usa): si vede solo entro `nascita`
           gradi da un pallino, con un bordo morbido. */
        if (s.nascita != null && G.dist) {
          const M = G.meta, GR = M.passo;
          if (!G.box) { let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (let k = 0; k < n; k++) { const iy = G.idx[2 * k], ix = G.idx[2 * k + 1];
            if (iy < a0) a0 = iy; if (iy > a1) a1 = iy; if (ix < b0) b0 = ix; if (ix > b1) b1 = ix; } G.box = { a0, a1, b0, b1 }; }
          const { a0, a1, b0, b1 } = G.box, nx = b1 - b0 + 1, ny = a1 - a0 + 1;
          const mc = G.mc || (G.mc = document.createElement('canvas')); mc.width = nx; mc.height = ny;
          const mg = mc.getContext('2d'), im = mg.createImageData(nx, ny), px = im.data;
          const R = s.nascita, F = 0.09;
          for (let k = 0; k < n; k++) {
            const d = G.dist[k] * 0.004, u = liscia((R - d) / F + 0.5);
            if (u <= 0) continue;
            const o = (((a1 - G.idx[2 * k]) * nx) + (G.idx[2 * k + 1] - b0)) * 4;
            px[o] = px[o + 1] = px[o + 2] = 255; px[o + 3] = Math.round(255 * u);
          }
          mg.putImageData(im, 0, 0);
          const cg = cv.getContext('2d'), latMax = M.lat0 + a1 * GR, lonMin = M.lon0 + b0 * GR, lonMax = M.lon0 + b1 * GR;
          const xa = m.latLngToContainerPoint([latMax, lonMin - GR / 2]).x, xb = m.latLngToContainerPoint([latMax, lonMax + GR / 2]).x;
          const yb = new Array(ny + 1); for (let r = 0; r <= ny; r++) yb[r] = m.latLngToContainerPoint([latMax + GR / 2 - r * GR, lonMin]).y;
          cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'destination-in'; cg.imageSmoothingEnabled = true;
          for (let r0 = 0; r0 < ny;) {
            let r1 = r0 + 1; while (r1 < ny && yb[r1 + 1] - yb[r0] <= 64) r1++;
            const s0 = Math.max(r0 - 1, 0), s1 = Math.min(r1 + 1, ny);
            cg.save(); cg.beginPath(); cg.rect(xa, Math.round(yb[r0]), xb - xa, Math.round(yb[r1]) - Math.round(yb[r0])); cg.clip();
            cg.drawImage(mc, 0, s0, nx, s1 - s0, xa, yb[s0], xb - xa, yb[s1] - yb[s0]);
            cg.restore(); r0 = r1;
          }
          cg.restore();
        }
      }
      cv.style.opacity = pioggia;
    }

    /* ── i boschi: tessere della mappa su una tela, (se si vuole) ritagliate dove e' piovuto ── */
    const gb = prepara(T['film-boschi-tela']);
    T['film-boschi-tela'].style.opacity = s.boschi || 0;
    if ((s.boschi || 0) > 0) {
      await strato(gb, S.boschi, 0.7);   // OPACITA della mappa boschi
      if (G && s.soglia != null) {
        // maschera: solo dove e' piovuto almeno `soglia` mm nei 30 giorni (cumulato finale)
        const N = G.meta.fotogrammi - 1, a = G.val, n = G.n;
        const GR = G.meta.passo, b = m.getBounds().pad(0.1), M = G.meta, fin = N * n;
        const x0 = Math.max(0, Math.floor((b.getWest() - M.lon0) / GR)), x1 = Math.min(M.nx - 1, Math.ceil((b.getEast() - M.lon0) / GR));
        const y0 = Math.max(0, Math.floor((b.getSouth() - M.lat0) / GR)), y1 = Math.min(M.ny - 1, Math.ceil((b.getNorth() - M.lat0) / GR));
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const c = window.__maschera || (window.__maschera = document.createElement('canvas'));
        c.width = w; c.height = h;
        const g2 = c.getContext('2d'), im = g2.createImageData(w, h), px = im.data;
        if (!G.cella) { G.cella = new Int32Array(M.nx * M.ny).fill(-1); for (let k = 0; k < n; k++) G.cella[G.idx[2 * k] * M.nx + G.idx[2 * k + 1]] = k; }
        const morb = s.morbidoBoschi || 25;
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
          const k = G.cella[(y0 + yy) * M.nx + x0 + xx]; if (k < 0) continue;
          const mmf = a[fin + k] / 10, u = Math.max(0, Math.min(1, (mmf - s.soglia + morb) / (2 * morb)));
          const o = ((h - 1 - yy) * w + xx) * 4; px[o] = px[o + 1] = px[o + 2] = 255; px[o + 3] = Math.round(255 * u * u * (3 - 2 * u));
        }
        g2.putImageData(im, 0, 0);
        const nw = qui([M.lat0 + (y1 + 0.5) * GR, M.lon0 + (x0 - 0.5) * GR]);
        const se = qui([M.lat0 + (y0 - 0.5) * GR, M.lon0 + (x1 + 0.5) * GR]);
        gb.globalCompositeOperation = 'destination-in';
        gb.drawImage(c, nw.x, nw.y, se.x - nw.x, se.y - nw.y);
        gb.globalCompositeOperation = 'source-over';
      }
    }

    /* ── i pallini dei pluviometri (diradati), piccoli e discreti, con comparsa scaglionata ── */
    const gp = prepara(T['film-pallini']);
    if (G && G.pallini.length && (s.pallini || 0) > 0) {
      const via = 1 - liscia(s.pallinoVia || 0), b = m.getBounds().pad(0.05), r = s.raggioPallino || 1.8;
      for (const [la, lo, rit] of G.pallini) {
        if (!b.contains([la, lo])) continue;
        const a = liscia((s.pallini - rit * 0.75) / 0.25) * via; if (a <= 0.002) continue;
        const p = qui([la, lo]);
        gp.globalAlpha = a;
        gp.beginPath(); gp.arc(p.x, p.y, r, 0, 2 * Math.PI); gp.fillStyle = 'rgba(242,242,242,0.9)'; gp.fill();
      }
      gp.globalAlpha = 1;
    }

    /* ── le targhette delle previsioni: quelle della mappa (.pv-m), una dopo l'altra ──
       ⚠️ NON SONO HTML NEL FOTOGRAMMA. Chromium aggancia il testo al pixel intero: ogni targhetta si disegna UNA
       volta su una tela piccola e poi si posa con drawImage a coordinate frazionarie (si muove sotto il pixel). */
    const tp = T['film-prev'] || (T['film-prev'] = (() => { const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
      m.getPane('film-prev').appendChild(c); return c; })());
    const gt = prepara(tp);
    if ((s.prev || 0) > 0 && window.__prevArea) {
      const ICONE = [[/clearsky_day|fair_day/, '☀️'], [/clearsky_night|fair_night/, '🌙'], [/partlycloudy_day/, '⛅'], [/partlycloudy_night|^cloudy|fog/, '☁️'], [/thunder/, '⛈️'], [/heavyrain|heavysleet/, '🌧️'], [/rain|sleet|drizzle/, '🌦️'], [/snow/, '🌨️']];
      const icona = x => { for (const [re, i] of ICONE) if (re.test(x || '')) return i; return '☁️'; };
      if (!window.__pvSprite) {
        const P = window.__prev;
        // senza dati (cloud) il segnaposto: i capoluoghi veri dell'area, col solo nome
        const lista = (P ? P.capoluoghi.filter(c => c.giorni && c.giorni.length) : (window.__capoluoghi || [])).slice().sort((u, v) => u.lon - v.lon);
        const Z = s.prevScala || 1.6, Q = 2 * dpr, F = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
        window.__pvSprite = lista.map(c => {
          const e = (c.giorni || [])[Math.min((c.giorni || []).length - 1, s.prevGiorno || 0)];
          const k = document.createElement('canvas'), g = k.getContext('2d');
          const fNome = `800 ${12.5 * Z}px ${F}`, fTx = `700 ${12 * Z}px ${F}`, fIc = `${30 * Z}px ${F}`;
          g.font = fNome; const wN = g.measureText(c.n).width;
          const mx = e ? e.mx + '°' : '', mn = e ? e.mn + '°' : '';
          g.font = fTx; const wMx = g.measureText(mx).width, wSp = g.measureText(' ').width, wMn = g.measureText(mn).width;
          const padX = 9 * Z, hN = 12.5 * 1.1 * Z, hT = e ? (1 + 12 * 1.1) * Z : 0, padT = 3 * Z, padB = 4 * Z, bord = 1 * Z;
          const wPill = Math.max(wN, wMx + wSp + wMn) + 2 * padX + 2 * bord, hPill = padT + hN + hT + padB + 2 * bord;
          const hIc = e ? 30 * Z : 0, gap = e ? 1 * Z : 0, W = Math.ceil(wPill + 8), H = Math.ceil(hIc + gap + hPill + 8);
          k.width = W * Q; k.height = H * Q; g.scale(Q, Q); g.textAlign = 'center'; g.textBaseline = 'top';
          const cx = W / 2;
          if (e) { g.save(); g.font = fIc; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 1 * Z; g.shadowOffsetY = 1 * Z; g.fillText(icona(e.s), cx, 4); g.restore(); }
          const y0 = 4 + hIc + gap, x0 = cx - wPill / 2, r = 9 * Z;
          g.beginPath(); g.roundRect(x0 + bord / 2, y0 + bord / 2, wPill - bord, hPill - bord, r);
          g.fillStyle = 'rgba(255,255,255,.93)'; g.fill(); g.lineWidth = bord; g.strokeStyle = '#9db4d6'; g.stroke();
          g.font = fNome; g.fillStyle = '#1b3f6e'; g.fillText(c.n, cx, y0 + bord + padT);
          if (e) { g.font = fTx; const yT = y0 + bord + padT + hN + Z, xs = cx - (wMx + wSp + wMn) / 2;
            g.textAlign = 'left'; g.fillStyle = '#c21f1f'; g.fillText(mx, xs, yT); g.fillStyle = '#1856b8'; g.fillText(mn, xs + wMx + wSp, yT); }
          return { k, W, H, c };
        });
        // due targhette che si toccano allo zoom di riferimento: resta la piu' importante, decisa una volta sola
        const zr = s.prevZoomRif || z, prio = x => (x.c.c ? 0 : x.c.s ? 1 : 2) * 1e5 + (x.c.q || 0);
        const prese = [];
        window.__pvSprite.slice().sort((u, v) => prio(u) - prio(v)).forEach(x => {
          const p = m.project(L.latLng(x.c.lat, x.c.lon), zr), b = { x0: p.x - x.W / 2 + 4, x1: p.x + x.W / 2 - 4, y0: p.y - x.H * 0.42, y1: p.y + x.H * 0.42 };
          if (prese.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) x.via = true; else prese.push(b);
        });
        window.__pvSprite = window.__pvSprite.filter(x => !x.via);
      }
      const tot = window.__pvSprite.length;
      gt.imageSmoothingEnabled = true; gt.imageSmoothingQuality = 'high';
      window.__pvSprite.forEach(({ k, W, H, c }, i) => {
        const a = liscia((s.prev - (tot > 1 ? i / (tot - 1) : 0) * 0.6) / 0.4); if (a <= 0.002) return;
        const p = qui([c.lat, c.lon]);
        gt.globalAlpha = a; gt.drawImage(k, p.x - W / 2, p.y - H / 2 + 10 * (1 - a), W, H);
      });
      gt.globalAlpha = 1;
    }

    // la scritta d'angolo dei segnaposto (solo nel cloud: dal PC non c'e')
    let nt = document.getElementById('film-nota');
    if (s.nota) { if (!nt) { nt = document.createElement('div'); nt.id = 'film-nota'; document.body.appendChild(nt); } nt.textContent = s.nota; nt.style.opacity = s.notaOpacita == null ? 1 : s.notaOpacita; nt.style.display = 'block'; }
    else if (nt) nt.style.display = 'none';
    await raf(); await raf();
    return { mancanti };
  }, s);
}

/* i capoluoghi di un'area dal clone della mappa (data/capoluoghi.json): servono al segnaposto delle previsioni */
async function capoluoghi(page, area) {
  await page.evaluate(async area => { const j = await (await fetch('/data/capoluoghi.json')).json(); window.__capoluoghi = j[area] || []; }, area);
}

/* Le regioni a schermo con la vista di adesso: un'immagine in cui ogni regione ha il suo colore (id nel rosso),
   per misurare l'uniformita' della pioggia regione per regione. */
async function mascheraRegioni(page, file) {
  const dati = await page.evaluate(async () => {
    const m = window._mapDebug, gj = await (await fetch('/italia-regioni-confine.geojson')).json();
    const size = m.getSize(), c = document.createElement('canvas'); c.width = size.x; c.height = size.y;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const nomi = [];
    gj.features.forEach((f, i) => {
      nomi.push(f.properties.reg_name);
      const poli = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      g.beginPath();
      for (const pol of poli) for (const ring of pol) ring.forEach(([lo, la], k) => { const p = m.latLngToContainerPoint([la, lo]); k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
      g.fillStyle = `rgb(${i + 1},0,0)`; g.fill('evenodd');
    });
    return { png: c.toDataURL('image/png'), nomi };
  });
  fs.writeFileSync(file, Buffer.from(dati.png.split(',')[1], 'base64'));
  return dati.nomi;
}

module.exports = { apri, scena, capoluoghi, previsioni, satelliteRaggiungibile, mascheraRegioni, satFile, SAT, RAW, FILM, CACHE };
