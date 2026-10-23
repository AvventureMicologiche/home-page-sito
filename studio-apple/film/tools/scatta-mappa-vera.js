const puppeteer = require('D:/video youtube/claudio/grafiche-social/node_modules/puppeteer-core');
(async () => {
  const [url, out] = [process.argv[2], process.argv[3]];
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setRequestInterception(true);
  p.on('request', async r => {
    if (/google-analytics|googletagmanager|clarity\.ms|doubleclick/.test(r.url())) return r.abort();
    // le previsioni: in locale la mappa le chiede a 127.0.0.1:8788 (wrangler), qui si girano al sito vero (solo lettura)
    if (/\/api\/previsioni/.test(r.url())) {
      const u = new URL(r.url()), vero = 'https://precipitazioni.avventuremicologiche.it' + u.pathname + u.search;
      try { const res = await fetch(vero); return r.respond({ status: res.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: await res.text() }); }
      catch (e) { return r.abort(); }
    }
    // solo nello scatto: il tetto delle 3 regioni si alza a 9 (come QUATTRO=1 in scatta-link-hd.js)
    if (r.resourceType() === 'document' && /127\.0\.0\.1:8899\/\?/.test(r.url())) {
      let html = await (await fetch(r.url())).text();
      html = html.split(".slice(0,3)").join(".slice(0,9)").split(":checked').length>3){").join(":checked').length>9){");
      return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    r.continue();
  });
  // TELEFONO=1: la mappa com'e' sul telefono (390x720 a 3x, tocco, user agent da telefono), per le foto verticali
  if (process.env.TELEFONO) {
    await p.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36');
    await p.setViewport({ width: +(process.env.LARGO || 390), height: +(process.env.ALTO || 720), deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  } else await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  // solo nello scatto: con 9 regioni le etichette sotto «Indietro» non ci stanno su una riga, si va a capo
  // e la vetrina del video («Nuovo video», in alto a destra) nelle foto della home non c'entra
  await p.addStyleTag({ content: '#channel-logo.vetrina,#channel-pill,.vetrina{display:none!important}' });
  await p.addStyleTag({ content: '#rg-scelte{justify-content:center!important}#rg-scelte .rg-chip{flex:0 1 auto!important;width:auto!important;font-size:11.5px!important;padding-left:5px!important;padding-right:5px!important;gap:3px!important;white-space:nowrap!important}' });
  await new Promise(r => setTimeout(r, +(process.env.ATTESA || 8000)));
  // in quest'ordine: intensita' dei boschi (il cursore sta nel pannello), «riduci» (che ricentra la mappa), poi la vista
  // INTENSITA=70: sposta il cursore «Intensità boschi» come farebbe chi guarda (col satellite parte dal 30%)
  if (process.env.INTENSITA) {
    const fatto = await p.evaluate(v => { const r = [...document.querySelectorAll('input[type=range]')].find(i => /ntensit/i.test((i.closest('div') || {}).textContent || ''));
      if (!r) return false; r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); return true; }, process.env.INTENSITA);
    console.log('cursore intensita:', fatto);
    await new Promise(r => setTimeout(r, 4000));
  }
  // RIDUCI=1: preme «riduci» sul pannello in basso (al telefono copre meta' mappa)
  if (process.env.RIDUCI) {
    const fatto = await p.evaluate(() => { const b = [...document.querySelectorAll('button, a, div, span')].find(e => e.children.length === 0 && /^\s*riduci/i.test(e.textContent) && e.getBoundingClientRect().width > 0);
      if (!b) return false; b.click(); return true; });
    console.log('riduci:', fatto);
    await new Promise(r => setTimeout(r, 3000));
  }
  // VISTA=lat,lon,zoom: sposta la mappa prima dello scatto
  if (process.env.VISTA) { const [la, lo, z] = process.env.VISTA.split(',').map(Number);
    await p.evaluate((la, lo, z) => window._mapDebug.setView([la, lo], z, { animate: false }), la, lo, z);
    await new Promise(r => setTimeout(r, +(process.env.ATTESA2 || 15000))); }
  await p.screenshot({ path: out, type: 'png' });
  await b.close();
})();
