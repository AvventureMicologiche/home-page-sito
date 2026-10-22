# Studio «apple.com» per la home: stato

Cartella di lavoro: `studio-apple/` sul ramo `claude/dazzling-goldberg-dblun0`.
Niente di questa cartella è pubblicato e `index.html`, `esame-tartufi/` e `main` non sono toccati.

## Fatto
- **Fase 1, guida**
  - `tokens.css`, `tokens.json` (formato W3C design tokens, OKLCH accanto all'hex).
  - `brand-guide.html`: pagina sola, nessuna richiesta esterna, spazi immagine = sfumature coi colori misurati.
  - `brand-guide-hero.html`: stessa pagina con le foto del sito in WebP (generata, non si modifica a mano).
  - `tools/build-guide.py`: copia `tokens.json` dentro la guida e rigenera la versione con le foto.

- **Fase 2, mockup home** `home/index.html`: menu 44 px sfocato, Mappa delle piogge con filmato,
  4 riquadri (radar, boschi e satellite, previsioni, stazione), numeri, YouTube nero, quiz, chi siamo, piede.
  Colore d'azione in `--color-action` (blu Apple); verde e oro del sito pronti, commentati, in cima al CSS.

## Da fare
- Fase 3: `verify.js` e screenshot in `screenshot/`.
- `run-log.md`, PR in bozza.

## Come provarlo
Dalla radice del repo:
```
python -m http.server 8000
```
poi apri `http://localhost:8000/studio-apple/home/` (mockup) e `http://localhost:8000/studio-apple/brand-guide.html` (o `brand-guide-hero.html`).
Il mockup va aperto col server: i link al quiz partono da `/esame-tartufi/`.
La guida si apre anche con doppio clic, senza server.

Se cambi `brand-guide.html` o `tokens.json`: `python3 studio-apple/tools/build-guide.py` (serve Pillow).
