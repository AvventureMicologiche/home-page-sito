# Studio «apple.com» per la home: stato

Cartella di lavoro: `studio-apple/` sul ramo `claude/dazzling-goldberg-dblun0`.
Niente di questa cartella è pubblicato e `index.html`, `esame-tartufi/` e `main` non sono toccati.

## Fatto
- **Fase 1, guida**
  - `tokens.css`, `tokens.json` (formato W3C design tokens, OKLCH accanto all'hex).
  - `brand-guide.html`: pagina sola, nessuna richiesta esterna, spazi immagine = sfumature coi colori misurati (81 KB).
  - `brand-guide-hero.html`: stessa pagina con le foto del sito in WebP (1,6 MB; generata, non si modifica a mano).
  - `tools/build-guide.py`: copia `tokens.json` dentro la guida e rigenera la versione con le foto.
- **Fase 2, mockup home** `home/index.html`: menu 44 px sfocato, Mappa delle piogge con filmato,
  4 riquadri (radar, boschi e satellite, previsioni, stazione), numeri, YouTube nero, quiz, chi siamo, piede.
  Colore d'azione in `--color-action` (blu Apple); verde e oro del sito pronti, commentati, in cima al CSS.
- **Fase 3, verifica** `verify.js`: 48/48 controlli passati nel cloud, screenshot di ogni sezione a 1440 e 390 in `screenshot/`.
- `run-log.md` con tempi, pesi e ipotesi.

## Da fare (per lui)
- Guardare il mockup e decidere il colore d'azione (blu, verde o oro: un blocco di righe in cima al CSS).
- Decidere i testi definitivi (titoli e righe sono proposte, i fatti vengono tutti dall'`index.html` attuale).
- Se piace: portare il mockup in `index.html` vero (rimettere il tag di Google Analytics e gli eventi del quiz,
  percorsi `immagini/` e `video/` senza `../../`). Non fatto qui, per regola.
- Rilanciare `verify.js` sul PC per vedere la guida coi font veri di sistema.

## Come provarlo
Dalla radice del repo:
```
python -m http.server 8000
```
poi apri `http://localhost:8000/studio-apple/home/` (mockup) e `http://localhost:8000/studio-apple/brand-guide.html` (o `brand-guide-hero.html`).
Il mockup va aperto col server: i link al quiz partono da `/esame-tartufi/`.
La guida si apre anche con doppio clic, senza server.

Verifica: `node studio-apple/verify.js` (serve Playwright: `npm i -D playwright` e `npx playwright install chromium`).
Se cambi `brand-guide.html` o `tokens.json`: `python3 studio-apple/tools/build-guide.py` (serve Pillow).
