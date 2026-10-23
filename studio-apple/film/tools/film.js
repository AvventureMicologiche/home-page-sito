#!/usr/bin/env node
/* Il film d'apertura, fotogramma per fotogramma, dalla mappa vera senza interfaccia.
   La sceneggiatura e i tempi sono in racconto.js. Dalla radice del repo (Windows o Linux):

     node studio-apple/film/tools/film.js --mappa <cartella clone mappa> [--satellite] [--chrome <chrome.exe>] [--ffmpeg <ffmpeg.exe>]

   fa tutto: la griglia della pioggia se manca (griglie.py), i fotogrammi in film/frames/, la codifica (mp4 1080 e
   720, poster, stills), le misure (fluidita.png, uniformita.png). Senza --satellite la foto aerea e' il SEGNAPOSTO
   (il cloud); con --satellite si leggono le tessere Esri da cache/satellite/, che deve averle tutte: prima
     node studio-apple/film/tools/scarica-satellite.js
   Altre opzioni:
     --prova 0,3,10.5      un fotogramma per ognuno di quei secondi, in film/prova/
     --da 300 --a 420      solo quei fotogrammi (riprende un render interrotto: salta quelli gia' fatti)
     --rifai               riscrive anche i fotogrammi gia' fatti
     --solo-codifica       rifa' mp4, poster, stills e misure dai fotogrammi gia' fatti
     --bosco lat,lon,zoom  il punto d'arrivo dello zoom (predefinito: Foreste Casentinesi, vedi racconto.js)
     --python <comando>    per griglie.py e le misure (predefinito: python)
     --codificatore <nome> forza il codificatore H.264 di ffmpeg (predefinito: libx264, se c'e')
   Le scritte le mette la pagina (SCRITTE_FILM in home-v2/index.html). */
'use strict';
const fs = require('fs');
const path = require('path');
const { FILM, CACHE, arg, scarica, scaricaTutti, serverMappa, lanciaChrome, ffmpeg, codificatori, esegui, preparaGriglia } = require('./comune');
const { apri, scena, mascheraRegioni, satFile, SAT, RAW } = require('./motore');
const RC = require('./racconto');
const { FPS, DUR, N, W, H, T, VERT, SUF } = RC;

const FRAMES = path.join(FILM, 'frames' + SUF);

function leggiBosco() {
  const b = arg('bosco', null);
  if (!b || b === true) return RC.BOSCO_PREDEFINITO;
  const [lat, lon, zoom] = String(b).split(',').map(Number);
  if (![lat, lon].every(Number.isFinite)) { console.error('--bosco lat,lon[,zoom], per esempio --bosco 43.869,11.809,15.6'); process.exit(2); }
  return { centro: [lat, lon], zoom: Number.isFinite(zoom) ? zoom : RC.BOSCO_PREDEFINITO.zoom };
}
const R = RC.crea({ bosco: leggiBosco() });

/* gli indici del repo delle tessere: quali tessere di boschi e rilievo esistono */
async function indici() {
  const b = JSON.parse(await scarica(RAW + 'boschi/indice.json', path.join(CACHE, 'tessere', 'boschi', 'indice.json')));
  const r = JSON.parse(await scarica(RAW + 'rilievo/indice.json', path.join(CACHE, 'tessere', 'rilievo', 'indice.json')));
  const esB = new Set(); Object.keys(b.tessere).forEach(z => b.tessere[z].forEach(([x, y]) => esB.add(z + '/' + x + '/' + y)));
  return {
    boschi: { zmin: b.z_min, zmax: b.z_max, esiste: (z, x, y) => esB.has(z + '/' + x + '/' + y) },
    rilievo: { zmin: 5, zmax: 13, esiste: (z, x, y) => { const pz = r[z]; const iv = pz && pz[x]; return !!iv && iv.some(v => typeof v === 'number' ? v === y : (y >= v[0] && y <= v[1])); } },
  };
}

function italia() {
  const set = RC.italiaZ12(JSON.parse(fs.readFileSync(path.join(CACHE, 'italia-contorno.json'))));
  return { set, inItalia: RC.inItaliaFatto(set) };
}

