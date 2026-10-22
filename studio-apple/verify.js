#!/usr/bin/env node
/* Verifica della guida e del mockup della home, con screenshot di ogni sezione.

   Uso, dalla radice del repo:
     node studio-apple/verify.js            controlli + screenshot in studio-apple/screenshot/
     node studio-apple/verify.js --no-shots solo i controlli

   Serve Playwright con Chromium. Se manca:  npm i -D playwright  e poi  npx playwright install chromium
   (non serve un server: lo script ne apre uno suo sulla radice del repo, porta libera a caso).
   Esce con codice 1 se un controllo fallisce. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* prova quello globale */ }
  try {
    const root = require('child_process').execSync('npm root -g').toString().trim();
    return require(path.join(root, 'playwright'));
  } catch (e) {
    console.error('Playwright non trovato. Installa con: npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}
const { chromium } = loadPlaywright();

const STUDIO = __dirname;
const REPO = path.dirname(STUDIO);
const SHOTS = path.join(STUDIO, 'screenshot');
const DO_SHOTS = !process.argv.includes('--no-shots');
const GUIDE = path.join(STUDIO, 'brand-guide.html');
const HERO = path.join(STUDIO, 'brand-guide-hero.html');
const DISC = 'Not affiliated with or endorsed by Apple. Trademarks belong to their owners.';
const SECTIONS = ['cover', 'overview', 'contents', 'rebuild', 'typography', 'fonts', 'colour', 'layout',
  'components', 'imagery', 'voice', 'tokens', 'method'];
const HOME_SECTIONS = ['.nav', '#mappa', '.tiles-sec', '.numbers', '#youtube', '#quiz', '#chi-siamo', 'footer'];

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? '  ok   ' : '  NO   ') + name + (detail ? '  (' + detail + ')' : ''));
}

/* server statico minimo sulla radice del repo: il mockup usa ../../immagini e /esame-tartufi/ */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(REPO, path.normalize(p));
    if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    const size = fs.statSync(f).size;
    const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {   // i video vogliono le richieste a pezzi
      const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
      return fs.createReadStream(f, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/* carica tutte le immagini lazy scorrendo fino in fondo */
async function scrollAll(page) {
  await page.evaluate(async () => {
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
    scrollTo(0, 0);
    // ⚠️ con un limite di tempo: un'immagine lazy mai partita non chiama mai onload
    await Promise.race([new Promise(r => setTimeout(r, 4000)),
      Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); })))]);
  });
}

async function shotSections(page, selectors, prefix, width) {
  if (!DO_SHOTS) return;
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (!el) continue;
    const name = sel.replace(/[^a-z0-9-]/gi, '') || 'x';
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await el.screenshot({ path: path.join(SHOTS, `${prefix}-${width}-${name}.jpg`), type: 'jpeg', quality: 72 });
  }
}

