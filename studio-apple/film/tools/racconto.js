/* Il racconto del film (terza sessione, 22/10/2026): la sceneggiatura scritta da lui, alla lettera.
   Qui ci sono SOLO i tempi, la telecamera e la lista delle tessere che servono: lo usano film.js (che disegna) e
   scarica-satellite.js (che scarica in anticipo le tessere della foto aerea), cosi' le due liste sono la stessa.

   La telecamera resta FERMA sull'Italia intera finche' non c'e' il satellite. Poi un solo zoom.
   22/10 sera, dal PC (sue correzioni): boschi e satellite entrano INSIEME (niente terra grigia sotto i boschi, niente
   rilievo), i confini delle regioni compaiono tutti insieme e piu' netti, i pallini solo su penisola, Sicilia e Sardegna.
     0,0-2,6   l'Italia scura, i confini compaiono tutti insieme (0,15-0,9), i pluviometri si accendono
     2,4-5,0   la pioggia compare UNIFORME su tutta l'Italia: una griglia sola (il cumulato vero dei 30 giorni,
               levigato) che sale ovunque allo stesso ritmo; i pallini sfumano mentre sale
     5,0-6,2   pausa con la pioggia piena
     6,2-7,8   la pioggia sfuma a zero...
     6,8-9,1   ...mentre sotto entra il satellite (6,8-8,8) e sopra i boschi (7,3-9,1): mai un attimo di Italia vuota
     10,0-21,2 lo zoom: una curva sola di van Wijk e Nuij, tempo morbido, fino alle chiome di una faggeta delle
               Foreste Casentinesi; il retino dei boschi sparisce man mano (zero ai due terzi dello zoom)
     21,5-22,5 dissolvenza sul primo fotogramma: il loop
   Per cambiare il punto d'arrivo: --bosco lat,lon,zoom (vedi STATO.md). */
'use strict';
const FPS = 60, DUR = 22.5, N = FPS * DUR;
/* 23/10, sua richiesta: anche il film VERTICALE per il telefono. FORMATO=verticale -> 1080x1350 (4:5): l'Italia e' stretta
   e alta e in verticale riempie lo schermo. Stessa sceneggiatura, stessi tempi; cambia solo l'inquadratura iniziale. */
const VERT = process.env.FORMATO === 'verticale';
const W = VERT ? 1080 : 1920, H = VERT ? 1350 : 1080;
const SUF = VERT ? '-v' : '';

const ITALIA = { centro: [41.85, 12.5], zoom: 6.62 };
if (VERT) { ITALIA.centro = [42.0, 12.55]; ITALIA.zoom = 6.85; }   // l'Italia intera in 1080x1350, con un po' di margine   // l'Italia intera in 1920x1080, la stessa inquadratura di prima
/* IL PUNTO D'ARRIVO: la faggeta (con macchie di abete bianco) sul crinale fra Campigna e Sasso Fratino, nel Parco
   nazionale delle Foreste Casentinesi. Sasso Fratino e' riserva integrale dal 1959, patrimonio UNESCO: li' non entra
   nessuno, tanto meno a raccogliere. Nelle tessere dei boschi della mappa e' faggeta piena per piu' dei 4 x 2,4 km
   inquadrati alla fine. Zoom 15,6: si vedono le chiome (circa 2 m per pixel). */
const BOSCO_PREDEFINITO = { centro: [43.869, 11.809], zoom: 15.6 };

const T = {
  linee: [0.15, 0.9],           // i confini delle regioni: tutti insieme, con una sola dissolvenza
  pallini: [0.4, 2.6],          // comparsa scaglionata dei pallini (come prima)
  pioggia: [2.4, 5.0],          // la pioggia sale, tutta insieme
  pallinoVia: [3.0, 5.0],       // i pallini sfumano mentre la pioggia sale
  pioggiaVia: [6.2, 7.8],       // la pioggia scende a zero...
  satellite: [6.8, 8.8],        // la foto aerea entra sotto la pioggia che si spegne: niente attimo di Italia vuota
  boschi: [7.3, 9.1],           // ...e i boschi salgono sopra la foto quando la pioggia e' quasi a zero (niente fango)
  zoom: [10.0, 21.2],           // un solo volo
  boschiVia: [0.65, 0.95],      // il retino resta PIENO fino al 65% dello zoom (in livelli) e sparisce fra il 65 e il 95%: solo da vicino (sua richiesta, tre volte)
  loop: [21.5, 22.5],
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const liscia = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };   // smootherstep
const tratto = (t, [a, b]) => liscia((t - a) / (b - a));
const mix = (a, b, u) => a + (b - a) * u;
const mixc = (a, b, u) => a.map((v, i) => mix(v, b[i], u));
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/* Mercatore in [0,1] */
const proj = ([lat, lon]) => { const y = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); return [(lon + 180) / 360, (1 - y / Math.PI) / 2]; };
const unproj = ([x, y]) => [360 / Math.PI * Math.atan(Math.exp(Math.PI * (1 - 2 * y))) - 90, x * 360 - 180];

