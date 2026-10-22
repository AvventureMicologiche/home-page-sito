#!/usr/bin/env node
/* Le immagini ad altissima definizione della home v2: la mappa vera senza interfaccia, 2880x1800
   (1440x900 a scala 2), esportate in WebP qualita' 82 a 2880 e 1440 px.

   Prima, come per il film: il server della mappa su 8899 e le griglie
     python3 studio-apple/film/tools/griglie.py --da 2026-09-22 --giorni 30
     python3 studio-apple/film/tools/griglie.py --da 2026-10-02 --giorni 8
   Poi, dalla radice del repo:
     node studio-apple/film/tools/foto.js                 tutte
     node studio-apple/film/tools/foto.js pioggia-italia  solo quella
     node studio-apple/film/tools/foto.js --satellite     boschi sulla foto aerea (solo dal PC: nel cloud Esri e' chiuso)
   Escono in studio-apple/film/foto/<nome>-2880.webp e <nome>-1440.webp, piu' il PNG grande in cache/foto/. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { apri, scena, FILM, CACHE } = require('./motore');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const URLMAPPA = arg('mappa', 'http://127.0.0.1:8899/');
const SAT = !!arg('satellite', false);
const OUT = path.join(FILM, 'foto');
const PNG = path.join(CACHE, 'foto');
const W = 1440, H = 900;
const LIMITI = { 2880: 600 * 1024, 1440: 250 * 1024 };

const SCENE = {
  // (1) la pioggia vera di 30 giorni su tutta Italia
  'pioggia-italia': { griglia: 'pioggia-2026-09-22-30g',
    s: { centro: [41.85, 12.5], zoom: 6.02, giorno: 30, linee: 0.10 } },
  // (2) i boschi da vicino: l'Appennino ligure, sopra il rilievo (dal PC: sopra il satellite)
  'boschi-vicino': { griglia: 'pioggia-2026-09-22-30g',
    s: { centro: [44.55, 9.47], zoom: 12.3, giorno: 30, pioggia: 0, rilievo: 1, boschi: 1, soglia: null, terra: '#3c3c3f' } },
  // (3) la finestra «piogge per funghi», 13-20 giorni prima del 22/10: 2-9 ottobre, la Toscana intera
  'finestra-funghi': { griglia: 'pioggia-2026-10-02-8g',
    s: { centro: [43.42, 11.1], zoom: 8.05, giorno: 8, linee: 0.12 } },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(PNG, { recursive: true });
  const solo = process.argv.slice(2).filter(a => !a.startsWith('--') && SCENE[a] || a === 'scheda-stazione');
  const nomi = solo.length ? solo : [...Object.keys(SCENE), 'scheda-stazione'];
  for (const nome of nomi) {
    const png = path.join(PNG, nome + '.png');
    if (nome === 'scheda-stazione') await schedaStazione(png);
    else {
      const sc = SCENE[nome];
      const { browser, page, errori } = await apri({ url: URLMAPPA, larghezza: W, altezza: H, scala: 2, griglia: sc.griglia, satellite: SAT && nome === 'boschi-vicino' });
      await scena(page, sc.s);
      await page.screenshot({ path: png });
      if (errori.length) console.log(nome, 'errori della pagina:', errori);
      await browser.close();
    }
    esporta(nome, png);
  }
}

/* (4) la scheda di una stazione col suo grafico: qui l'interfaccia c'e', ma solo la scheda, grande e pulita.
   Si apre la mappa con un link vero (Liguria, gli stessi 30 giorni del film) e si tocca il pluviometro col
   cumulato piu' alto, con un clic vero del mouse: la scheda e il grafico li disegna la mappa. */
async function schedaStazione(png) {
  const { chromium } = require('playwright') || {};
  const { browser, page } = await apri({ url: URLMAPPA + '?r=liguria&da=2026-09-22&a=2026-10-21', larghezza: W, altezza: H, scala: 2, griglia: null, nonPulire: true });
  await page.waitForFunction(() => {
    let n = 0; window._mapDebug.eachLayer(l => { if (l instanceof L.CircleMarker) n++; }); return n > 20;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const p = await page.evaluate(() => {
    const m = window._mapDebug; let best = null;
    m.eachLayer(l => { if (l instanceof L.CircleMarker && l._st == null) { const s = l.options && l.options.stazione; } });
    // la stazione col numero piu' alto nella sua etichetta: si cerca fra i pallini quella col cumulato maggiore
    const cand = [];
    m.eachLayer(l => { if (l instanceof L.CircleMarker && m.getBounds().contains(l.getLatLng())) cand.push(l); });
    cand.sort((a, b) => (b.options.radius || 0) - (a.options.radius || 0));
    best = cand[0];
    const pt = m.latLngToContainerPoint(best.getLatLng()), box = m.getContainer().getBoundingClientRect();
    return { x: box.left + pt.x, y: box.top + pt.y, n: cand.length };
  });
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => { const b = document.getElementById('sh-body'); return b && b.querySelector('svg,canvas') && !b.querySelector('.sh-load'); }, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: '#st-history{box-shadow:none!important}' });
  await (await page.$('#st-history')).screenshot({ path: png });
  await browser.close();
}

function esporta(nome, png) {
  const ff = 'ffmpeg';
  for (const larg of [2880, 1440]) {
    const out = path.join(OUT, `${nome}-${larg}.webp`);
    let q = 82;
    for (;;) {
      execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', png, '-vf', `scale=${larg}:-2:flags=lanczos`,
        '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', out]);
      const kb = fs.statSync(out).size;
      if (kb <= LIMITI[larg] || q <= 50) { console.log(`${nome}-${larg}.webp  ${(kb / 1024).toFixed(0)} KB  qualita' ${q}`); break; }
      q -= 4;   // sopra il limite: si scende di qualita' finche' ci sta, e lo si dice
    }
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