async function main() {
  fs.mkdirSync(FRAMES, { recursive: true });
  if (arg('camera', false)) return graficoCamera();
  const prova = arg('prova', null);
  if (!arg('solo-codifica', false)) {
    // ffmpeg si controlla SUBITO (che parta e che sappia fare H.264), non dopo mezz'ora di fotogrammi
    if (!prova) codificatore(ffmpeg());
    const griglia = preparaGriglia(arg('mappa', null));
    const vuoleSat = !!arg('satellite', false);
    const IT = italia();
    // ── prima di scattare: TUTTE le tessere sul disco (nessuna tessera che arriva in ritardo) ──
    if (vuoleSat) {
      const lista = RC.tessereFilm(R, 'sat', { inItalia: IT.inItalia });
      const mancano = lista.filter(([z, x, y]) => !fs.existsSync(satFile(z, x, y)));
      if (mancano.length) {
        console.error(`⚠️ --satellite: in cache/satellite mancano ${mancano.length} tessere su ${lista.length}.\n` +
          '   Prima: node studio-apple/film/tools/scarica-satellite.js' + (arg('bosco', null) ? ' --bosco ' + arg('bosco') : ''));
        process.exit(1);
      }
      console.log(`satellite: tutte le ${lista.length} tessere sono in cache/satellite`);
    }
    const ind = await indici();
    const lista = [];
    for (const q of ['boschi', 'rilievo']) for (const [z, x, y] of RC.tessereFilm(R, q, ind[q])) {
      const rel = `${q}/${z}/${x}/${y}.png`;
      lista.push([RAW + rel, path.join(CACHE, 'tessere', rel)]);
    }
    const daScaricare = lista.filter(([, f]) => !fs.existsSync(f));
    if (daScaricare.length) {
      console.log(`tessere di boschi e rilievo: ${daScaricare.length} da scaricare (su ${lista.length})`);
      const { errori } = await scaricaTutti(daScaricare, { etichetta: 'boschi e rilievo', quanti: 8 });
      if (errori.length) { console.error('⚠️ non arrivate:', errori.slice(0, 5).join('\n')); process.exit(1); }
    }

    const srv = await serverMappa(arg('mappa', null));
    const { browser, page, errori } = await apri({ url: srv.url, larghezza: W, altezza: H, griglia,
      satellite: vuoleSat ? 'cache' : false, segnaposto: !vuoleSat, italia: [...IT.set] });
    const primo = path.join(FRAMES, 'f00000.png');
    const lista2 = prova ? String(prova).split(',').map(s => Math.round(parseFloat(s) * FPS))
                         : Array.from({ length: N }, (_, i) => i).filter(i => i >= +arg('da', 0) && i <= +arg('a', N - 1));
    const dir = prova ? path.join(FILM, 'prova') : FRAMES;
    fs.mkdirSync(dir, { recursive: true });
    /* i fotogrammi gia' fatti valgono solo se fatti con la stessa fonte del satellite e lo stesso bosco (frames/fonte.json):
       se no si buttano tutti, cosi' un film non mescola mai segnaposto e foto vera; un render interrotto riparte da dov'era */
    const fonte = JSON.stringify({ satellite: vuoleSat ? 'esri' : 'segnaposto', bosco: R.bosco });
    const marca = path.join(FRAMES, 'fonte.json');
    if (!prova && (!fs.existsSync(marca) || fs.readFileSync(marca, 'utf8') !== fonte)) {
      fs.readdirSync(FRAMES).filter(f => /^f\d{5}\.png$/.test(f)).forEach(f => fs.unlinkSync(path.join(FRAMES, f)));
      fs.writeFileSync(marca, fonte);
    }
    const rifai = !!arg('rifai', false);
    if (!prova && rifai && lista2.includes(0)) { try { fs.unlinkSync(primo); } catch (e) {} }
    const t0 = Date.now();
    let fatti = 0, tavolo = null;
    for (const i of lista2) {
      const f = path.join(dir, `f${String(i).padStart(5, '0')}.png`);
      if (!prova && !rifai && fs.existsSync(f)) continue;
      const s = R.statoAl(i / FPS, { segnaposto: !vuoleSat });
      let r = await scena(page, s);
      if (r.mancanti.length) {   // una seconda volta (un'immagine decodificata male), poi ci si ferma: niente buchi
        await page.evaluate(m => m.forEach(u => window.__img.delete(u)), r.mancanti);
        r = await scena(page, s);
        if (r.mancanti.length) throw new Error(`fotogramma ${i}: ${r.mancanti.length} immagini non arrivate, per esempio ${r.mancanti[0]}`);
      }
      const png = await page.screenshot({ type: 'png' });
      if (s.loop > 0) {
        /* IL LOOP: il primo fotogramma sopra, sempre piu' pieno, cosi' il film si richiude su se stesso.
           ⚠️ Non con un <img> sopra la mappa (com'era) ne' con globalAlpha su una tela: la fusione a 8 bit di Chrome
           tronca, e appena l'opacita' arrivava a 1/255 TUTTO il fotogramma scendeva di un livello di colpo (misurato:
           un picco a 23,07 s). Ora la mescola si fa pixel per pixel, (1 - a) x questo fotogramma + a x il primo,
           arrotondata: con a quasi zero il fotogramma resta identico. */
        const p0 = [path.join(dir, 'f00000.png'), primo].find(f => fs.existsSync(f));
        if (!p0) throw new Error('serve prima il fotogramma 0');
        if (!tavolo) { tavolo = await browser.newPage(); await tavolo.setContent('<canvas></canvas>'); }
        const b64 = await tavolo.evaluate(async ({ io, primo, a }) => {
          const carica = async src => { const im = new Image(); im.src = src; await im.decode(); return im; };
          window.__primo = window.__primo || await carica(primo);
          const im = await carica(io), c = document.querySelector('canvas');
          c.width = im.width; c.height = im.height;
          const g = c.getContext('2d', { willReadFrequently: true });
          if (!window.__p0) { g.drawImage(window.__primo, 0, 0); window.__p0 = g.getImageData(0, 0, c.width, c.height).data; }
          g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height), p = d.data, q = window.__p0;
          for (let k = 0; k < p.length; k += 4) for (let j = 0; j < 3; j++) p[k + j] = Math.round(p[k + j] + a * (q[k + j] - p[k + j]));
          g.putImageData(d, 0, 0);
          return c.toDataURL('image/png').split(',')[1];
        }, { io: 'data:image/png;base64,' + png.toString('base64'), primo: 'data:image/png;base64,' + fs.readFileSync(p0).toString('base64'), a: s.loop });
        fs.writeFileSync(f, Buffer.from(b64, 'base64'));
      } else fs.writeFileSync(f, png);
      fatti++;
      if (i % 60 === 0 || prova) {
        const al = (Date.now() - t0) / 1000 / fatti, resta = (lista2.length - fatti) * al;
        console.log(`fotogramma ${i}/${N - 1}  t=${(i / FPS).toFixed(2)}s  zoom=${s.zoom.toFixed(3)}  ${al.toFixed(2)} s a fotogramma, mancano circa ${(resta / 60).toFixed(0)} min`);
      }
    }
    // le regioni a schermo, per la misura dell'uniformita' della pioggia
    await scena(page, R.statoAl(0));
    const nomi = await mascheraRegioni(page, path.join(CACHE, 'regioni' + SUF + '.png'));
    fs.writeFileSync(path.join(CACHE, 'regioni' + SUF + '.json'), JSON.stringify(nomi));
    if (errori.length) console.log('errori della pagina:', errori);
    await browser.close(); srv.chiudi();
    if (prova) return;
    fs.writeFileSync(path.join(FILM, 'film-fonti.json'), JSON.stringify({ satellite: vuoleSat ? 'esri' : 'segnaposto', bosco: R.bosco, fatto: new Date().toISOString() }, null, 1));
  }
  await codifica();
  graficoCamera();
  misura();
}

