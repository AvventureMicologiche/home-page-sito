#!/usr/bin/env node
/* Il film d'apertura, fotogramma per fotogramma, dalla mappa vera senza interfaccia.

   Prima:  python3 studio-apple/film/tools/griglie.py --mappa /tmp/mappa --da 2026-09-22 --giorni 30
           (cd /tmp/mappa && python3 -m http.server 8899 --bind 127.0.0.1)
   Poi, dalla radice del repo:
     node studio-apple/film/tools/film.js                     tutti i fotogrammi in film/frames/, poi codifica, stills, misura
     node studio-apple/film/tools/film.js --satellite --previsioni   DAL PC: la foto aerea vera e le previsioni di oggi
     node studio-apple/film/tools/film.js --da 300 --a 420    solo quei fotogrammi (riprende un render interrotto)
     node studio-apple/film/tools/film.js --prova 0,6,9,13    un fotogramma per ognuno di quei secondi, in film/prova/
     node studio-apple/film/tools/film.js --solo-codifica     rifa' mp4, poster e stills dai fotogrammi gia' fatti
     node studio-apple/film/tools/film.js --camera            solo il grafico della velocita' della telecamera
   Opzioni: --mappa http://127.0.0.1:8899/  --griglia pioggia-2026-09-22-30g  --rifai (riscrive i fotogrammi gia' fatti)
   Con --satellite o --previsioni i fotogrammi si rifanno tutti (--rifai implicito): cambiano le scene.

   Racconto (24 s a 60 fotogrammi, una sola curva di telecamera che non si ferma mai):
   l'Italia scura; compaiono i pallini di una parte dei pluviometri; la pioggia vera dei 30 giorni nasce da li' e
   si accumula in modo continuo, i pallini sfumano; volo sulla Liguria; la pioggia sfuma mentre si accendono i
   boschi, prima dove e' piovuto di piu'; sotto i boschi sfuma dentro il satellite e ci si avvicina fino alle
   chiome; si torna larghi sulla regione e compaiono, una dopo l'altra, le previsioni dei capoluoghi;
   dissolvenza sul primo fotogramma per il loop. Le scritte le mette la pagina (TEMPI in home-v2/index.html). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { apri, scena, capoluoghi, previsioni, satelliteRaggiungibile, FILM, CACHE } = require('./motore');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const URLMAPPA = arg('mappa', 'http://127.0.0.1:8899/');
const GRIGLIA = arg('griglia', 'pioggia-2026-09-22-30g');
const FPS = 60, DUR = 24, N = FPS * DUR;
const W = 1920, H = 1080;
const FRAMES = path.join(FILM, 'frames');
const AREA = 'liguria';

// ── il racconto ─────────────────────────────────────────────────────────────
const ITALIA = { centro: [41.85, 12.5], zoom: 6.62 };     // l'Italia intera in 1920x1080, con margine
const LIGURIA = { centro: [44.27, 8.95], zoom: 9.12 };     // la regione intera, il mare sotto
const BOSCO = { centro: [44.5395, 9.4566], zoom: 14.3 };   // faggete e castagneti sopra Santo Stefano d'Aveto
const PREVISIONI = { centro: [44.17, 8.83], zoom: 9.05 };  // i capoluoghi della Liguria, da Sanremo alla Spezia
const GIORNI = 30, MORBIDO = 2.5;                          // MORBIDO: ogni giorno entra nel cumulato in 2,5 «giorni»
const TERRA_BUIA = [0x1b, 0x1b, 0x1d], TERRA_RILIEVO = [0x3c, 0x3c, 0x3f], TERRA_FINE = [0x2e, 0x2e, 0x31];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const liscia = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };      // smootherstep
const tratto = (t, a, b) => liscia((t - a) / (b - a));
const mix = (a, b, u) => a + (b - a) * u;
const mixc = (a, b, u) => a.map((v, i) => mix(v, b[i], u));
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// ── la telecamera ───────────────────────────────────────────────────────────
const proj = ([lat, lon]) => { const y = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); return [(lon + 180) / 360, (1 - y / Math.PI) / 2]; };
const unproj = ([x, y]) => [360 / Math.PI * Math.atan(Math.exp(Math.PI * (1 - 2 * y))) - 90, x * 360 - 180];

/* avvicinamento verso un punto: il centro scivola sul punto in proporzione a quanto si stringe la vista,
   cosi' il punto arriva al centro senza sbandate (a zoom alto un tratto di mondo piccolo e' tanto schermo).
   Vale anche all'indietro: allontanandosi, il centro scivola dal punto verso la vista larga. */
