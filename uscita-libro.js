/* L'anteprima dell'uscita su Amazon, nella home (26/11/2026, scheda «Promo libro»; scelta da lui: variante 3 con la nebbia).
   Si mostra UNA volta per visita (sessionStorage «uscitaLibro»), non se si arriva col link #libro; ?anteprima=1 la forza (per le prove).
   Conteggi GA4: libro_anteprima (mostrata), libro_amazon_anteprima (clic verso Amazon), libro_anteprima_chiusa.
   Bozza e prove in promo-libro\ (uscita-amazon.js, serve-uscita.js). Testo sotto (originale):
   All'ingresso: il libro gira, si mette di fronte e si polverizza; poi il testo del retro e «ora su Amazon».
   Tre varianti con ?v=1|2|3 (solo nel mockup):
     1 = la polvere vola via, poi le righe compaiono una alla volta;
     2 = la polvere si ricompone nelle parole «Una valle,», poi il resto;
     3 = il libro si sbriciola e sotto c'e' gia' il testo, tutto insieme.
   Clic sul titolo o sul bottone = Amazon in una scheda nuova. × , «Entra nel sito» o Esc = chiude.
   Nel sito vero si mostrerebbe una volta per visita (sessionStorage); con «riduci animazioni» parte gia' dalla fine. */
