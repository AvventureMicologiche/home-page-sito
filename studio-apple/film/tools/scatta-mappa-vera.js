const puppeteer = require('D:/video youtube/claudio/grafiche-social/node_modules/puppeteer-core');
(async () => {
  const [url, out] = [process.argv[2], process.argv[3]];
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setRequestInterception(true);
  p.on('request', async r => {
    if (/google-analytics|googletagmanager|clarity\.ms|doubleclick/.test(r.url())) return r.abort();
    // solo nello scatto: il tetto delle 3 regioni si alza a 9 (come QUATTRO=1 in scatta-link-hd.js)
    if (r.resourceType() === 'document' && /127\.0\.0\.1:8899\/\?/.test(r.url())) {
      let html = await (await fetch(r.url())).text();
      html = html.split(".slice(0,3)").join(".slice(0,9)").split(":checked').length>3){").join(":checked').length>9){");
      return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    r.continue();
  });
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  // solo nello scatto: con 9 regioni le etichette sotto «Indietro» non ci stanno su una riga, si va a capo
  await p.addStyleTag({ content: '#rg-scelte{justify-content:center!important}#rg-scelte .rg-chip{flex:0 1 auto!important;width:auto!important;font-size:11.5px!important;padding-left:5px!important;padding-right:5px!important;gap:3px!important;white-space:nowrap!important}' });
  await new Promise(r => setTimeout(r, 8000));
  await p.screenshot({ path: out, type: 'png' });
  await b.close();
})();
