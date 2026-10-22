#!/usr/bin/env node
/* Le immagini ad altissima definizione della home v2: la mappa vera senza interfaccia, 2880x1800
   (1440x900 a scala 2), esportate in WebP qualita' 82 a 2880 e 1440 px.

   Dalla radice del repo (il server della mappa e la griglia li prepara il motore, come per il film):
     node studio-apple/film/tools/foto.js --mappa <cartella clone mappa>                          tutte
     node studio-apple/film/tools/foto.js pioggia-nord boschi-nord --mappa <cartella>              solo quelle
     node studio-apple/film/tools/foto.js satellite previsioni --satellite --previsioni --mappa <cartella>   DAL PC:
                                                     foto aerea vera e previsioni di oggi (dal cloud sono segnaposto)
   Come film.js accetta --chrome e --ffmpeg.
   Escono in studio-apple/film/foto/<nome>-2880.webp e <nome>-1440.webp, piu' il PNG grande in cache/foto/. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { apri, scena, capoluoghi, previsioni, satelliteRaggiungibile, FILM, CACHE } = require('./motore');
const { serverMappa, preparaGriglia, ffmpeg } = require('./comune');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
let URLMAPPA = null;
const OUT = path.join(FILM, 'foto');
const PNG = path.join(CACHE, 'foto');
const W = 1440, H = 900;
const LIMITI = { 2880: 600 * 1024, 1440: 250 * 1024 };
const GRIGLIA = 'pioggia-2026-09-22-30g';

// il Nord Italia: la STESSA inquadratura per la pioggia e per i boschi (scorrendo si vede la stessa terra due volte)
const NORD = { centro: [45.56, 10.5], zoom: 7.9 };
const SCENE = {
  // (1) la pioggia vera di 30 giorni sul Nord, coi pallini dei pluviometri (diradati) sopra
  'pioggia-nord': { s: { ...NORD, giorno: null, linee: 0.12, pallini: 2, raggioPallino: 2.2 } },
  // (2) i boschi sul Nord, sopra il rilievo
  'boschi-nord': { s: { ...NORD, pioggia: 0, rilievo: 1, boschi: 1, soglia: null, terra: '#3c3c3f', linee: 0.08 } },
  // (3) i boschi sopra la foto aerea, vicino fino alle chiome: faggete e castagneti sopra Santo Stefano d'Aveto
  'satellite': { sat: true, s: { centro: [44.5395, 9.4566], zoom: 14.4, pioggia: 0, sat: 1, boschi: 0.62, soglia: null, terra: '#3c3c3f' } },
  // (4) le previsioni dei capoluoghi della Liguria, come le mostra la mappa (domani)
  'previsioni': { prev: 'liguria', s: { centro: [44.17, 8.83], zoom: 9.2, prevZoomRif: 9.2, pioggia: 0, rilievo: 0.75, terra: '#2e2e31', prev: 2, prevGiorno: 1 } },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(PNG, { recursive: true });
  preparaGriglia(arg('mappa', null));
  const srv = await serverMappa(arg('mappa', null)); URLMAPPA = srv.url;
  const solo = process.argv.slice(2).filter(a => !a.startsWith('--') && (SCENE[a] || a === 'scheda-stazione'));
  const nomi = solo.length ? solo : [...Object.keys(SCENE), 'scheda-stazione'];
  const vuoleSat = !!arg('satellite', false), vuolePrev = !!arg('previsioni', false);
  const sat = vuoleSat && await satelliteRaggiungibile();
  if (vuoleSat && !sat) console.log('⚠️ satellite chiesto ma server.arcgisonline.com non risponde: resta il segnaposto');
  for (const nome of nomi) {
    const png = path.join(PNG, nome + '.png');
    if (nome === 'scheda-stazione') await schedaStazione(png);
    else {
      const sc = SCENE[nome];
      let datiPrev = null;
      if (sc.prev) { datiPrev = await previsioni(sc.prev, vuolePrev); if (!datiPrev) console.log('⚠️ previsioni: la produzione non risponde, resta il segnaposto'); }
      const { browser, page, errori } = await apri({ url: URLMAPPA, larghezza: W, altezza: H, scala: 2, griglia: GRIGLIA, satellite: sc.sat && sat ? 'rete' : false, prev: sc.prev || null });
      if (sc.prev) await capoluoghi(page, sc.prev);
      const nota = sc.sat && !sat ? 'segnaposto: il satellite si rifà dal PC (foto.js satellite --satellite)'
        : sc.prev && !datiPrev ? 'segnaposto: le previsioni si rifanno dal PC (foto.js previsioni --previsioni)' : null;
      await scena(page, { ...sc.s, nota });
      await page.screenshot({ path: png });
      if (errori.length) console.log(nome, 'errori della pagina:', errori);
      await browser.close();
    }
    esporta(nome, png);
  }
  srv.chiudi();
}

/* (4) la scheda di una stazione col suo grafico: qui l'interfaccia c'e', ma solo la scheda, grande e pulita.
   Si apre la mappa con un link vero (Liguria, gli stessi 30 giorni del film) e si tocca il pluviometro col
   cumulato piu' alto, con un clic vero del mouse: la scheda e il grafico li disegna la mappa. */
async function schedaStazione(png) {
  const STAZ = [44.4623, 8.5809];   // Piampaludo (882 m), 332 mm nei 30 giorni: uno dei pluviometri piu' bagnati della Liguria
  // scala 4 e la scheda ingrandita 2,4 volte: esce larga circa 2.840 pixel veri, nitida anche a 2880
  const { browser, page } = await apri({ url: URLMAPPA + '?r=liguria&da=2026-09-22&a=2026-10-21', larghezza: W, altezza: H, scala: 4, griglia: null, nonPulire: true });
  const pallini = () => page.evaluate(() => { let n = 0; window._mapDebug.eachLayer(l => { if (l instanceof L.CircleMarker) n++; }); return n; });
  for (let i = 0; i < 120 && await pallini() < 50; i++) await page.waitForTimeout(500);
  await page.waitForTimeout(2000);
  await page.evaluate(c => window._mapDebug.setView(c, 11, { animate: false }), STAZ);
  await page.waitForTimeout(800);
  const p = await page.evaluate(c => {
    const m = window._mapDebug; let best = null, dmin = 1e9;
    m.eachLayer(l => { if (l instanceof L.CircleMarker) { const d = l.getLatLng().distanceTo(c); if (d < dmin) { dmin = d; best = l; } } });
    const pt = m.latLngToContainerPoint(best.getLatLng()), box = m.getContainer().getBoundingClientRect();
    return { x: box.left + pt.x, y: box.top + pt.y, dmin };
  }, STAZ);
  console.log('pallino a', Math.round(p.dmin), 'm dal punto cercato');
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => { const b = document.getElementById('sh-body'); return b && b.offsetHeight > 40 && !b.querySelector('.sh-load'); }, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  // solo la scheda, grande: la mappa dietro sparisce (si vedeva negli angoli arrotondati)
  await page.addStyleTag({ content: `.leaflet-pane,.leaflet-control-container{visibility:hidden!important}
    #map,.leaflet-container,body{background:#000!important}
    #st-history{zoom:2.4;left:8px!important;top:8px!important;right:auto!important;bottom:auto!important;max-height:none!important;box-shadow:none!important}` });
  await page.setViewportSize({ width: 1440, height: 1900 });
  await page.waitForTimeout(800);
  await (await page.$('#st-history')).screenshot({ path: png });
  await browser.close();
}

function esporta(nome, png) {
  const ff = ffmpeg();
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