/* VAN WIJK E NUIJ (2003, «Smooth and efficient zooming and panning»): il cammino che a occhio e' il piu' breve fra
   due viste, con la larghezza della vista w e il centro che si muovono insieme. s e' la lunghezza del cammino
   (percepita), da 0 a S; rho = 1,42 come nell'articolo (e come d3.interpolateZoom). */
function vanWijk(da, a, rho = 1.42) {
  const p0 = proj(da.centro), p1 = proj(a.centro);
  const w0 = W / (256 * 2 ** da.zoom), w1 = W / (256 * 2 ** a.zoom);
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], d2 = dx * dx + dy * dy, d1 = Math.sqrt(d2), r2 = rho * rho;
  let S, f;
  if (d1 < 1e-12) { S = Math.log(w1 / w0) / rho; f = s => ({ p: p0, w: w0 * Math.exp(rho * s) }); }
  else {
    const b0 = (w1 * w1 - w0 * w0 + r2 * r2 * d2) / (2 * w0 * r2 * d1), b1 = (w1 * w1 - w0 * w0 - r2 * r2 * d2) / (2 * w1 * r2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / rho;
    f = s => { const u = w0 / (r2 * d1) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
      return { p: [p0[0] + u * dx, p0[1] + u * dy], w: w0 * Math.cosh(r0) / Math.cosh(rho * s + r0) }; };
  }
  return { S, f };
}

function crea({ bosco = BOSCO_PREDEFINITO } = {}) {
  const VOLO = vanWijk(ITALIA, bosco);
  /* il tempo dello zoom: smootherstep (velocita' e accelerazione zero alla partenza e all'arrivo): niente strappo
     quando la telecamera, ferma da 11 secondi, si muove */
  const camera = t => {
    const u = liscia((t - T.zoom[0]) / (T.zoom[1] - T.zoom[0]));
    if (u <= 0) return { ...ITALIA, u: 0 };
    const { p, w } = VOLO.f(VOLO.S * u);
    return { centro: unproj(p), zoom: Math.log2(W / (256 * w)), u };
  };
  const CAMERA = Array.from({ length: N + 1 }, (_, i) => camera(i / FPS));
  const velZoom = i => { const a = CAMERA[Math.max(0, i - 1)], b = CAMERA[Math.min(N, i + 1)]; return Math.abs(b.zoom - a.zoom) * FPS / 2; };
  const TERRA_BUIA = [0x1b, 0x1b, 0x1d];

  function statoAl(t, { segnaposto = false } = {}) {
    const i = Math.min(N, Math.max(0, Math.round(t * FPS))), c = CAMERA[i];
    // quanto dello zoom e' fatto, in livelli: decide quando sparisce il retino dei boschi
    const fz = clamp((c.zoom - ITALIA.zoom) / (bosco.zoom - ITALIA.zoom));
    const sat = tratto(t, T.satellite);
    return {
      centro: c.centro, zoom: c.zoom,
      giorno: null,                                                       // una griglia sola: il cumulato finale
      pioggia: tratto(t, T.pioggia) * (1 - tratto(t, T.pioggiaVia)),     // opacita' GLOBALE: uguale ovunque
      pallini: clamp((t - T.pallini[0]) / (T.pallini[1] - T.pallini[0])) * 1.0001,
      pallinoVia: clamp((t - T.pallinoVia[0]) / (T.pallinoVia[1] - T.pallinoVia[0])),
      linee: 0.17 * tratto(t, T.linee) * (1 - tratto(t, T.pioggiaVia)),
      terra: hex(TERRA_BUIA),
      rilievo: 0,                                                         // niente rilievo: sotto i boschi c'e' subito il satellite
      boschi: tratto(t, T.boschi) * (1 - liscia((fz - T.boschiVia[0]) / (T.boschiVia[1] - T.boschiVia[0]))), soglia: null,
      sat, satClip: true,
      /* MOSSO: quando lo zoom corre, le tessere si sfumano appena (al massimo 1,2 px), come una cinepresa vera */
      mosso: Math.min(1.2, 0.6 * Math.max(0, velZoom(i) - 0.6)),
      nota: segnaposto && sat > 0 ? 'segnaposto satellite' : null, notaOpacita: sat,
      loop: tratto(t, T.loop),
    };
  }
  return { CAMERA, statoAl, velZoom, bosco };
}

/* ── le tessere di una vista: la stessa aritmetica di livello() in motore.js, con un po' di margine ── */
function tessereVista(centro, zoom, src, spinta, margine = 0.08) {
  const lf = Math.max(src.zmin, Math.min(src.zmax, zoom + spinta)), l0 = Math.floor(lf), f = lf >= src.zmax ? 0 : liscia(lf - l0);
  const livelli = f > 0.001 ? [l0, l0 + 1] : [l0];
  const p = proj(centro), out = [];
  for (const l of livelli) {
    const sc = 256 * 2 ** (zoom - l), cx = p[0] * 256 * 2 ** zoom, cy = p[1] * 256 * 2 ** zoom;
    const pox = cx - W / 2, poy = cy - H / 2, n = 2 ** l;
    const x0 = Math.floor(pox / sc - margine), x1 = Math.floor((pox + W) / sc + margine);
    const y0 = Math.max(0, Math.floor(poy / sc - margine)), y1 = Math.min(n - 1, Math.floor((poy + H) / sc + margine));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([l, ((x % n) + n) % n, y]);
  }
  return out;
}

