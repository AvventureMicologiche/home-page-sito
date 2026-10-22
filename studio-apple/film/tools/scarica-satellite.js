#!/usr/bin/env node
/* Le tessere del satellite (Esri World Imagery) che servono al film, scaricate UNA volta in cache/satellite/.
   Si lancia dal PC (dal cloud Esri e' chiuso), dalla radice del repo:

     node studio-apple/film/tools/scarica-satellite.js --mappa <cartella clone mappa>

   - la lista e' esattamente quella che il film chiede, fotogramma per fotogramma (racconto.js, la stessa aritmetica
     del motore), solo dove c'e' l'Italia (il satellite e' ritagliato sul contorno);
   - prima di partire stampa quante tessere e quanti MB circa, e quante ce ne sono gia';
   - se si interrompe, si rilancia lo stesso comando: riparte da dove era (le tessere finite restano, quelle a meta'
     si riscaricano);
   - le tessere NON vanno mai nel repo: sono di Esri (cache/ e' in .gitignore).
   Opzioni: --bosco lat,lon,zoom (lo stesso del film), --quanti 6 (download insieme), --solo-conta (stampa e basta).
   --mappa serve solo la prima volta, se manca il contorno dell'Italia (lo fa griglie.py). */
'use strict';
const fs = require('fs');
const path = require('path');
const { CACHE, arg, scaricaTutti, preparaGriglia } = require('./comune');
const { satFile, SAT } = require('./motore');
const RC = require('./racconto');

const KB_STIMA = 22;   // peso medio di una tessera Esri sull'Italia (JPEG 256x256), per la stima prima di partire

async function main() {
  preparaGriglia(arg('mappa', null));   // serve il contorno dell'Italia (cache/italia-contorno.json)
  const b = arg('bosco', null);
  const bosco = b && b !== true ? (([lat, lon, zoom]) => ({ centro: [lat, lon], zoom: Number.isFinite(zoom) ? zoom : RC.BOSCO_PREDEFINITO.zoom }))(String(b).split(',').map(Number)) : RC.BOSCO_PREDEFINITO;
  const R = RC.crea({ bosco });
  const inItalia = RC.inItaliaFatto(RC.italiaZ12(JSON.parse(fs.readFileSync(path.join(CACHE, 'italia-contorno.json')))));
  const lista = RC.tessereFilm(R, 'sat', { inItalia });
  const ci = lista.filter(([z, x, y]) => fs.existsSync(satFile(z, x, y)));
  const mancano = lista.filter(([z, x, y]) => !fs.existsSync(satFile(z, x, y)));
  const perLivello = {}; lista.forEach(([z]) => { perLivello[z] = (perLivello[z] || 0) + 1; });
  console.log(`satellite per il film (arrivo ${bosco.centro.join(', ')}, zoom ${bosco.zoom}):`);
  console.log(`  ${lista.length} tessere in tutto, circa ${(lista.length * KB_STIMA / 1024).toFixed(0)} MB`);
  console.log('  per livello: ' + Object.entries(perLivello).map(([z, n]) => `z${z} ${n}`).join(', '));
  console.log(`  gia' in cache/satellite: ${ci.length}; da scaricare: ${mancano.length}, circa ${(mancano.length * KB_STIMA / 1024).toFixed(0)} MB`);
  if (arg('solo-conta', false) || !mancano.length) { if (!mancano.length) console.log('tutto gia\' scaricato.'); return; }
  // il server risponde? (dal cloud no: il proxy chiude Esri)
  try { const r = await fetch(SAT + '10/373/536', { signal: AbortSignal.timeout(20000) }); if (r.status !== 200) throw new Error('HTTP ' + r.status); }
  catch (e) { console.error(`⚠️ server.arcgisonline.com non risponde (${(e.cause && e.cause.message) || e.message}): da questa rete il satellite non si scarica.`); process.exit(1); }
  const t0 = Date.now();
  const { errori, byte } = await scaricaTutti(mancano.map(([z, x, y]) => [SAT + `${z}/${y}/${x}`, satFile(z, x, y)]),
    { quanti: +arg('quanti', 6), etichetta: 'satellite', tentativi: 5, tempo: 40 });
  console.log(`scaricate ${mancano.length - errori.length} tessere, ${(byte / 1048576).toFixed(1)} MB, in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  const vuote = lista.filter(([z, x, y]) => !fs.existsSync(satFile(z, x, y)));
  if (vuote.length) {
    console.error(`⚠️ ne mancano ancora ${vuote.length} (${errori.length} errori, per esempio: ${errori[0] || 'risposta 404'}). Rilancia lo stesso comando: riparte da qui.`);
    process.exit(1);
  }
  console.log('tutte le tessere sono in cache/satellite: ora node studio-apple/film/tools/film.js --satellite ...');
}

main().catch(e => { console.error(e); process.exit(1); });