function verso(da, a) {
  const pa = proj(da.centro), pb = proj(a.centro), wa = 2 ** -da.zoom, wb = 2 ** -a.zoom;
  return zoom => { const f = clamp((wa - 2 ** -zoom) / (wa - wb)); return [mix(pa[0], pb[0], f), mix(pa[1], pb[1], f)]; };
}
/* LO ZOOM E' UNA CURVA SOLA (Hermite cubica a tratti, con le velocita' scelte a ogni nodo: continua anche nella
   velocita'). [t, zoom, velocita' in livelli al secondo]. Non si ferma mai: in cima, vicino alle chiome, la velocita'
   dello zoom passa per zero ma la telecamera continua a scorrere di lato (DERIVA). */
const NODI = [
  [0.0, 6.62, 0.016],     // l'Italia, ci si avvicina appena
  [9.2, 6.79, 0.03],      // parte il volo sulla Liguria
  [12.6, 9.12, 0.72],     // la Liguria, senza fermarsi: si continua a scendere
  [18.3, 14.3, 0],        // le chiome (14,3: le tessere dei boschi sono quasi al loro dettaglio vero)
  [21.9, 9.05, -0.07],    // di nuovo la regione intera, per le previsioni
  [24.0, 8.97, -0.03],    // e ci si allontana appena
];
function zoomAl(t) {
  let i = 0; while (i < NODI.length - 2 && t > NODI[i + 1][0]) i++;
  const [t0, z0, v0] = NODI[i], [t1, z1, v1] = NODI[i + 1], h = t1 - t0, u = (t - t0) / h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * z0 + (u3 - 2 * u2 + u) * h * v0 + (-2 * u3 + 3 * u2) * z1 + (u3 - u2) * h * v1;
}
const ITALIA2 = { centro: ITALIA.centro, zoom: NODI[1][1] };
const VERSO1 = verso(ITALIA2, LIGURIA), VERSO2 = verso(LIGURIA, BOSCO), VERSO3 = verso(PREVISIONI, BOSCO);
/* deriva di lato attorno alle chiome: 16 px al secondo a schermo, in salita e in discesa morbide */
const DERIVA = (() => {
  const dt = 1 / 600, out = [[0, 0]]; let ex = 0, ey = 0;
  for (let t = dt; t <= DUR + 1e-9; t += dt) {
    const v = 16 * liscia((t - 15.4) / 1.6) * (1 - liscia((t - 19.4) / 1.6)), sc = 256 * 2 ** zoomAl(t);
    ex += 0.94 * v / sc * dt; ey += -0.34 * v / sc * dt; out.push([ex, ey]);
  }
  return t => out[Math.min(out.length - 1, Math.round(t * 600))];
})();
function cameraGrezza(t) {
  const zoom = zoomAl(t);
  const m = t < 9.2 ? proj(ITALIA.centro) : t < 12.6 ? VERSO1(zoom) : t < 18.3 ? VERSO2(zoom) : t < 21.9 ? VERSO3(zoom)
    : (() => { const p = proj(PREVISIONI.centro), u = t - 21.9; return [p[0] + 0.0000016 * u, p[1] - 0.0000006 * u]; })();
  const d = DERIVA(t);
  return { m: [m[0] + d[0], m[1] + d[1]], zoom };
}
/* Liscia il centro: media gaussiana (sigma 0,35 s) dove il bersaglio cambia (9,2 s e 12,6 s: il centro cambia
   direzione). Il centro si media in coordinate del mondo pesate con la scala dello zoom, cosi' a zoom alto non si
   mescolano posizioni lontane. Lo zoom no: e' gia' liscio. Ai bordi si prolunga in linea retta. */
const CAMERA = (() => {
  const passo = 1 / FPS, sig = 0.35 * FPS, K = Math.round(3 * sig);
  const g = Array.from({ length: 2 * K + 1 }, (_, i) => Math.exp(-0.5 * ((i - K) / sig) ** 2));
  const raw = i => {
    if (i >= 0 && i <= N) return cameraGrezza(i * passo);
    const fuori = i < 0, a = cameraGrezza(fuori ? 0 : DUR), b = cameraGrezza(fuori ? passo : DUR - passo), k = fuori ? -i : i - N;
    return { m: [a.m[0] + k * (a.m[0] - b.m[0]), a.m[1] + k * (a.m[1] - b.m[1])], zoom: zoomAl(i * passo) };
  };
  const R = Array.from({ length: N + 2 * K + 1 }, (_, j) => raw(j - K));
  return Array.from({ length: N + 1 }, (_, i) => {
    const z = R[i + K].zoom; let x = 0, y = 0, sw = 0;
    for (let j = -K; j <= K; j++) { const r = R[i + j + K], w = g[j + K] * 2 ** (r.zoom - z); x += w * r.m[0]; y += w * r.m[1]; sw += w; }
    return { centro: unproj([x / sw, y / sw]), zoom: z };
  });
})();

