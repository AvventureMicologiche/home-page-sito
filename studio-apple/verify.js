#!/usr/bin/env node
/* Verifica della guida e del mockup della home, con screenshot di ogni sezione.

   Uso, dalla radice del repo:
     node studio-apple/verify.js            controlli + screenshot in studio-apple/screenshot/ (e del v2 in film/screenshot/)
     node studio-apple/verify.js --no-shots solo i controlli
     node studio-apple/verify.js --v2       solo il mockup v2 (home-v2/, film e immagini HD)

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
const SOLO_V2 = process.argv.includes('--v2');
const SHOTS_V2 = path.join(STUDIO, 'film', 'screenshot');
const V2_SECTIONS = [['film', '.film'], ['1-piove', '#piove'], ['2-stazione', '#stazione'], ['3-boschi', '#boschi'],
  ['4-satellite', '#satellite'], ['5-domani', '#domani'], ['chiusura', '.fine'], ['noi', '#noi'], ['piede', 'footer']];
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

/* ── Mockup v2: il film, i capitoli con le immagini HD, la chiusura ── */
async function v2Checks(browser, base, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 } });
  const page = await ctx.newPage();
  const external = [], errors = [];
  let bytes = 0, bytesFilm = 0;
  page.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) external.push(u); });
  page.on('response', async r => {
    let n = 0; try { n = (await r.body()).length; } catch (e) { n = +(r.headers()['content-length'] || 0); }
    if (/\.mp4(\?|$)/.test(r.url())) bytesFilm += n; else bytes += n;
  });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/studio-apple/home-v2/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const tag = `home v2 @${width}`;
  check(`${tag}: apertura senza il film sotto 1 MB`, bytes < 1024 * 1024, (bytes / 1024).toFixed(0) + ' KB (+ film ' + (bytesFilm / 1048576).toFixed(2) + ' MB)');
  const film = await page.evaluate(() => { const v = document.getElementById('film');
    return { src: v.currentSrc.split('/').pop(), muted: v.muted, loop: v.loop, inline: v.playsInline, auto: v.autoplay, poster: !!v.poster, playing: !v.paused }; });
  const want = width < 735 ? 'apertura-720.mp4' : 'apertura-1080.mp4';
  check(`${tag}: il film e' ${want}, muto, in loop, playsinline, autoplay, col poster, e gira`,
    film.src === want && film.muted && film.loop && film.inline && film.auto && film.poster && film.playing, JSON.stringify(film));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${tag}: niente scorrimento orizzontale`, sw <= width, `scrollWidth ${sw}`);
  // ⚠️ la pagina ha scroll-behavior:smooth: qui si scorre a scatti veri, se no non si arriva mai in fondo
  await page.evaluate(async () => {
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += Math.round(innerHeight * 0.6)) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 120)); }
    scrollTo({ top: h(), behavior: 'instant' });
    await Promise.race([new Promise(r => setTimeout(r, 6000)),
      Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); })))]);
  });
  await page.waitForTimeout(1800);   // le comparse durano 1,4 s
  const imgs = await page.evaluate(() => [...document.images].map(i => ({ s: (i.currentSrc || i.src).split('/').pop(), ok: i.complete && i.naturalWidth > 0, lazy: i.loading === 'lazy' })));
  const rotte = imgs.filter(i => !i.ok);
  check(`${tag}: tutte le immagini caricate dopo lo scorrimento`, imgs.length >= 6 && rotte.length === 0, `${imgs.length} immagini` + (rotte.length ? ', rotte: ' + rotte.map(i => i.s).join(' ') : ''));
  const capImgs = await page.evaluate(() => [...document.querySelectorAll('.cap img')].map(i => ({ lazy: i.loading === 'lazy', srcset: !!i.srcset && !!i.sizes })));
  check(`${tag}: capitoli con srcset e sizes, lazy tranne la prima`, capImgs.length === 5 && capImgs.every(i => i.srcset) && !capImgs[0].lazy && capImgs.slice(1).every(i => i.lazy), JSON.stringify(capImgs.map(i => i.lazy)));
  const vis = await page.evaluate(() => [...document.querySelectorAll('.su')].filter(e => getComputedStyle(e).opacity !== '1').length);
  check(`${tag}: tutti i blocchi comparsi dopo lo scorrimento`, vis === 0, vis + ' ancora nascosti');
  check(`${tag}: zero errori in console`, errors.length === 0, errors.slice(0, 2).join(' | '));
  check(`${tag}: zero richieste esterne`, external.length === 0, external.slice(0, 3).join(', '));
  if (width === 1440) {
    const M = 'https://precipitazioni.avventuremicologiche.it';
    const links = await page.evaluate(M => {
      const a = [...document.querySelectorAll('a')], t = x => x.textContent.trim();
      const dentro = (sel, f) => [...document.querySelectorAll(sel + ' a')].some(f);
      return {
        storico: a.filter(x => x.href === M + '/' && t(x) === 'Storico piogge' && x.classList.contains('pill-fill')).length,
        previsioni: a.filter(x => x.href === M + '/?r=liguria&m=prev' && t(x) === 'Previsioni' && x.classList.contains('pill-line')).length,
        titoloDuePillole: document.querySelectorAll('.film .txt .pill').length === 2,
        apriLaMappa: a.some(x => t(x) === 'Apri la mappa' || (t(x) === 'Le località più bagnate' && x.classList.contains('pill'))),
        funghiInPioggia: dentro('#piove', x => x.href === M + '/funghi/' && !x.classList.contains('pill')),
        linkPioggia: dentro('#piove', x => x.href.startsWith(M + '/?r=') && x.href.includes('&g=30')),
        linkStazione: dentro('#stazione', x => x.href.startsWith(M + '/?r=')),
        linkBoschi: dentro('#boschi', x => /\?boschi=1&r=[a-z]+$/.test(x.href)),
        linkSatellite: dentro('#satellite', x => /\?boschi=1&sat=1&r=[a-z]+$/.test(x.href)),
        linkPrevisioni: dentro('#domani', x => x.href.includes('m=prev')),
        yt: a.some(x => x.href === 'https://www.youtube.com/@avventuremicologiche' && t(x) === 'Guarda il canale'),
        ytTitolo: [...document.querySelectorAll('.riq h3')].some(h => t(h) === 'Guarda il nostro canale YouTube.'),
        ytLogoRosso: !!document.querySelector('.riq .pic svg[fill="#FF0000"]'),
        quiz: a.some(x => x.getAttribute('href') === '/esame-tartufi/' && t(x) === 'Prova il quiz'),
        regioni: ['lombardia', 'piemonte', 'emilia-romagna', 'liguria', 'campania', 'lazio', 'marche', 'toscana']
          .filter(r => a.some(x => x.getAttribute('href') === `/esame-tartufi/${r}/`)).length,
        mail: a.some(x => x.href === 'mailto:avventuremicologiche@gmail.com'),
        social: ['youtube.com', 'facebook.com', 'instagram.com', 'suno.com'].filter(s => a.some(x => x.href.includes(s))).length
      };
    }, M);
    const bad = Object.entries(links).filter(([k, v]) => k === 'regioni' ? v !== 8 : k === 'social' ? v !== 4 : k === 'storico' || k === 'previsioni' ? v < 2 : k === 'apriLaMappa' ? v : !v).map(([k, v]) => k + '=' + v);
    check(`${tag}: pillole «Storico piogge» e «Previsioni», link per capitolo, /funghi/ testuale nella pioggia, YouTube, quiz, 8 regioni, social, mail`, bad.length === 0, bad.join(', ') || 'tutti');
    const via = await page.evaluate(() => ({ finestra: !!document.getElementById('finestra'), testo: /13 e 20 giorni|finestra-funghi|Il bosco, ogni mese/.test(document.documentElement.outerHTML) }));
    check(`${tag}: niente capitolo della finestra funghi né «Il bosco, ogni mese»`, !via.finestra && !via.testo, JSON.stringify(via));
    const scr = await page.evaluate(() => { const S = window.SCRITTE_FILM, r = (S && S.righe) || [];
      return { n: r.length, p: document.querySelectorAll('.film .scritte p').length, ordinate: r.every((x, i) => x.da < x.a && (!i || r[i - 1].a + 2 * S.sfuma <= x.da)),
        dentro: r.every(x => x.da - S.sfuma >= 0 && x.a + S.sfuma <= 24), testi: r.map(x => x.testo) }; });
    check(`${tag}: scritte del film dalla pagina (SCRITTE_FILM), in ordine, senza sovrapporsi, dentro i 24 s`, scr.n === 4 && scr.p === 4 && scr.ordinate && scr.dentro, scr.testi.join(' / '));
    const txt = await page.evaluate(() => ({ dash: (document.body.innerText.match(/—/g) || []).length, bang: (document.body.innerText.match(/!/g) || []).length,
      voi: (document.body.innerText.match(/\b(Lei|Voi|vostr[aoie])\b/g) || []).length }));
    check(`${tag}: niente trattini lunghi, punti esclamativi, Lei o voi`, txt.dash + txt.bang + txt.voi === 0, JSON.stringify(txt));
    const tit = await page.evaluate(() => [...document.querySelectorAll('.cap h2')].map(h => h.textContent.trim()));
    const titWant = ['È piovuto qui.', 'Ogni stazione, giorno per giorno.', 'Sui boschi giusti.', 'Come sono davvero.', 'E i prossimi giorni.'];
    check(`${tag}: i cinque capitoli, in ordine`, JSON.stringify(tit) === JSON.stringify(titWant), tit.join(' / '));
  }
  if (DO_SHOTS) {
    fs.mkdirSync(SHOTS_V2, { recursive: true });
    // il film fermo su un fotogramma pieno di pioggia, per lo screenshot
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    // ⚠️ il Chromium di Playwright non decodifica H.264 (Chrome, Safari e Firefox veri si'): nello screenshot il
    // film si vedrebbe solo col poster. Si mette al suo posto uno still del film, a 9 s, con la pioggia piena,
    // e la prima scritta accesa a mano (le scritte seguono i fotogrammi del video, che qui non arrivano).
    await page.evaluate(() => { const v = document.getElementById('film'); v.poster = '../film/stills/still-09s.jpg'; });
    await page.evaluate(() => new Promise(ok => { const v = document.getElementById('film'); v.pause(); v.dataset.fermato = '1';
      v.addEventListener('seeked', () => setTimeout(ok, 400), { once: true }); v.currentTime = 9; setTimeout(ok, 4000); }));
    await page.evaluate(() => { const p = document.querySelector('.film .scritte p'); if (p) { p.style.opacity = 1; p.style.transform = 'none'; } });
    for (const [nome, sel] of V2_SECTIONS) {
      const el = await page.$(sel); if (!el) continue;
      // il menu fisso si toglie dagli screenshot dei capitoli, se no copre il titolo dove la sezione e' piu' alta dello schermo
      await page.evaluate(n => { document.querySelector('.nav').style.visibility = n === 'film' ? '' : 'hidden'; }, nome);
      await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      await el.screenshot({ path: path.join(SHOTS_V2, `v2-${width}-${nome}.jpg`), type: 'jpeg', quality: 78 });
    }
  }
  await ctx.close();

  // «riduci animazioni»: resta il poster
  const ctx2 = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage();
  await p2.goto(base + '/studio-apple/home-v2/', { waitUntil: 'load' });
  await p2.waitForTimeout(1500);
  const r = await p2.evaluate(() => { const v = document.getElementById('film'); return { paused: v.paused, t: v.currentTime, poster: v.poster.split('/').pop() }; });
  check(`${tag}: con «riduci animazioni» il film resta fermo sul poster`, r.paused && r.t === 0 && r.poster === 'apertura-poster.webp', JSON.stringify(r));
  await ctx2.close();
}

function v2Files() {
  const F = path.join(STUDIO, 'film');
  const mb = f => fs.statSync(path.join(F, f)).size / 1048576;
  check('apertura-1080.mp4 sotto 9 MB (nitido prima che leggero)', mb('apertura-1080.mp4') >= 3 && mb('apertura-1080.mp4') <= 9, mb('apertura-1080.mp4').toFixed(2) + ' MB');
  check('apertura-720.mp4 sotto 2,5 MB', mb('apertura-720.mp4') < 2.5, mb('apertura-720.mp4').toFixed(2) + ' MB');
  check('apertura-poster.webp presente', fs.existsSync(path.join(F, 'apertura-poster.webp')));
  try {
    const pr = require('child_process').execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,pix_fmt,color_space,avg_frame_rate:format=duration',
      '-of', 'json', path.join(F, 'apertura-1080.mp4')]).toString();
    const j = JSON.parse(pr), st = j.streams[0], dur = +j.format.duration;
    check('film: H.264, yuv420p, BT.709, 60 fps, fra 18 e 24 s', st.codec_name === 'h264' && st.pix_fmt === 'yuv420p' && st.color_space === 'bt709' && st.avg_frame_rate === '60/1' && dur >= 18 && dur <= 24.1,
      `${st.codec_name} ${st.profile} ${st.pix_fmt} ${st.color_space} ${st.avg_frame_rate} ${dur.toFixed(2)} s`);
  } catch (e) { check('film: ffprobe', false, 'ffprobe non trovato'); }
  const foto = fs.readdirSync(path.join(F, 'foto')).filter(f => f.endsWith('.webp'));
  const troppo = foto.filter(f => fs.statSync(path.join(F, 'foto', f)).size > (f.includes('-2880') ? 600 : 250) * 1024);
  const servono = ['pioggia-nord', 'scheda-stazione', 'boschi-nord', 'satellite', 'previsioni'].flatMap(n => [n + '-1440.webp', n + '-2880.webp']);
  const mancano = servono.filter(f => !foto.includes(f));
  check('immagini HD: le cinque dei capitoli, 2880 sotto 600 KB, 1440 sotto 250 KB, niente finestra funghi', mancano.length === 0 && troppo.length === 0 && !foto.some(f => f.startsWith('finestra')),
    (mancano.length ? 'mancano ' + mancano.join(' ') + '; ' : '') + foto.map(f => f.replace('.webp', '') + ' ' + (fs.statSync(path.join(F, 'foto', f)).size / 1024).toFixed(0)).join(', '));
}

(async () => {
  const t0 = Date.now();
  if (DO_SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  if (SOLO_V2) return soloV2(t0);
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
      console.log(`\nMockup home v2 @${w}`);
      await v2Checks(browser, base, w);
    }
    console.log('\nFile del v2'); v2Files();
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

async function soloV2(t0) {
  console.log('File del v2'); v2Files();
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  try { for (const w of [1440, 390]) { console.log(`\nMockup home v2 @${w}`); await v2Checks(browser, base, w); } }
  finally { await browser.close(); srv.close(); }
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} controlli passati in ${((Date.now() - t0) / 1000).toFixed(1)} s` +
    (DO_SHOTS ? `, screenshot in ${path.relative(REPO, SHOTS_V2)}/` : ''));
  if (DO_SHOTS) fs.writeFileSync(path.join(SHOTS_V2, 'report.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
  process.exit(bad.length ? 1 : 0);
}
