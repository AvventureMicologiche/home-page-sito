/* Quello che serve a tutti gli strumenti del film, scritto perche' giri uguale su Windows e su Linux
   (terza sessione, 22/10/2026). Niente percorsi fissi, niente curl/sleep/python3/npm chiamati da fuori:
     --mappa <cartella>     il clone del repo della mappa (sola lettura); il server lo accende questo modulo
     --chrome <percorso>    il Chrome installato (playwright-core, che non scarica Chromium)
     --ffmpeg <percorso>    l'ffmpeg da usare (sul PC quello di CapCut)
     --python <comando>     per griglie.py e le misure (predefinito: python)
   Senza --chrome si usa il Chromium di Playwright, se c'e' (il cloud). La rete passa da fetch di Node:
   nel cloud, dietro il proxy, si lancia con NODE_USE_ENV_PROXY=1 (dal PC non serve). */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const FILM = path.dirname(__dirname);
const CACHE = path.join(FILM, 'cache');

/* --nome valore, oppure --nome da solo (= true) */
function arg(n, d) {
  const i = process.argv.indexOf('--' + n);
  if (i < 0) return d;
  const v = process.argv[i + 1];
  return v != null && !v.startsWith('--') ? v : true;
}

const attesa = ms => new Promise(ok => setTimeout(ok, ms));

/* Un file dalla rete con cache su disco: si scrive in .tmp e si rinomina, cosi' un'interruzione non lascia mai un
   file a meta' (e chi riparte lo riscarica). null se il server dice 404; dopo `tentativi` errori, eccezione. */
async function scarica(url, f, { tentativi = 4, tempo = 30, intestazioni = {} } = {}) {
  if (fs.existsSync(f)) return fs.readFileSync(f);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  let ultimo = '';
  for (let i = 0; i < tentativi; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(tempo * 1000), headers: { 'User-Agent': 'avventuremicologiche-film/1.0', ...intestazioni } });
      if (r.status === 200) {
        const b = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(f + '.tmp', b); fs.renameSync(f + '.tmp', f);
        return b;
      }
      if (r.status === 404) return null;
      ultimo = 'HTTP ' + r.status;
    } catch (e) { ultimo = (e.cause && e.cause.message) || e.message; }
    if (i < tentativi - 1) await attesa(1000 * 2 ** i);
  }
  try { fs.unlinkSync(f + '.tmp'); } catch (e) {}
  throw new Error(`non arrivato (${ultimo}): ${url}`);
}