/* il tempo della pioggia: piu' lento dove piove di piu', veloce nei giorni asciutti, con partenza e arrivo morbidi.
   g va da 0 a GIORNI - 1 + MORBIDO (il cumulato vero alla fine). Il peso viene dalla pioggia media sull'Italia. */
let TEMPO_PIOGGIA = null;
function preparaTempo(medie) {
  const G = GIORNI - 1 + MORBIDO, M = 2000, pesi = [];
  const media = g => { let s = 0; for (let d = 0; d < GIORNI; d++) s += (medie[d + 1] - medie[d]) * liscia((g - d) / MORBIDO); return s; };
  let prec = 0; const cum = [0];
  for (let i = 1; i <= M; i++) { const g = G * i / M, v = media(g); pesi.push(v - prec); prec = v; }
  const mr = pesi.reduce((a, b) => a + b) / M;
  for (let i = 0; i < M; i++) cum.push(cum[i] + 1 + 1.3 * pesi[i] / mr);
  const tot = cum[M];
  TEMPO_PIOGGIA = u => {   // u 0..1 (tempo) -> g (giorni)
    const q = clamp(u) * tot; let lo = 0, hi = M;
    while (hi - lo > 1) { const md = (lo + hi) >> 1; if (cum[md] <= q) lo = md; else hi = md; }
    return G * (lo + (q - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo])) / M;
  };
}

const velZoom = i => { const a = CAMERA[Math.max(0, i - 1)], b = CAMERA[Math.min(N, i + 1)]; return Math.abs(b.zoom - a.zoom) * FPS / 2; };   // livelli al secondo
function statoAl(t, { sat, prev }) {
  const i = Math.round(t * FPS), c = CAMERA[Math.min(N, Math.max(0, i))];
  // la pioggia: 2,2-11 s, con una partenza e un arrivo morbidi (meta' lineare, meta' smootherstep)
  const u = clamp((t - 2.2) / 8.8), ue = 0.5 * u + 0.5 * liscia(u);
  const g = TEMPO_PIOGGIA ? TEMPO_PIOGGIA(ue) : (GIORNI - 1 + MORBIDO) * ue;
  const nascita = g < 10 ? 0.02 + 0.33 * liscia((g - 2.6) / 5) + 0.8 * liscia((g - 7) / 3) : null;   // la prima pioggia (25/9) nasce dai pallini
  const terraU = tratto(t, 11.6, 13.6), terraFine = tratto(t, 18.8, 21.2);
  return {
    centro: c.centro, zoom: c.zoom,
    giorno: g, morbido: MORBIDO, nascita,
    pallini: clamp((t - 0.4) / 2.2) * 1.0001, pallinoVia: clamp((g - 15) / 4.5),                   // i pallini sfumano con la pioggia grande (7-10 ottobre)
    // la pioggia sfuma mentre i boschi si accendono (dissolvenza incrociata), poi se ne va del tutto
    pioggia: 1 - tratto(t, 12.0, 14.8),
    linee: 0.10 * (1 - tratto(t, 9.4, 11.2)),
    terra: hex(mixc(mixc(TERRA_BUIA, TERRA_RILIEVO, terraU), TERRA_FINE, terraFine)),
    // il rilievo sale solo quando la pioggia e' quasi andata (regola della mappa), e alla fine resta morbido
    rilievo: tratto(t, 13.0, 15.0) * (1 - 0.35 * terraFine),
    // vicino alle chiome i boschi si fanno un po' piu' trasparenti: sotto si vede il satellite
    boschi: tratto(t, 11.9, 12.3) * (1 - tratto(t, 18.9, 20.6)) * (1 - 0.4 * tratto(t, 16.0, 17.6) * (1 - tratto(t, 18.4, 19.4))),
    soglia: mix(320, 25, tratto(t, 12.0, 15.2)),                 // prima dove e' piovuto di piu'
    morbidoBoschi: 30,
    sat: tratto(t, 14.6, 16.8) * (1 - tratto(t, 18.7, 20.6)),    // il satellite sfuma dentro SOTTO i boschi
    prev: clamp((t - 20.0) / 2.6) * 1.0001, prevGiorno: 1,
    /* MOSSO: quando lo zoom corre, le tessere si sfumano appena (al massimo 0,9 px), come una cinepresa vera.
       Senza, la discesa sui boschi chiedeva 19 Mbit/s per restare nitida e l'H.264 la impastava. */
    mosso: Math.min(0.9, 0.45 * Math.max(0, velZoom(i) - 0.35)),
    nota: !sat && t > 14.4 && t < 20.9 ? 'segnaposto: il satellite si rifà dal PC' : !prev && t > 19.8 ? 'segnaposto: le previsioni si rifanno dal PC' : null,
    notaOpacita: !sat && t < 20.9 ? tratto(t, 14.4, 15.2) * (1 - tratto(t, 20.2, 20.9)) : tratto(t, 19.8, 20.6),
    loop: tratto(t, DUR - 0.8, DUR)                              // dissolvenza sul primo fotogramma
  };
}

