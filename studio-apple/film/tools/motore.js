/* Motore comune del film e delle foto: apre la mappa VERA in Chromium, toglie ogni interfaccia
   con CSS e script iniettati (mai modifiche al repo della mappa) e disegna una scena alla volta.

   Cosa resta della mappa: la sua istanza Leaflet, la sua drawGrid() con la sua scala di colori
   (mmToRGB, opacita' 0,7, sfumatura bilineare, fasce di Mercatore, ritaglio sul confine), le sue
   tessere dei boschi e del rilievo (repo Mappa-Precipitazioni-Tessere, stesso commit della mappa).
   Cosa si aggiunge: la terra scura (contorno dell'Italia dai confini della mappa) al posto della
   cartina di OpenStreetMap, e la griglia della pioggia calcolata da griglie.py.

   Rete: le tessere vengono da raw.githubusercontent.com (nel cloud jsDelivr e' chiuso) e restano
   in cache/tessere/; i dati delle stazioni sono gia' nel clone della mappa. Tutto il resto che la
   pagina chiede fuori (Google, OpenStreetMap) riceve una risposta vuota. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* quello globale */ }
  const root = execFileSync('npm', ['root', '-g']).toString().trim();
  return require(path.join(root, 'playwright'));
}
const { chromium } = loadPlaywright();

const FILM = path.dirname(__dirname);
const CACHE = path.join(FILM, 'cache');
const TESSERE_COMMIT = '90a532e7a3f95e6cde1fc4fd0ee6fc658ffb2f6d';   // lo stesso di index.html della mappa
const JSDELIVR = `https://cdn.jsdelivr.net/gh/AvventureMicologiche/Mappa-Precipitazioni-Tessere@${TESSERE_COMMIT}/`;
const RAW = `https://raw.githubusercontent.com/AvventureMicologiche/Mappa-Precipitazioni-Tessere/${TESSERE_COMMIT}/`;
const PNG_VUOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==', 'base64');

/* una tessera dal repo delle tessere, con cache su disco e tre tentativi */
function tessera(rel) {
  const f = path.join(CACHE, 'tessere', rel);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  for (let i = 0; i < 4; i++) {
    try {
      const code = execFileSync('curl', ['-s', '-o', f + '.tmp', '-w', '%{http_code}', '--max-time', '30', RAW + rel]).toString();
      if (code === '200') { fs.renameSync(f + '.tmp', f); return fs.readFileSync(f); }
      if (code === '404') { try { fs.unlinkSync(f + '.tmp'); } catch (e) {} return null; }
    } catch (e) { /* riprova */ }
    execFileSync('sleep', [String(2 ** i)]);
  }
  throw new Error('tessera non arrivata: ' + rel);
}

const AGGANCIO = 'window._mapDebug=map;';
const GANCIO = `window.__film={drawGrid:drawGrid,initCanvas:initCanvas,
  imposta:function(p,r,g){gridPoints=p;gridRings=r;activeGridRes=g;},
  canvas:function(){return cvs;},
  fermaTimer:function(){if(drawTimer){clearTimeout(drawTimer);drawTimer=null;}}};`;

const CSS_PULITO = `
  *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
  html,body{background:#000!important;margin:0!important;overflow:hidden!important}
  body>*:not(#map-wrap){display:none!important}
  #map-wrap{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;z-index:1!important}
  #map-wrap>*:not(#map){display:none!important}
  #map{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;background:#000!important}
  #map>*:not(.leaflet-pane){display:none!important}
  .leaflet-control-container,.leaflet-marker-pane,.leaflet-shadow-pane,.leaflet-tooltip-pane,.leaflet-popup-pane{display:none!important}
  .leaflet-overlay-pane>*:not(#film-pioggia){display:none!important}
  .leaflet-tile-pane{display:none!important}
  .leaflet-container{background:#000!important;outline:none!important}
`;

