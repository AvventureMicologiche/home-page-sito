#!/usr/bin/env node
/* Il film d'apertura, fotogramma per fotogramma, dalla mappa vera senza interfaccia.

   Prima:  python3 studio-apple/film/tools/griglie.py --mappa /tmp/mappa --da 2026-09-22 --giorni 30
           (cd /tmp/mappa && python3 -m http.server 8899 --bind 127.0.0.1)
   Poi, dalla radice del repo:
     node studio-apple/film/tools/film.js                 tutti i fotogrammi in film/frames/, poi stills e codifica
     node studio-apple/film/tools/film.js --da 300 --a 420 solo quei fotogrammi (riprende un render interrotto)
     node studio-apple/film/tools/film.js --prova 0,6,9,11,13   un fotogramma per ognuno di quei secondi, in film/prova/
     node studio-apple/film/tools/film.js --solo-codifica  rifa' solo stills, mp4 e poster dai fotogrammi gia' fatti
   Opzioni: --mappa http://127.0.0.1:8899/  --griglia pioggia-2026-09-22-30g  --rifai (riscrive i fotogrammi gia' fatti)

   Racconto (14 s a 60 fotogrammi): l'Italia scura, la pioggia vera dei 30 giorni che compare e si accumula
   giorno per giorno; la telecamera scende piano sulla Liguria; la pioggia lascia il posto al rilievo e ai
   boschi, che si accendono prima dove e' piovuto di piu'; dissolvenza sul primo fotogramma per il loop. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { apri, scena, FILM } = require('./motore');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const URLMAPPA = arg('mappa', 'http://127.0.0.1:8899/');
const GRIGLIA = arg('griglia', 'pioggia-2026-09-22-30g');
const FPS = 60, DUR = 14, N = FPS * DUR;
const W = 1920, H = 1080;
const FRAMES = path.join(FILM, 'frames');

// ── il racconto ─────────────────────────────────────────────────────────────
const ITALIA = { centro: [41.85, 12.5], zoom: 6.62 };     // l'Italia intera in 1920x1080, con margine
const LIGURIA = { centro: [44.27, 8.95], zoom: 9.12 };     // la regione intera, il mare sotto
const GIORNI = 30;
const TERRA_BUIA = [0x1b, 0x1b, 0x1d], TERRA_RILIEVO = [0x3c, 0x3c, 0x3f];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const liscia = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };      // smootherstep
const tratto = (t, a, b) => liscia((t - a) / (b - a));
const mix = (a, b, u) => a + (b - a) * u;
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/* volo alla van Wijk e Nuij (lo stesso di Leaflet flyTo), con la curva di tempo scelta qui */
function volo(da, a) {
  const proj = ([lat, lon], z) => { const s = 256 * 2 ** z, y = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
    return [s * (lon + 180) / 360, s * (1 - y / Math.PI) / 2]; };
  const unproj = ([x, y], z) => { const s = 256 * 2 ** z;
    return [360 / Math.PI * Math.atan(Math.exp(Math.PI * (1 - 2 * y / s))) - 90, x / s * 360 - 180]; };
  const z0 = da.zoom, p0 = proj(da.centro, z0), p1 = proj(a.centro, z0);
  const w0 = Math.max(W, H), w1 = w0 * 2 ** (z0 - a.zoom), u1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
  const rho = 1.42, rho2 = rho * rho;
  const r = i => { const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
    return Math.log(Math.sqrt(b * b + 1) - b); };
  const r0 = r(0), S = (r(1) - r0) / rho;
  return p => {
    const s = clamp(p) * S, w = w0 * Math.cosh(r0) / Math.cosh(r0 + rho * s);
    const u = w0 * (Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2;
    const c = unproj([p0[0] + (p1[0] - p0[0]) * u / u1, p0[1] + (p1[1] - p0[1]) * u / u1], z0);
    return { centro: p >= 1 ? a.centro.slice() : c, zoom: p >= 1 ? a.zoom : z0 + Math.log2(w0 / w) };
  };
}
const viaggio = volo(ITALIA, LIGURIA);

function statoAl(t) {
  // telecamera: una sola curva continua. L'avvicinamento lento sull'Italia, il volo, la deriva sulla regione
  // si sovrappongono, cosi' la velocita' non si azzera mai in mezzo al film.
  const v = viaggio(tratto(t, 6.4, 11.0));
  const zoom = v.zoom - 0.10 * (1 - tratto(t, 0, 7.6)) + 0.13 * tratto(t, 9.6, DUR);
  const centro = [v.centro[0] + 0.03 * tratto(t, 9.6, DUR), v.centro[1] + 0.10 * tratto(t, 9.6, DUR)];
  const u = tratto(t, 9.6, 11.6);
  return {
    centro, zoom,
    giorno: GIORNI * clamp((t - 0.5) / 6.4),                     // 30 giorni in 6,4 s, a velocita' costante
    // la pioggia si abbassa mentre i boschi si accendono, poi se ne va: il rilievo sale solo quando lei e' quasi sparita
    // (regola della mappa: mai il rilievo sotto la pioggia piena, scurisce i colori e fa sembrare piu' millimetri)
    pioggia: 1 - 0.55 * tratto(t, 9.6, 10.9) - 0.45 * tratto(t, 10.9, 12.4),
    linee: 0.10 * (1 - tratto(t, 8.2, 9.8)),
    terra: hex(TERRA_BUIA.map((c, i) => mix(c, TERRA_RILIEVO[i], u))),
    rilievo: tratto(t, 10.6, 12.2),
    boschi: t >= 9.7 ? 1 : 0,
    soglia: mix(320, 25, tratto(t, 9.7, 12.7)),                    // i boschi si accendono prima dove e' piovuto di piu'
    morbido: 30,
    loop: tratto(t, DUR - 0.8, DUR, true)                            // dissolvenza sul primo fotogramma
  };
}

async function main() {
  fs.mkdirSync(FRAMES, { recursive: true });
  const prova = arg('prova', null);
  const soloCod = arg('solo-codifica', false);
  if (!soloCod) {
    const { browser, page, errori } = await apri({ url: URLMAPPA, larghezza: W, altezza: H, griglia: GRIGLIA });
    const primo = path.join(FRAMES, 'f00000.png');
    const lista = prova ? String(prova).split(',').map(s => Math.round(parseFloat(s) * FPS))
                        : Array.from({ length: N }, (_, i) => i).filter(i => i >= +arg('da', 0) && i <= +arg('a', N - 1));
    const dir = prova ? path.join(FILM, 'prova') : FRAMES;
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    for (const i of lista) {
      const f = path.join(dir, `f${String(i).padStart(5, '0')}.png`);
      if (!prova && !arg('rifai', false) && fs.existsSync(f)) continue;
      const s = statoAl(i / FPS);
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
      if (i % 30 === 0 || prova) console.log(`fotogramma ${i}/${N - 1}  t=${(i / FPS).toFixed(2)}s  zoom=${s.zoom.toFixed(3)}  giorno=${s.giorno.toFixed(2)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    if (errori.length) console.log('errori della pagina:', errori);
    await browser.close();
    if (prova) return;
  }
  codifica();
}

function codifica() {
  const mancano = Array.from({ length: N }, (_, i) => i).filter(i => !fs.existsSync(path.join(FRAMES, `f${String(i).padStart(5, '0')}.png`)));
  if (mancano.length) { console.log('mancano', mancano.length, 'fotogrammi, per esempio', mancano.slice(0, 5)); process.exit(1); }
  const ff = (() => { try { execFileSync('ffmpeg', ['-version']); return 'ffmpeg'; } catch (e) {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); } })();
  const colore = ['-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
  const comune = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-movflags', '+faststart', '-an', ...colore];
  const ingresso = ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.png')];
  // CRF 16 con un tetto di banda: la qualita' la decide il CRF, il tetto tiene il peso nei limiti
  execFileSync(ff, [...ingresso, '-vf', 'scale=1920:1080:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    ...comune, '-maxrate', process.env.TETTO_1080 || '2600k', '-bufsize', '5200k', path.join(FILM, 'apertura-1080.mp4')], { stdio: 'inherit' });
  execFileSync(ff, [...ingresso, '-vf', 'scale=1280:720:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    ...comune, '-maxrate', process.env.TETTO_720 || '820k', '-bufsize', '1640k', path.join(FILM, 'apertura-720.mp4')], { stdio: 'inherit' });
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(FRAMES, 'f00000.png'), '-c:v', 'libwebp', '-quality', '82', path.join(FILM, 'apertura-poster.webp')], { stdio: 'inherit' });
  const stills = path.join(FILM, 'stills');
  fs.mkdirSync(stills, { recursive: true });
  for (let s = 0; s < DUR; s += 2) execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(FRAMES, `f${String(s * FPS).padStart(5, '0')}.png`),
    '-q:v', '3', path.join(stills, `still-${String(s).padStart(2, '0')}s.jpg`)]);
  for (const f of ['apertura-1080.mp4', 'apertura-720.mp4', 'apertura-poster.webp'])
    console.log(f, (fs.statSync(path.join(FILM, f)).size / 1048576).toFixed(2), 'MB');
}

module.exports = { statoAl, ITALIA, LIGURIA };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