async function main() {
  fs.mkdirSync(FRAMES, { recursive: true });
  if (arg('camera', false)) return graficoCamera();
  const prova = arg('prova', null);
  const soloCod = arg('solo-codifica', false);
  const vuoleSat = !!arg('satellite', false), vuolePrev = !!arg('previsioni', false);
  if (!soloCod) {
    const sat = vuoleSat && satelliteRaggiungibile();
    if (vuoleSat && !sat) console.log('⚠️ satellite chiesto ma server.arcgisonline.com non risponde: resta il segnaposto');
    const datiPrev = previsioni(AREA, vuolePrev);
    if (vuolePrev && !datiPrev) console.log('⚠️ previsioni chieste ma la produzione non risponde: resta il segnaposto');
    const rifai = !!arg('rifai', false) || vuoleSat || vuolePrev;
    const { browser, page, errori } = await apri({ url: URLMAPPA, larghezza: W, altezza: H, griglia: GRIGLIA, satellite: sat, prev: AREA });
    await capoluoghi(page, AREA);
    preparaTempo(await page.evaluate(() => { const G = window.__griglia, n = G.n, out = [];
      for (let d = 0; d < G.meta.fotogrammi; d++) { let s = 0; for (let k = 0; k < n; k++) s += G.val[d * n + k]; out.push(s / n / 10); } return out; }));
    const primo = path.join(FRAMES, 'f00000.png');
    const lista = prova ? String(prova).split(',').map(s => Math.round(parseFloat(s) * FPS))
                        : Array.from({ length: N }, (_, i) => i).filter(i => i >= +arg('da', 0) && i <= +arg('a', N - 1));
    const dir = prova ? path.join(FILM, 'prova') : FRAMES;
    fs.mkdirSync(dir, { recursive: true });
    if (!prova && rifai && lista.includes(0)) { try { fs.unlinkSync(primo); } catch (e) {} }
    const t0 = Date.now();
    for (const i of lista) {
      const f = path.join(dir, `f${String(i).padStart(5, '0')}.png`);
      if (!prova && !rifai && fs.existsSync(f)) continue;
      const s = statoAl(i / FPS, { sat, prev: !!datiPrev });
      await scena(page, s);
      if (s.loop > 0) {   // il primo fotogramma sopra, sempre piu' pieno: il film si richiude su se stesso
        if (!fs.existsSync(primo)) throw new Error('serve prima il fotogramma 0');
        const b64 = fs.readFileSync(primo).toString('base64');
        await page.evaluate(({ b64, a }) => new Promise(ok => {
          let im = document.getElementById('film-loop');
          if (!im) { im = document.createElement('img'); im.id = 'film-loop'; im.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;pointer-events:none'; document.body.appendChild(im); }
          im.style.opacity = a; im.style.display = 'block';
          if (im.dataset.ok) return ok(); im.onload = () => { im.dataset.ok = 1; ok(); }; im.src = 'data:image/png;base64,' + b64;
        }), { b64, a: s.loop });
      } else await page.evaluate(() => { const im = document.getElementById('film-loop'); if (im) im.style.display = 'none'; });
      await page.screenshot({ path: f, type: 'png' });
      if (i % 60 === 0 || prova) console.log(`fotogramma ${i}/${N - 1}  t=${(i / FPS).toFixed(2)}s  zoom=${s.zoom.toFixed(3)}  giorno=${s.giorno.toFixed(2)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    if (errori.length) console.log('errori della pagina:', errori);
    await browser.close();
    fs.writeFileSync(path.join(FILM, 'film-fonti.json'), JSON.stringify({ satellite: sat, previsioni: !!datiPrev,
      previsioniAgg: datiPrev && datiPrev.agg || null, fatto: new Date().toISOString() }, null, 1));
    if (prova) return;
  }
  codifica();
  graficoCamera();
  misura();
}

function ffmpeg() {
  try { execFileSync('ffmpeg', ['-version']); return 'ffmpeg'; } catch (e) {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); }
}

function codifica() {
  const mancano = Array.from({ length: N }, (_, i) => i).filter(i => !fs.existsSync(path.join(FRAMES, `f${String(i).padStart(5, '0')}.png`)));
  if (mancano.length) { console.log('mancano', mancano.length, 'fotogrammi, per esempio', mancano.slice(0, 5)); process.exit(1); }
  const ff = ffmpeg();
  const colore = ['-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
  const comune = crf => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-tune', 'film', '-movflags', '+faststart', '-an', ...colore];
  const ingresso = ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.png')];
  /* La qualita' la decide il CRF; il tetto di banda c'e' solo per stare nei pesi (1080 sui 7-8 MB, 720 sotto i 2,5).
     Si alza se i boschi da vicino si impastano: meglio qualche MB in piu' che il dettaglio sgranato. */
  execFileSync(ff, [...ingresso, '-vf', 'scale=1920:1080:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    ...comune(process.env.CRF_1080 || 17), '-maxrate', process.env.TETTO_1080 || '3000k', '-bufsize', '6000k', path.join(FILM, 'apertura-1080.mp4')], { stdio: 'inherit' });
  execFileSync(ff, [...ingresso, '-vf', 'scale=1280:720:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    ...comune(process.env.CRF_720 || 18), '-maxrate', process.env.TETTO_720 || '800k', '-bufsize', '1600k', path.join(FILM, 'apertura-720.mp4')], { stdio: 'inherit' });
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(FRAMES, 'f00000.png'), '-c:v', 'libwebp', '-quality', '82', path.join(FILM, 'apertura-poster.webp')], { stdio: 'inherit' });
  const stills = path.join(FILM, 'stills');
  fs.rmSync(stills, { recursive: true, force: true }); fs.mkdirSync(stills, { recursive: true });
  for (let s = 0; s < DUR; s++) execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(FRAMES, `f${String(s * FPS).padStart(5, '0')}.png`),
    '-vf', 'scale=1280:-2', '-q:v', '4', path.join(stills, `still-${String(s).padStart(2, '0')}s.jpg`)]);
  for (const f of ['apertura-1080.mp4', 'apertura-720.mp4', 'apertura-poster.webp'])
    console.log(f, (fs.statSync(path.join(FILM, f)).size / 1048576).toFixed(2), 'MB');
}

/* la velocita' della telecamera, fotogramma per fotogramma: lo spostamento a schermo del centro (pixel) e lo zoom
   (pixel che si allontanano all'angolo dello schermo). Una curva sola, senza spigoli. */
function graficoCamera() {
  const righe = ['t,pan_px,zoom_px'];
  for (let i = 1; i <= N; i++) {
    const a = CAMERA[i - 1], b = CAMERA[i], pa = proj(a.centro), pb = proj(b.centro), sc = 256 * 2 ** b.zoom;
    righe.push(`${(i / FPS).toFixed(4)},${(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * sc).toFixed(4)},${(Math.abs(b.zoom - a.zoom) * Math.LN2 * Math.hypot(W, H) / 2).toFixed(4)}`);
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(path.join(CACHE, 'camera.csv'), righe.join('\n'));
}

/* differenza media fra fotogrammi consecutivi (e la velocita' della telecamera) -> film/fluidita.png */
function misura() {
  execFileSync('python3', [path.join(__dirname, 'fluidita.py'), '--frames', FRAMES, '--camera', path.join(CACHE, 'camera.csv'),
    '--out', path.join(FILM, 'fluidita.png'), '--fps', String(FPS)], { stdio: 'inherit' });
}

module.exports = { statoAl, CAMERA, ITALIA, LIGURIA, BOSCO, PREVISIONI, DUR, FPS };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