/* ── la codifica ── */
const ATTIVI = (enc, n) => new RegExp('^\\s*V\\S*\\s+' + n + '\\s', 'm').test(enc);
/* il codificatore H.264: --codificatore, o libx264, o il primo di Windows / della scheda video che c'e' */
function codificatore(ff) {
  const enc = codificatori(ff);
  const scelto = arg('codificatore', null) || ['libx264', 'h264_mf', 'h264_nvenc', 'h264_qsv', 'h264_amf', 'libopenh264'].find(n => ATTIVI(enc, n));
  if (!scelto || !ATTIVI(enc, scelto)) {
    console.error(`⚠️ ${ff} non ha ${scelto || 'nessun codificatore H.264'}. Scarica ffmpeg da https://www.gyan.dev/ffmpeg/builds/ («essentials») e passa --ffmpeg <percorso>.`);
    process.exit(1);
  }
  return scelto;
}
async function codifica() {
  const mancano = Array.from({ length: N }, (_, i) => i).filter(i => !fs.existsSync(path.join(FRAMES, `f${String(i).padStart(5, '0')}.png`)));
  if (mancano.length) { console.log('mancano', mancano.length, 'fotogrammi, per esempio', mancano.slice(0, 5)); process.exit(1); }
  const ff = ffmpeg(), enc = codificatori(ff);
  // il codificatore scelto e, se non parte (una scheda video che non c'e'), gli altri H.264 che ffmpeg dice di avere
  const prima = codificatore(ff);
  const candidati = [prima, ...['h264_mf', 'h264_nvenc', 'h264_qsv', 'h264_amf', 'libopenh264', 'libx264'].filter(n => n !== prima && ATTIVI(enc, n))];
  const colore = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
  const ingresso = ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.png')];
  fs.mkdirSync(CACHE, { recursive: true });
  /* ⚠️ DUE PASSATE, NON CRF (seconda sessione, misurato): a parita' di peso il codificatore sposta la banda dove
     serve (qui: lo zoom sulle chiome) invece di sprecarla sulle parti ferme. */
  const video = (scelto, vf, media, tetto, out) => {
    if (scelto === 'libx264') {
      const log = path.join(CACHE, 'passate-' + path.basename(out, '.mp4'));
      const args = [...ingresso, '-vf', vf + ',format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-tune', 'film',
        '-pix_fmt', 'yuv420p', ...colore, '-movflags', '+faststart', '-an', '-b:v', media, '-maxrate', tetto, '-bufsize', String(parseInt(tetto) * 2) + 'k', '-passlogfile', log];
      esegui(ff, [...args, '-pass', '1', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null']);
      esegui(ff, [...args, '-pass', '2', out]);
    } else {
      const pf = /qsv|mf/.test(scelto) ? 'nv12' : 'yuv420p';
      esegui(ff, [...ingresso, '-vf', vf + ',format=' + pf, '-c:v', scelto, '-b:v', String(Math.round(parseInt(media) * 1.25)) + 'k', '-maxrate', tetto,
        '-bufsize', String(parseInt(tetto) * 2) + 'k', '-g', '120', ...colore, '-movflags', '+faststart', '-an', out]);
    }
  };
  let fatto = false;
  for (const scelto of candidati) {
    console.log('codifica con', scelto, scelto === 'libx264' ? '(due passate)' : '(⚠️ senza libx264: una passata, qualita\' un po\' piu\' bassa; meglio un ffmpeg con libx264)');
    try {
      video(scelto, (VERT ? 'scale=1080:1350' : 'scale=1920:1080') + ':out_color_matrix=bt709:out_range=tv', process.env.MEDIA_1080 || '2600k', process.env.TETTO_1080 || '7000k', path.join(FILM, 'apertura' + SUF + '-1080.mp4'));
      video(scelto, (VERT ? 'scale=720:900' : 'scale=1280:720') + ':flags=lanczos:out_color_matrix=bt709:out_range=tv', process.env.MEDIA_720 || '740k', process.env.TETTO_720 || '2000k', path.join(FILM, 'apertura' + SUF + '-720.mp4'));
      fatto = true; break;
    } catch (e) { console.log(`⚠️ ${scelto} non e' andato (${e.message.split('\n')[0]}), provo il prossimo`); }
  }
  if (!fatto) { console.error('⚠️ nessun codificatore H.264 ha funzionato: serve un ffmpeg con libx264 (https://www.gyan.dev/ffmpeg/builds/), poi --solo-codifica --ffmpeg <percorso>.'); process.exit(1); }
  // il poster: il primo fotogramma in WebP (con ffmpeg se ha libwebp, se no lo codifica Chrome)
  const poster = path.join(FILM, 'apertura' + SUF + '-poster.webp'), f0 = path.join(FRAMES, 'f00000.png');
  if (ATTIVI(enc, 'libwebp')) esegui(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', f0, '-c:v', 'libwebp', '-quality', '82', poster]);
  else {
    const browser = await lanciaChrome(), page = await browser.newPage();
    const b64 = await page.evaluate(async src => { const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0);
      return c.toDataURL('image/webp', 0.82).split(',')[1]; }, 'data:image/png;base64,' + fs.readFileSync(f0).toString('base64'));
    fs.writeFileSync(poster, Buffer.from(b64, 'base64')); await browser.close();
  }
  /* gli stills: uno al secondo, e uno ogni mezzo secondo nelle dissolvenze (pioggia, boschi, satellite, inizio
     dello zoom, loop). still-09s.jpg serve anche a verify.js. */
  const stills = path.join(FILM, 'stills' + SUF);
  fs.rmSync(stills, { recursive: true, force: true }); fs.mkdirSync(stills, { recursive: true });
  const dentro = t => [T.pioggia, [T.pioggiaVia[0], T.boschi[1]], T.satellite, [T.zoom[0], T.zoom[0] + 3], T.loop].some(([a, b]) => t >= a - 0.01 && t <= b + 0.01);
  for (let k = 0; k < Math.floor(DUR * 2); k++) {
    const t = k / 2;
    if (k % 2 && !dentro(t)) continue;
    const nome = k % 2 ? `still-${String(Math.floor(t)).padStart(2, '0')}.5s.jpg` : `still-${String(t).padStart(2, '0')}s.jpg`;
    esegui(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(FRAMES, `f${String(Math.round(t * FPS)).padStart(5, '0')}.png`),
      '-vf', 'scale=1280:-2', '-q:v', '4', path.join(stills, nome)]);
  }
  for (const f of ['apertura' + SUF + '-1080.mp4', 'apertura' + SUF + '-720.mp4', 'apertura' + SUF + '-poster.webp'])
    console.log(f, (fs.statSync(path.join(FILM, f)).size / 1048576).toFixed(2), 'MB');
}

/* la velocita' della telecamera, fotogramma per fotogramma: lo spostamento a schermo del centro (pixel) e lo zoom
   (pixel che si allontanano all'angolo dello schermo). Una curva sola, senza spigoli. */
function graficoCamera() {
  const righe = ['t,pan_px,zoom_px'];
  for (let i = 1; i <= N; i++) {
    const a = R.CAMERA[i - 1], b = R.CAMERA[i], pa = RC.proj(a.centro), pb = RC.proj(b.centro), sc = 256 * 2 ** b.zoom;
    righe.push(`${(i / FPS).toFixed(4)},${(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * sc).toFixed(4)},${(Math.abs(b.zoom - a.zoom) * Math.LN2 * Math.hypot(W, H) / 2).toFixed(4)}`);
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(path.join(CACHE, 'camera' + SUF + '.csv'), righe.join('\n'));
}

/* le misure, in Python (numpy, pillow, matplotlib): fluidita.png e uniformita.png. Se Python non c'e', lo dice e
   il film resta fatto. */
function misura() {
  const py = arg('python', 'python');
  const fp = RC.fotogrammiPioggia();
  const passi = [
    ['fluidita.py', '--frames', FRAMES, '--camera', path.join(CACHE, 'camera' + SUF + '.csv'), '--out', path.join(FILM, 'fluidita' + SUF + '.png'), '--fps', String(FPS),
      '--zone', JSON.stringify({ 'pioggia sale': T.pioggia, 'pioggia → boschi': [T.pioggiaVia[0], T.boschi[1]], 'satellite': T.satellite, 'zoom': T.zoom, 'loop': T.loop })],
    ['uniformita.py', '--frames', FRAMES, '--regioni', path.join(CACHE, 'regioni' + SUF + '.png'), '--nomi', path.join(CACHE, 'regioni' + SUF + '.json'),
      '--base', String(fp.base), '--pieno', String(fp.pieno), '--lista', fp.lista.join(','), '--fps', String(FPS), '--out', path.join(FILM, 'uniformita' + SUF + '.png')],
  ];
  for (const [script, ...a] of passi) {
    try { esegui(py, [path.join(__dirname, script), ...a]); }
    catch (e) { console.log(`⚠️ ${script} non e' andato (${e.message.split('\n')[0]}): il film e' fatto, manca solo la misura.`); }
  }
}

module.exports = { R };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