/* Pagina pronta: la mappa vera, senza niente sopra. */
async function apri({ url, larghezza, altezza, scala = 1, griglia }) {
  const browser = await chromium.launch({ args: ['--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'] });
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
  await page.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith(JSDELIVR)) {
      const b = tessera(u.slice(JSDELIVR.length).split('?')[0]);
      return b ? r.fulfill({ status: 200, body: b, contentType: u.endsWith('.json') ? 'application/json' : 'image/png', headers: { 'Access-Control-Allow-Origin': '*' } })
               : r.fulfill({ status: 200, body: PNG_VUOTO, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (u.startsWith(base.origin + '/__film/')) {
      const f = path.join(CACHE, decodeURIComponent(new URL(u).pathname.slice('/__film/'.length)));
      return r.fulfill({ status: 200, body: fs.readFileSync(f) });
    }
    if (u.startsWith(base.origin) && /^\/(index\.html)?$/.test(new URL(u).pathname)) {
      // il gancio: le funzioni della pioggia vivono in una IIFE, si espongono solo durante il render
      const resp = await r.fetch(); let html = await resp.text();
      if (!html.includes(AGGANCIO)) throw new Error('gancio non trovato in index.html: la mappa e\' cambiata, aggiorna AGGANCIO');
      html = html.replace(AGGANCIO, AGGANCIO + GANCIO);
      return r.fulfill({ response: resp, body: html });
    }
    if (u.startsWith(base.origin)) return r.continue();
    // il resto del mondo: una risposta vuota, cosi' la pagina non resta appesa e la console non si riempie
    if (/\.(png|jpe?g|webp)(\?|$)/.test(u) || /tile/.test(u)) return r.fulfill({ status: 200, body: PNG_VUOTO, contentType: 'image/png' });
    return r.fulfill({ status: 204, body: '' });
  });
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'novita=0', { waitUntil: 'load' });
  await page.waitForFunction(() => window._mapDebug && window.__film);
  await page.waitForTimeout(2500);   // la pagina finisce di sistemarsi da sola, poi la si ferma
  await page.addStyleTag({ content: CSS_PULITO });
  await page.evaluate(async ({ griglia, JSDELIVR }) => {
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
    // 3. panes del film, sotto la pioggia (overlayPane sta a 400)
    const pane = (n, z) => { const p = m.createPane(n); p.style.zIndex = z; p.style.pointerEvents = 'none'; return p; };
    pane('film-terra', 150); pane('film-rilievo', 160); pane('film-boschi', 170); pane('film-boschi-tela', 175); pane('film-linee', 450);
    m.getPane('film-boschi').style.visibility = 'hidden';   // le tessere servono solo da sorgente per la tela
    m.getPane('film-rilievo').style.mixBlendMode = 'multiply';
    // 4. terra: il contorno dell'Italia dai confini della mappa
    const contorno = await (await fetch('/__film/italia-contorno.json')).json();
    const linee = await (await fetch('/__film/italia-regioni-linee.json')).json();
    window.__terra = L.geoJSON(contorno, { renderer: L.svg({ pane: 'film-terra', padding: 1 }), interactive: false,
      style: { stroke: false, fill: true, fillColor: '#1b1b1d', fillOpacity: 1 } }).addTo(m);
    window.__linee = L.geoJSON(linee, { renderer: L.svg({ pane: 'film-linee', padding: 1 }), interactive: false,
      style: { color: '#ffffff', weight: 0.8, opacity: 0 } }).addTo(m);
    // 5. rilievo e boschi: le tessere della mappa, solo quelle che esistono (indici delle tessere)
    const VUOTA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==';
    const indB = await (await fetch(JSDELIVR + 'boschi/indice.json')).json();
    const indR = await (await fetch(JSDELIVR + 'rilievo/indice.json')).json();
    window.__gruppiBoschi = indB.gruppi;
    const esisteB = {}; Object.keys(indB.tessere).forEach(z => indB.tessere[z].forEach(([x, y]) => { esisteB[z + '/' + x + '/' + y] = 1; }));
    const esisteR = c => { const pz = indR[c.z]; if (!pz) return false; const iv = pz[c.x]; if (!iv) return false;
      return iv.some(v => typeof v === 'number' ? v === c.y : (c.y >= v[0] && c.y <= v[1])); };
    const Ril = L.TileLayer.extend({ getTileUrl: c => esisteR(c) ? JSDELIVR + 'rilievo/' + c.z + '/' + c.x + '/' + c.y + '.png' : VUOTA });
    const Bos = L.TileLayer.extend({ getTileUrl: c => esisteB[c.z + '/' + c.x + '/' + c.y] ? JSDELIVR + 'boschi/' + c.z + '/' + c.x + '/' + c.y + '.png' : VUOTA });
    window.__rilievo = new Ril('', { pane: 'film-rilievo', minZoom: 5, maxNativeZoom: 13, maxZoom: 19, crossOrigin: 'anonymous', keepBuffer: 0, updateWhenIdle: false, errorTileUrl: VUOTA });
    window.__boschi = new Bos('', { pane: 'film-boschi', minZoom: indB.z_min, maxNativeZoom: indB.z_max, maxZoom: 19, crossOrigin: 'anonymous', keepBuffer: 0, updateWhenIdle: false, errorTileUrl: VUOTA });
    // 6. la pioggia: griglia di griglie.py dentro le variabili della mappa, disegnata dalla SUA drawGrid
    if (griglia) {
      const meta = await (await fetch('/__film/' + griglia + '.json')).json();
      const idx = new Uint16Array(await (await fetch('/__film/' + griglia + '.idx')).arrayBuffer());
      const val = new Uint16Array(await (await fetch('/__film/' + griglia + '.u16')).arrayBuffer());
      const n = meta.celle, GR = meta.passo;
      const pts = new Array(n);
      for (let k = 0; k < n; k++) pts[k] = { lat: meta.lat0 + idx[2 * k] * GR, lon: meta.lon0 + idx[2 * k + 1] * GR, mm: 0 };
      window.__griglia = { meta, val, pts, n };
      window.__film.initCanvas(); window.__film.canvas().id = 'film-pioggia';
      window.__film.imposta(pts, contorno.geometry.type === 'Polygon' ? [contorno.geometry.coordinates] : contorno.geometry.coordinates, GR);
    }
  }, { griglia, JSDELIVR });
  return { browser, page, errori };
}