/* tanti file insieme, `quanti` alla volta, con l'avanzamento stampato su una riga */
async function scaricaTutti(lista, { quanti = 8, etichetta = 'file', ...opt } = {}) {
  let fatti = 0, i = 0, byte = 0; const errori = [];
  const t0 = Date.now();
  const riga = () => process.stdout.write(`\r  ${etichetta}: ${fatti}/${lista.length}  ${(byte / 1048576).toFixed(1)} MB  ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
  async function lavoratore() {
    while (i < lista.length) {
      const [url, f] = lista[i++];
      try { const b = await scarica(url, f, opt); if (b) byte += b.length; } catch (e) { errori.push(e.message); }
      fatti++;
      if (fatti % 25 === 0 || fatti === lista.length) riga();
    }
  }
  await Promise.all(Array.from({ length: Math.min(quanti, lista.length) }, lavoratore));
  if (lista.length) process.stdout.write('\n');
  return { errori, byte };
}

/* Il server della mappa: la cartella del clone servita su 127.0.0.1 da Node, senza un'altra finestra aperta.
   Se --mappa e' gia' un indirizzo (http://...), si usa quello. */
const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
async function serverMappa(mappa) {
  if (!mappa || mappa === true) {
    console.error('Manca --mappa <cartella>: la cartella del clone di Mappa-Precipitazioni-Nord (vedi STATO.md, «Dal PC»).');
    process.exit(2);
  }
  if (/^https?:\/\//.test(mappa)) return { url: mappa.endsWith('/') ? mappa : mappa + '/', chiudi: () => {} };
  const radice = path.resolve(mappa);
  if (!fs.existsSync(path.join(radice, 'index.html'))) {
    console.error(`--mappa ${mappa}: li' dentro non c'e' index.html. Serve la cartella del clone della mappa.`);
    process.exit(2);
  }
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(radice, p);
    if (!f.startsWith(radice) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPI[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}/`, cartella: radice, chiudi: () => srv.close() };
}

/* Chromium: con --chrome il Chrome installato (playwright-core, niente download), altrimenti quello di Playwright */
function playwright() {
  const prove = ['playwright-core', 'playwright'];
  for (const p of prove) { try { return require(p); } catch (e) { /* il prossimo */ } }
  // quello globale (il cloud): la cartella di npm root -g, senza chiamare npm (su Windows e' npm.cmd)
  const glob = path.join(path.dirname(process.execPath), process.platform === 'win32' ? '' : '../lib', 'node_modules');
  for (const p of prove) { try { return require(path.join(glob, p)); } catch (e) { /* il prossimo */ } }
  console.error('Manca playwright-core. Dalla radice del repo: npm install --prefix studio-apple/film');
  process.exit(2);
}
async function lanciaChrome() {
  const { chromium } = playwright();
  const chrome = arg('chrome', null);
  if (chrome && !fs.existsSync(chrome)) { console.error(`--chrome ${chrome}: il file non c'e'.`); process.exit(2); }
  return chromium.launch({ executablePath: chrome || undefined, headless: true,
    args: ['--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none', '--force-color-profile=srgb'] });
}

/* ffmpeg: --ffmpeg <percorso>, oppure quello nel PATH */
function ffmpeg() {
  const ff = arg('ffmpeg', 'ffmpeg');
  const r = spawnSync(ff, ['-hide_banner', '-version']);
  if (r.error || r.status !== 0) { console.error(`ffmpeg non parte (${ff}). Passa il percorso con --ffmpeg "C:/.../ffmpeg.exe".`); process.exit(2); }
  return ff;
}
function codificatori(ff) {
  return spawnSync(ff, ['-hide_banner', '-encoders']).stdout.toString();
}
/* un programma esterno; si ferma con un messaggio chiaro se non va */
function esegui(prog, args, { muto = false } = {}) {
  const r = spawnSync(prog, args, { stdio: muto ? 'pipe' : 'inherit' });
  if (r.error) throw new Error(`${prog} non parte: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${prog} ${args.slice(0, 6).join(' ')}... e' uscito con ${r.status}` + (muto ? '\n' + r.stderr : ''));
  return r;
}

/* La griglia della pioggia e il contorno dell'Italia (cache/): se mancano, li fa griglie.py dal clone della mappa.
   Serve Python con numpy, scipy e shapely (pip install numpy scipy shapely pillow matplotlib). */
const GRIGLIA = 'pioggia-2026-09-22-30g-liscia';
function preparaGriglia(mappa) {
  if (fs.existsSync(path.join(CACHE, GRIGLIA + '.json')) && fs.existsSync(path.join(CACHE, 'italia-contorno.json'))) return GRIGLIA;
  if (!mappa || mappa === true || /^https?:/.test(mappa)) {
    console.error('Manca la griglia della pioggia in cache/ e per farla serve --mappa <cartella del clone della mappa>.');
    process.exit(2);
  }
  const py = arg('python', 'python');
  console.log(`la griglia della pioggia non c'e' ancora: la fa griglie.py (${py}, circa 30 secondi)`);
  const r = spawnSync(py, [path.join(__dirname, 'griglie.py'), '--mappa', path.resolve(mappa), '--da', '2026-09-22', '--giorni', '30', '--liscia', '0.03'], { stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    console.error(`griglie.py non e' andato (${r.error ? r.error.message : 'uscita ' + r.status}). Serve Python con numpy scipy shapely:\n` +
      `  ${py} -m pip install numpy scipy shapely pillow matplotlib\noppure passa il comando giusto con --python "C:/.../python.exe".`);
    process.exit(2);
  }
  return GRIGLIA;
}

module.exports = { FILM, CACHE, GRIGLIA, preparaGriglia, arg, attesa, scarica, scaricaTutti, serverMappa, lanciaChrome, ffmpeg, codificatori, esegui };