(function () {
  var AMAZON = 'https://www.amazon.it/dp/B0HSZ41P8S';
  var V = 3;
  var forza = /[?&]anteprima=1/.test(location.search);
  if (!forza) { if (location.hash === '#libro') return; try { if (sessionStorage.getItem('uscitaLibro')) return; sessionStorage.setItem('uscitaLibro', '1'); } catch (e) {} }
  function conta(n) { try { if (typeof gtag === 'function') gtag('event', n); } catch (e) {} }
  var fermo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COP = 'immagini/libro/copertina-800.webp', DORSO = 'immagini/libro/dorso.webp';

  var f = document.createElement('link'); f.rel = 'stylesheet';
  f.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=EB+Garamond:ital,wght@1,500&display=swap';
  document.head.appendChild(f);

  var css = document.createElement('style');
  css.textContent =
    '#usc{position:fixed;inset:0;z-index:99999;background:#050505;color:#f5f5f7;display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:"SF Pro Text",-apple-system,"Segoe UI",Arial,sans-serif;transition:opacity .6s}' +
    '#usc.via{opacity:0;pointer-events:none}' +
    '#usc .alone{position:absolute;inset:0;background:radial-gradient(closest-side at 50% 46%,rgba(236,185,26,.30),rgba(236,185,26,.08) 55%,rgba(0,0,0,0));transition:opacity 1.2s}' +
    '#usc .chiudi{position:absolute;top:14px;right:16px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.10);color:#fff;font-size:26px;line-height:44px;cursor:pointer;z-index:5}' +
    '#usc .scena{position:relative;width:min(760px,92vw);min-height:min(640px,86vh);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 0}' +
    '#usc .lb{position:absolute;left:50%;top:50%;width:min(270px,48vw);aspect-ratio:5/8;transform:translate(-50%,-50%);perspective:1400px}' +
    '#usc .l3{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateY(50deg) rotateX(3deg);transition:transform 1.6s cubic-bezier(.4,0,.2,1)}' +
    '#usc .lf,#usc .ld,#usc .lr{position:absolute;top:0;height:100%}' +
    '#usc .lf{left:0;width:100%;transform:translateZ(13px);border-radius:1px 4px 4px 1px;overflow:hidden;box-shadow:inset 0 -1px 0 rgba(255,236,170,.4)}' +
    '#usc .lf img{width:100%;height:100%;display:block}' +
    '#usc .ld{left:0;width:26px;transform:translateX(-50%) rotateY(-90deg);background:url(' + DORSO + ') center/100% 100%}' +
    '#usc .ld::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.25))}' +
    '#usc .lr{left:0;width:100%;transform:translateZ(-13px);background:#b98f12;box-shadow:24px 34px 60px rgba(0,0,0,.7)}' +
    '@keyframes uscGira{0%,100%{transform:rotateY(50deg) rotateX(3deg)}50%{transform:rotateY(22deg) rotateX(1deg)}}' +
    '#usc .l3.gira{animation:uscGira 3.2s ease-in-out infinite}' +
    '#usc canvas{position:absolute;inset:0;pointer-events:none;z-index:3}' +
    '#usc .testo{position:relative;z-index:2;text-align:center;font-family:"EB Garamond",Georgia,serif;font-style:italic;font-weight:500;padding:0 10px}' +
    '#usc .r{display:block;font-size:clamp(21px,3.3vw,31px);line-height:1.38;color:#e9e6dc;opacity:0;transform:translateY(10px);transition:opacity 1s,transform 1s}' +
    '#usc .r.su{opacity:1;transform:none}' +
    '#usc .r0{font-size:clamp(46px,8vw,78px);line-height:1;margin-bottom:14px;color:#fff}' +
    '#usc .r1,#usc .r2,#usc .r4,#usc .r5{max-width:640px;margin-left:auto;margin-right:auto}' +
    '#usc .r3{font-size:clamp(30px,4.6vw,44px);color:#fff;margin:10px 0 16px}' +
    '#usc .r4{font-style:normal;font-size:clamp(18px,2.6vw,24px);margin-top:24px}' +
    '#usc .r5{font-style:normal;font-size:clamp(18px,2.6vw,24px)}' +
    '#usc .fine{position:relative;margin-top:30px;z-index:4;text-align:center;opacity:0;transform:translateY(14px);transition:opacity 1s,transform 1s}' +
    '#usc .fine.su{opacity:1;transform:none}' +
    '#usc br.tel{display:none}#usc .r5{text-wrap:balance}' +
    '#usc .tit{display:block;font-family:"Bebas Neue",Impact,sans-serif;font-size:clamp(44px,7.4vw,74px);line-height:1;letter-spacing:.01em;color:#ecb91a;text-decoration:none;' +
      'text-shadow:0 1px 0 #b8890c,0 2px 0 #a67b09,0 3px 0 #946d07,0 4px 0 #7a5905,0 8px 16px rgba(0,0,0,.6)}' +
    '#usc .ora{display:block;margin-top:6px;font-size:clamp(15px,2vw,18px);letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:#f5f5f7}' +
    '#usc .bot{display:inline-flex;align-items:center;gap:10px;margin-top:22px;min-height:50px;padding:12px 30px;border-radius:980px;background:#ecb91a;color:#111;font-weight:800;font-size:18px;text-decoration:none;box-shadow:0 10px 28px rgba(236,185,26,.25)}' +
    '#usc .bot:hover{background:#f6c938}' +
    '#usc .entra{display:block;margin:16px auto 0;background:none;border:0;color:#aaa;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}' +
    '@media (max-width:600px){#usc br.tel{display:inline}#usc .scena{min-height:88vh}#usc .r{font-size:18px}#usc .r0{font-size:40px}#usc .r3{font-size:28px}#usc .r4,#usc .r5{font-size:17px}#usc .r4{margin-top:18px}#usc .tit{font-size:40px}#usc .bot{font-size:17px;padding:12px 24px}}' +
    '@media (max-height:700px){#usc .r{font-size:16px}#usc .r0{font-size:34px}#usc .r3{font-size:24px;margin:6px 0 10px}#usc .r4,#usc .r5{font-size:15px}#usc .tit{font-size:34px}#usc .fine{margin-top:18px}#usc .bot{margin-top:14px;min-height:44px}#usc .entra{margin-top:10px}}';
  document.head.appendChild(css);

  var o = document.createElement('div'); o.id = 'usc';
  o.innerHTML =
    '<div class="alone"></div><button class="chiudi" aria-label="Chiudi">×</button>' +
  '<div class="lb"><div class="l3"><div class="lr"></div><div class="ld"></div><div class="lf"><img src="' + COP + '" alt=""></div></div></div>' +
    '<canvas></canvas>' +
    '<div class="scena">' +
      '<div class="testo">' +
        '<span class="r r0">Novembre 2002.</span>' +
        '<span class="r r1">La cena sociale del Gruppo Micologico.</span>' +
        '<span class="r r2">Vent’anni di amicizia, segreti da nascondere e un buon motivo per uccidere.</span>' +
        '<span class="r r4">Il primo caso del conte<br class="tel"> Edoardo Doglio di Valdilupo,<br>cercatore pigro e gourmet testardo.</span>' +
        '<span class="r r5">Al suo fianco, un lagotto romagnolo con un ottimo naso e molte opinioni.</span>' +
      '</div>' +
      '<div class="fine">' +
        '<a class="tit" href="' + AMAZON + '" target="_blank" rel="noopener">«A funghi con delitto»</a>' +
        '<span class="ora">ora su Amazon</span>' +
        '<a class="bot" href="' + AMAZON + '" target="_blank" rel="noopener">Compralo su Amazon <span aria-hidden="true">›</span></a>' +
        '<button class="entra">Entra nel sito</button>' +
      '</div>' +
    '</div>';

  function $(s) { return o.querySelector(s); }
  function righe() { return o.querySelectorAll('.r'); }
  var vecchioOverflow;
  function chiudi() { conta('libro_anteprima_chiusa'); o.classList.add('via'); document.documentElement.style.overflow = vecchioOverflow || ''; setTimeout(function () { o.remove(); }, 650); document.removeEventListener('keydown', esc); }
  function esc(e) { if (e.key === 'Escape') chiudi(); }

  function parti() {
    document.body.appendChild(o);
    vecchioOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    $('.chiudi').onclick = chiudi; $('.entra').onclick = chiudi; conta('libro_anteprima');
    [$('.tit'), $('.bot')].forEach(function (a) { a.addEventListener('click', function () { conta('libro_amazon_anteprima'); }); }); document.addEventListener('keydown', esc);
    // (il testo resta nel flusso: il titolo arriva sotto, senza sovrapporsi)
    if (fermo) { righe().forEach(function (r) { r.classList.add('su'); }); $('.lb').style.display = 'none'; $('.fine').classList.add('su'); return; }
    if (V === 3) preparaTesto();
    // il libro parte inclinato, si raddrizza una volta sola e poi esplode; si parte solo a copertina caricata
    var l3 = $('.l3'), img = $('.lf img'); l3.style.transition = 'none'; l3.style.transform = 'rotateY(52deg) rotateX(3deg)';
    $('.lb').style.opacity = 0;
    function via() {
      $('.lb').style.transition = 'opacity .4s'; $('.lb').style.opacity = 1; void l3.offsetWidth;
      l3.style.transition = 'transform 1.7s cubic-bezier(.4,0,.2,1)';
      setTimeout(function () { l3.style.transform = 'rotateY(0deg) rotateX(0deg)'; }, 900);
      setTimeout(polvere, 3000);
    }
    if (img.complete && img.naturalWidth) via(); else { img.onload = via; img.onerror = chiudi; }
  }

  /* variante 3: il testo arriva tutto insieme, in tre modi (?t=1 zoom, ?t=2 nebbia, ?t=3 tendina) */
  var TT = 2, SU = 0;
  function preparaTesto() {
    var te = $('.testo');
    righe().forEach(function (r) { r.style.transition = 'none'; r.classList.add('su'); });
    if (TT === 1) { te.style.opacity = 0; te.style.transform = 'translateY(-' + SU + 'px) scale(.45)'; te.style.filter = 'blur(6px)'; }
    if (TT === 2) { te.style.opacity = 0; te.style.filter = 'blur(18px)'; te.style.transform = 'scale(1.06)'; }
    if (TT === 3) { te.style.webkitMaskImage = te.style.maskImage = 'linear-gradient(to bottom,#000 0%,transparent 0%)'; }
  }
  function scopriTesto() {
    var te = $('.testo');
    if (TT === 1) { te.style.transition = 'opacity 1.4s, transform 1.9s cubic-bezier(.16,1,.3,1), filter 1.4s'; te.style.opacity = 1; te.style.transform = 'translateY(-' + SU + 'px) scale(1)'; te.style.filter = 'none'; }
    if (TT === 2) { te.style.transition = 'opacity 2s, filter 2.2s ease-out, transform 2.4s cubic-bezier(.16,1,.3,1)'; te.style.opacity = 1; te.style.filter = 'blur(0)'; te.style.transform = 'scale(1)'; }
    if (TT === 3) {                                   // la tendina scende insieme al libro che si sbriciola
      var t0 = performance.now();
      (function g(ora) { var a = Math.min(1, (ora - t0) / 1700), e = 1 - Math.pow(1 - a, 2), p = e * 115;
        te.style.webkitMaskImage = te.style.maskImage = 'linear-gradient(to bottom,#000 ' + (p - 15) + '%,transparent ' + p + '%)';
        if (a < 1) requestAnimationFrame(g); else te.style.webkitMaskImage = te.style.maskImage = 'none'; })(t0);
    }
  }

  /* ---------- la polvere ---------- */
  function polvere() {
    var cv = $('canvas'), sc = o.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = sc.width * dpr; cv.height = sc.height * dpr; cv.style.width = sc.width + 'px'; cv.style.height = sc.height + 'px';
    var x = cv.getContext('2d'); x.scale(dpr, dpr);
    // misure del libro DRITTO (il contenitore non ruota): se il raddrizzamento e' in ritardo la copertina non si deforma
    var l3f = $('.l3'); l3f.style.transition = 'none'; l3f.style.transform = 'rotateY(0deg) rotateX(0deg)';
    var img = $('.lf img'), rb = $('.lb').getBoundingClientRect();
    var bx = rb.left - sc.left, by = rb.top - sc.top, bw = rb.width, bh = rb.height;
    var t = document.createElement('canvas'), tw = Math.round(bw), th = Math.round(bh); t.width = tw; t.height = th;
    var tx = t.getContext('2d'); tx.drawImage(img, 0, 0, tw, th);
    var d = tx.getImageData(0, 0, tw, th).data, PASSO = 2, P = [];
    var cx = bx + bw / 2, cy = by + bh / 2, seme = 7;
    function rnd() { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; }
    for (var yy = 0; yy < th; yy += PASSO) for (var xx = 0; xx < tw; xx += PASSO) {
      var i = (yy * tw + xx) * 4, X = bx + xx, Y = by + yy, dx = X - cx, dy = Y - cy, r = Math.sqrt(dx * dx + dy * dy) || 1;
      var v = 60 + rnd() * 260;
      P.push({ x: X, y: Y, c: [d[i], d[i + 1], d[i + 2]], vx: dx / r * v * .7 + (rnd() - .5) * 440, vy: dy / r * v * .3 + (rnd() - .5) * 150 - 15,
        rit: (V === 3 ? (Y - by) / bh * .5 : r / Math.max(bw, bh) * .45) + rnd() * .15, vita: .7 + rnd() * .6 });
    }
    // variante 2: i punti delle parole «Una valle,» dove la polvere va a posarsi
    var T = [];
    if (V === 2) {
      var r0 = $('.r0').getBoundingClientRect(), cs = getComputedStyle($('.r0'));
      var m = document.createElement('canvas'); m.width = Math.ceil(sc.width); m.height = Math.ceil(sc.height);
      var mx = m.getContext('2d'); mx.fillStyle = '#fff'; mx.textAlign = 'center'; mx.textBaseline = 'middle';
      mx.font = 'italic 500 ' + cs.fontSize + ' "EB Garamond", Georgia, serif';
      mx.fillText($('.r0').textContent,r0.left - sc.left + r0.width / 2, r0.top - sc.top + r0.height / 2);
      var md = mx.getImageData(0, 0, m.width, m.height).data, SP = innerWidth < 600 ? 2 : 3;
      for (var y2 = 0; y2 < m.height; y2 += SP) for (var x2 = 0; x2 < m.width; x2 += SP) if (md[(y2 * m.width + x2) * 4 + 3] > 128) T.push([x2, y2]);
      for (var k = T.length - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)), s = T[k]; T[k] = T[j]; T[j] = s; }
      for (var n = 0; n < P.length; n++) if (n < T.length) P[n].bersaglio = T[n];
    }
    $('.lb').style.visibility = 'hidden';
    var t0 = performance.now(), DUR = V === 2 ? 2.8 : 2.2;
    if (V === 3) setTimeout(scopriTesto, TT === 3 ? 100 : 350);
    (function giro(ora) {
      var tt = (ora - t0) / 1000; x.clearRect(0, 0, sc.width, sc.height);
      for (var n = 0; n < P.length; n++) {
        var p = P[n], u = tt - p.rit;
        if (u <= 0) { x.fillStyle = 'rgb(' + p.c + ')'; x.fillRect(p.x, p.y, PASSO, PASSO); continue; }
        if (p.bersaglio) {                                         // variante 2: vola e poi si posa sulla lettera
          var a = Math.min(1, u / 1.9), e = a < .5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2;
          var sp = (1 - Math.exp(-1.6 * u)) / 1.6, lx = p.x + p.vx * sp, ly = p.y + p.vy * sp;
          var px = lx + (p.bersaglio[0] - lx) * e, py = ly + (p.bersaglio[1] - ly) * e;
          var mix = e, cc = [Math.round(p.c[0] + (255 - p.c[0]) * mix), Math.round(p.c[1] + (255 - p.c[1]) * mix), Math.round(p.c[2] + (255 - p.c[2]) * mix)];
          x.fillStyle = 'rgb(' + cc + ')'; var s2 = PASSO - (PASSO - 2) * e; x.fillRect(px, py, s2, s2); continue;
        }
        var f2 = u / p.vita; if (f2 >= 1) continue;
        var sp2 = (1 - Math.exp(-1.4 * u)) / 1.4, qx = p.x + p.vx * sp2, qy = p.y + p.vy * sp2 + 70 * u * u, s3 = PASSO * (1 - .4 * f2);
        x.fillStyle = 'rgba(' + p.c + ',' + (1 - f2 * f2) + ')'; x.fillRect(qx, qy, s3, s3);
      }
      if (tt < DUR) requestAnimationFrame(giro); else dopo(cv);
    })(t0);
  }

  function dopo(cv) {
    var R = righe(), passo = V === 3 ? 0 : 650, da = 0;
    if (V === 2) { R[0].style.transition = 'none'; R[0].classList.add('su'); cv.style.transition = 'opacity .5s'; cv.style.opacity = 0; da = 1; }
    else cv.style.opacity = 0;
    if (V !== 3) for (var i = da; i < R.length; i++) (function (r, k) { setTimeout(function () { r.classList.add('su'); }, k * passo + (k >= 4 ? 500 : 0)); })(R[i], i - da);
    var att = V === 3 ? 900 : (R.length - da) * passo + 1300;
    setTimeout(function () { $('.fine').classList.add('su'); }, att);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', parti); else parti();
})();