async function guideChecks(browser, file, label, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, reducedMotion: 'reduce', offline: true });
  const page = await ctx.newPage();
  const external = [], errors = [];
  page.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) external.push(u); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await scrollAll(page);
  const tag = `${label} @${width}`;
  check(`${tag}: zero richieste esterne senza rete`, external.length === 0, external.slice(0, 3).join(', '));
  check(`${tag}: zero errori in console`, errors.length === 0, errors.slice(0, 2).join(' | '));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${tag}: niente scorrimento orizzontale`, sw <= width, `scrollWidth ${sw}`);

  if (width === 1440) {
    const missing = await page.evaluate(ids => ids.filter(id => !document.getElementById(id)), SECTIONS);
    check(`${tag}: sezioni presenti e in ordine`, missing.length === 0 && await page.evaluate(ids => {
      const els = ids.map(id => document.getElementById(id));
      return els.every((e, i) => i === 0 || (els[i - 1].compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING));
    }, SECTIONS), missing.join(', '));
    const un = await page.evaluate(d => ['#cover', '#topbar', 'footer'].map(s => {
      const t = document.querySelector(s).innerText.replace(/\s+/g, ' ');
      return s + ':' + (t.includes('Unofficial analysis') && t.includes(d));
    }), DISC);
    check(`${tag}: «Unofficial analysis» e avviso in copertina, barra e piede`, un.every(x => x.endsWith('true')), un.join(' '));
    const q = await page.evaluate(() => [document.querySelectorAll('#quotes blockquote').length, document.querySelectorAll('#rules li').length]);
    check(`${tag}: 5 citazioni e 3 regole`, q[0] === 5 && q[1] === 3, `${q[0]} citazioni, ${q[1]} regole`);
    const ct = await page.evaluate(() => document.querySelectorAll('#contents .toc li').length);
    check(`${tag}: Contents con 8 schede`, ct === 8, ct + ' schede');
    const dash = await page.evaluate(() => (document.body.innerText.match(/—/g) || []).length);
    check(`${tag}: nessun trattino lungo nei testi visibili`, dash === 0, dash + ' trovati');

    /* prova di ricostruzione: stili calcolati = token */
    const rb = await page.evaluate(() => {
      const cs = s => getComputedStyle(document.querySelector(s));
      const b = cs('#rb-button'), l = cs('#rb-card-light'), d = cs('#rb-card-dark');
      return {
        button: { height: b.height, padding: b.padding, radius: b.borderTopLeftRadius, bg: b.backgroundColor, fg: b.color, size: b.fontSize, weight: b.fontWeight, tracking: b.letterSpacing },
        light: { radius: l.borderTopLeftRadius, padding: l.padding, bg: l.backgroundColor },
        dark: { radius: d.borderTopLeftRadius, padding: d.padding, bg: d.backgroundColor }
      };
    });
    const wantB = { height: '44px', padding: '11px 21px', radius: '980px', bg: 'rgb(0, 113, 227)', fg: 'rgb(255, 255, 255)', size: '17px', weight: '400', tracking: '-0.37px' };
    const badB = Object.keys(wantB).filter(k => rb.button[k] !== wantB[k]).map(k => `${k}=${rb.button[k]}`);
    check(`${tag}: bottone ricostruito = token`, badB.length === 0, badB.join(', ') || JSON.stringify(rb.button));
    const badL = [['radius', '28px'], ['padding', '0px'], ['bg', 'rgb(255, 255, 255)']].filter(([k, v]) => rb.light[k] !== v).map(([k]) => `${k}=${rb.light[k]}`);
    check(`${tag}: scheda chiara ricostruita = token`, badL.length === 0, badL.join(', '));
    const badD = [['radius', '28px'], ['padding', '0px'], ['bg', 'rgb(29, 29, 31)']].filter(([k, v]) => rb.dark[k] !== v).map(([k]) => `${k}=${rb.dark[k]}`);
    check(`${tag}: scheda scura ricostruita = token`, badD.length === 0, badD.join(', '));

    /* etichetta su ogni immagine */
    const want = label === 'guida-hero' ? 'Immagine da avventuremicologiche.it' : 'Spazio immagine';
    const lab = await page.evaluate(w => {
      const m = [...document.querySelectorAll('.media')];
      const bad = m.filter(x => { const c = x.closest('.slot') && x.closest('.slot').querySelector('.credit'); return !c || !c.textContent.includes(w); });
      return [m.length, bad.length];
    }, want);
    check(`${tag}: etichetta su ogni spazio immagine`, lab[1] === 0 && lab[0] > 0, `${lab[0]} immagini, ${lab[1]} senza etichetta`);
    if (label === 'guida-hero') {
      const img = await page.evaluate(() => [...document.querySelectorAll('.media')].filter(x => !getComputedStyle(x).backgroundImage.includes('data:image/webp')).length);
      check(`${tag}: ogni spazio immagine ha la foto WebP`, img === 0, img + ' senza foto');
    }
  }
  await shotSections(page, SECTIONS.map(s => '#' + s).concat(['footer']), label, width);
  await ctx.close();
}

async function homeChecks(browser, base, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 } });
  const page = await ctx.newPage();
  const external = [], errors = [];
  let bytes = 0;
  page.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) external.push(u); });
  page.on('response', async r => { try { const b = await r.body(); bytes += b.length; } catch (e) { /* i video a pezzi */ const l = +(r.headers()['content-length'] || 0); bytes += l; } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/studio-apple/home/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const tag = `home @${width}`;
  check(`${tag}: peso all'apertura sotto 1,5 MB`, bytes < 1.5 * 1024 * 1024, (bytes / 1024 / 1024).toFixed(2) + ' MB');
  check(`${tag}: zero errori in console`, errors.length === 0, errors.slice(0, 2).join(' | '));
  check(`${tag}: zero richieste esterne`, external.length === 0, external.slice(0, 3).join(', '));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${tag}: niente scorrimento orizzontale`, sw <= width, `scrollWidth ${sw}`);
  if (width === 390) {
    const pills = await page.evaluate(() => [...document.querySelectorAll('.pill')].filter(p => {
      const r = p.getBoundingClientRect(), pr = p.parentElement.getBoundingClientRect();
      return Math.abs(r.width - pr.width) > 1;
    }).length);
    check(`${tag}: pillole a tutta larghezza`, pills === 0, pills + ' pillole piu\' strette');
  } else {
    const v = await page.evaluate(() => {
      const vs = [...document.querySelectorAll('video')];
      return { n: vs.length, auto: vs.filter(x => x.autoplay).length, pre: vs.filter(x => x.getAttribute('preload') !== 'none').length,
        poster: vs.filter(x => !x.poster).length, heroPlaying: !document.querySelector('#mappa video').paused,
        tilePlaying: [...document.querySelectorAll('.tile video')].filter(x => !x.paused).length };
    });
    // preload si legge nell'HTML scritto: lo script lo porta a "auto" sul filmato che parte, ed e' giusto cosi'
    const src = fs.readFileSync(path.join(STUDIO, 'home', 'index.html'), 'utf8');
    const tags = src.match(/<video\b[^>]*>/g) || [];
    v.pre = tags.filter(t => !/preload="none"/.test(t)).length;
    v.auto = Math.max(v.auto, tags.filter(t => /\bautoplay\b/.test(t)).length);
    check(`${tag}: 5 filmati, niente autoplay, preload none, poster`, v.n === 5 && tags.length === 5 && v.auto === 0 && v.pre === 0 && v.poster === 0, JSON.stringify(v));
    check(`${tag}: parte solo il filmato nello schermo`, v.heroPlaying && v.tilePlaying === 0, `testata ${v.heroPlaying}, riquadri in moto ${v.tilePlaying}`);
    const links = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')];
      const has = (h, t) => a.some(x => x.href === h && (!t || x.textContent.trim() === t));
      return {
        mappa: has('https://precipitazioni.avventuremicologiche.it/', 'Apri la mappa'),
        funghi: has('https://precipitazioni.avventuremicologiche.it/funghi/', 'Le località più bagnate'),
        radar: a.some(x => x.href.includes('?r=lombardia,veneto,emilia&radar=ora')),
        boschi: a.some(x => x.href.includes('?r=trentino&boschi=1')),
        prev: a.some(x => x.href.includes('?r=liguria&m=prev')),
        yt: a.some(x => x.href === 'https://www.youtube.com/@avventuremicologiche' && x.textContent.includes('Guarda il canale')),
        quiz: a.some(x => x.getAttribute('href') === '/esame-tartufi/' && x.textContent.trim() === 'Prova il quiz'),
        regioni: ['lombardia', 'piemonte', 'emilia-romagna', 'liguria', 'campania', 'lazio', 'marche', 'toscana']
          .filter(r => a.some(x => x.getAttribute('href') === `/esame-tartufi/${r}/`)).length,
        mail: a.some(x => x.href === 'mailto:avventuremicologiche@gmail.com'),
        social: ['youtube.com', 'facebook.com', 'instagram.com', 'suno.com'].filter(s => a.some(x => x.href.includes(s))).length
      };
    });
    const bad = Object.entries(links).filter(([k, v]) => k === 'regioni' ? v !== 8 : k === 'social' ? v !== 4 : !v).map(([k, v]) => k + '=' + v);
    check(`${tag}: link della mappa, YouTube, quiz, 8 regioni, social, mail`, bad.length === 0, bad.join(', '));
    const txt = await page.evaluate(() => ({ dash: (document.body.innerText.match(/—/g) || []).length, bang: (document.body.innerText.match(/!/g) || []).length }));
    check(`${tag}: niente trattini lunghi e niente punti esclamativi`, txt.dash === 0 && txt.bang === 0, JSON.stringify(txt));
  }
  await scrollAll(page);
  await page.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()));
  await shotSections(page, HOME_SECTIONS, 'home', width);
  await ctx.close();
}

(async () => {
  const t0 = Date.now();
  if (DO_SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  console.log('File');
  const kb = f => fs.statSync(f).size / 1024;
  check('brand-guide.html sotto 150 KB', kb(GUIDE) <= 150, kb(GUIDE).toFixed(1) + ' KB');
  check('brand-guide-hero.html sotto 4 MB', kb(HERO) <= 4096, (kb(HERO) / 1024).toFixed(2) + ' MB');
  let tok = null;
  try { tok = JSON.parse(fs.readFileSync(path.join(STUDIO, 'tokens.json'), 'utf8')); } catch (e) { /* sotto */ }
  const leaves = [];
  (function walk(o, p) { for (const [k, v] of Object.entries(o || {})) { if (k.startsWith('$')) continue; if (v && typeof v === 'object') { if ('$value' in v) leaves.push([p + k, v]); else walk(v, p + k + '.'); } } })(tok, '');
  const colorsNoOk = leaves.filter(([k, v]) => k.startsWith('color.') && !(v.$extensions && v.$extensions.oklch));
  check('tokens.json valido (W3C, $value su ogni token, OKLCH sui colori)', tok && leaves.length > 40 && colorsNoOk.length === 0, leaves.length + ' token');
  const css = fs.readFileSync(path.join(STUDIO, 'tokens.css'), 'utf8');
  check('tokens.css con i token misurati', css.includes('--color-action: #0071e3') && css.includes('--ease-brand: cubic-bezier(0, 0, 0.5, 1)'));

  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  try {
    for (const w of [1440, 390]) {
      console.log(`\nGuida @${w}`);
      await guideChecks(browser, GUIDE, 'guida', w);
      console.log(`\nGuida con le foto @${w}`);
      await guideChecks(browser, HERO, 'guida-hero', w);
      console.log(`\nMockup home @${w}`);
      await homeChecks(browser, base, w);
    }
  } finally {
    await browser.close();
    srv.close();
  }
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} controlli passati in ${((Date.now() - t0) / 1000).toFixed(1)} s` +
    (DO_SHOTS ? `, screenshot in ${path.relative(REPO, SHOTS)}/` : ''));
  if (DO_SHOTS) fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