/* ── l'Italia in tessere: quali tessere toccano la terra (il satellite si ritaglia sul contorno) ──
   Si rasterizza il contorno (cache/italia-contorno.json, da griglie.py) sulle tessere dello z12, con un bordo di una
   tessera; una tessera di un livello piu' basso tocca l'Italia se ci sta dentro una sua figlia dello z12, una di un
   livello piu' alto se ci sta sua madre. Meglio qualche tessera di mare in piu' che un buco. */
const ZI = 12;
function italiaZ12(contorno) {
  const g = contorno.geometry, poli = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const n = 2 ** ZI, set = new Set();
  const segna = (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) set.add((x + a) * n + (y + b)); };
  for (const pol of poli) {
    const anello = pol[0].map(([lon, lat]) => { const p = proj([lat, lon]); return [p[0] * n, p[1] * n]; });
    // i bordi, a passi di un quarto di tessera
    for (let k = 0; k < anello.length; k++) {
      const [ax, ay] = anello[k], [bx, by] = anello[(k + 1) % anello.length];
      const passi = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
      for (let s = 0; s <= passi; s++) segna(Math.floor(ax + (bx - ax) * s / passi), Math.floor(ay + (by - ay) * s / passi));
    }
    // l'interno, riga per riga (pari e dispari al centro della riga)
    let ymin = Infinity, ymax = -Infinity; anello.forEach(([, y]) => { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });
    for (let y = Math.floor(ymin); y <= Math.ceil(ymax); y++) {
      const yc = y + 0.5, xs = [];
      for (let k = 0; k < anello.length; k++) {
        const [ax, ay] = anello[k], [bx, by] = anello[(k + 1) % anello.length];
        if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.floor(xs[k]); x <= Math.floor(xs[k + 1]); x++) segna(x, y);
    }
  }
  return set;
}
function inItaliaFatto(set) {
  const n = 2 ** ZI, sopra = {};
  for (let l = ZI - 1; l >= 0; l--) {
    const s = new Set(), da = l === ZI - 1 ? set : sopra[l + 1], m = 2 ** (l + 1);
    da.forEach(k => { const x = Math.floor(k / m), y = k % m; s.add((x >> 1) * 2 ** l + (y >> 1)); });
    sopra[l] = s;
  }
  return (l, x, y) => l >= ZI ? set.has((x >> (l - ZI)) * n + (y >> (l - ZI))) : sopra[l].has(x * 2 ** l + y);
}

/* Tutte le tessere che il film chiede, fotogramma per fotogramma, senza doppioni: [livello, x, y].
   quale: 'sat' (spinta 0,2, z3-19, solo dove c'e' l'Italia) | 'boschi' | 'rilievo' (spinta 0,35, come in motore.js).
   esiste(l, x, y): per boschi e rilievo, se la tessera c'e' nell'indice del repo delle tessere. */
function tessereFilm(R, quale, { esiste = () => true, inItalia = () => true, zmin = 5, zmax = 13 } = {}) {
  const visti = new Set(), out = [];
  const src = quale === 'sat' ? { zmin: 3, zmax: 19 } : { zmin, zmax }, spinta = quale === 'sat' ? 0.2 : 0.35;
  for (let i = 0; i < N; i++) {
    const s = R.statoAl(i / FPS);
    const serve = quale === 'sat' ? s.sat > 0 : quale === 'boschi' ? s.boschi > 0 : s.rilievo > 0;
    if (!serve) continue;
    for (const [l, x, y] of tessereVista(s.centro, s.zoom, src, spinta)) {
      const k = l + '/' + x + '/' + y;
      if (visti.has(k)) continue;
      visti.add(k);
      if ((quale === 'sat' ? inItalia(l, x, y) : true) && esiste(l, x, y)) out.push([l, x, y]);
    }
  }
  return out;
}

/* I fotogrammi della comparsa della pioggia, per misurarne l'uniformita' regione per regione */
function fotogrammiPioggia() {
  const out = [];
  for (let t = T.pioggia[0]; t <= T.pioggia[1] + 1e-9; t += 0.2) out.push(Math.round(t * FPS));
  return { base: Math.round((T.pioggia[0] - 0.05) * FPS), pieno: Math.round((T.pioggiaVia[0] - 0.1) * FPS), lista: out };
}

module.exports = { VERT, SUF, FPS, DUR, N, W, H, T, ITALIA, BOSCO_PREDEFINITO, crea, tessereVista, tessereFilm, fotogrammiPioggia, italiaZ12, inItaliaFatto, proj, unproj, liscia, tratto, clamp };