/* Disegna una scena. s = { centro:[lat,lon], zoom, giorno (0..N, con la virgola = dissolvenza fra due giorni),
   pioggia (opacita' 0..1), rilievo (0..1), boschi (0..1), soglia (mm: i boschi si accendono dove e' piovuto
   almeno tanto), terra ('#rrggbb'), linee (opacita' dei confini fra regioni) } */
async function scena(page, s) {
  await page.evaluate(async s => {
    const m = window._mapDebug;
    const raf = () => new Promise(r => requestAnimationFrame(() => r()));
    m.setView(s.centro, s.zoom, { animate: false, reset: true });
    window.__terra.setStyle({ fillColor: s.terra || '#1b1b1d' });
    window.__linee.setStyle({ opacity: s.linee || 0 });
    const vuoi = (l, on) => { if (on && !m.hasLayer(l)) l.addTo(m); if (!on && m.hasLayer(l)) m.removeLayer(l); };
    vuoi(window.__rilievo, (s.rilievo || 0) > 0); vuoi(window.__boschi, (s.boschi || 0) > 0);
    m.getPane('film-rilievo').style.opacity = s.rilievo || 0;
    const G = window.__griglia;
    if (G) {
      const N = G.meta.fotogrammi - 1, g = Math.max(0, Math.min(N, s.giorno == null ? N : s.giorno));
      const d = Math.min(Math.floor(g), N - 1), t = g - d, a = G.val, n = G.n, o0 = d * n, o1 = (d + 1) * n;
      for (let k = 0; k < n; k++) G.pts[k].mm = ((1 - t) * a[o0 + k] + t * a[o1 + k]) / 10;
      window.__film.drawGrid();
      window.__film.canvas().style.opacity = s.pioggia == null ? 1 : s.pioggia;
    }
    // tessere: si aspetta che ci siano TUTTE; una tessera sbagliata si richiede (niente buchi)
    for (let giro = 0; giro < 400; giro++) {
      await raf();
      let pronte = true;
      for (const l of [window.__rilievo, window.__boschi]) {
        if (!m.hasLayer(l)) continue;
        if (l.isLoading && l.isLoading()) pronte = false;
        for (const key in l._tiles) {
          const t = l._tiles[key], img = t.el;
          if (!t.current) continue;
          if (!t.loaded || !img.complete) { pronte = false; continue; }
          if (img.naturalWidth === 0) { pronte = false; img.src = img.src.split('#')[0] + '#r' + giro; }
        }
      }
      if (pronte) break;
    }
    /* I boschi non si mostrano come tessere: si disegnano su una tela e si ritagliano con la pioggia.
       (Una maschera CSS sul pane di Leaflet non funziona: il pane e' grande 0x0 e Chromium la ignora.) */
    const tela = window.__tela || (window.__tela = (() => {
      const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
      m.getPane('film-boschi-tela').appendChild(c); return c; })());
    const size = m.getSize(), ctx = tela.getContext('2d');
    tela.width = size.x; tela.height = size.y;
    const tl = m.containerPointToLayerPoint([0, 0]);
    tela.style.transform = `translate(${tl.x}px,${tl.y}px)`;
    ctx.clearRect(0, 0, size.x, size.y);
    tela.style.opacity = s.boschi || 0;
    if ((s.boschi || 0) > 0) {
      const box = m.getContainer().getBoundingClientRect();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.globalAlpha = 0.7;   // OPACITA della mappa boschi
      for (const key in window.__boschi._tiles) {
        const t = window.__boschi._tiles[key];
        if (!t.current || !t.el.naturalWidth) continue;
        const r = t.el.getBoundingClientRect();
        ctx.drawImage(t.el, r.left - box.left, r.top - box.top, r.width, r.height);
      }
      ctx.globalAlpha = 1;
      const G = window.__griglia;
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
        if (!G.cella) { G.cella = new Int32Array(M.nx * M.ny).fill(-1); for (let k = 0; k < n; k++) G.cella[Math.round((G.pts[k].lat - M.lat0) / GR) * M.nx + Math.round((G.pts[k].lon - M.lon0) / GR)] = k; }
        const morb = s.morbido || 25;
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
          const k = G.cella[(y0 + yy) * M.nx + x0 + xx]; if (k < 0) continue;
          const mm = a[fin + k] / 10, u = Math.max(0, Math.min(1, (mm - s.soglia + morb) / (2 * morb)));
          const o = ((h - 1 - yy) * w + xx) * 4; px[o] = px[o + 1] = px[o + 2] = 255; px[o + 3] = Math.round(255 * u * u * (3 - 2 * u));
        }
        g2.putImageData(im, 0, 0);
        // in vista ci sono al massimo due-tre gradi: il Mercatore e' lineare a meno di un pixel
        const nw = m.latLngToContainerPoint([M.lat0 + (y1 + 0.5) * GR, M.lon0 + (x0 - 0.5) * GR]);
        const se = m.latLngToContainerPoint([M.lat0 + (y0 - 0.5) * GR, M.lon0 + (x1 + 0.5) * GR]);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(c, nw.x, nw.y, se.x - nw.x, se.y - nw.y);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    await raf(); await raf();
  }, s);
}

module.exports = { apri, scena, FILM, CACHE };
