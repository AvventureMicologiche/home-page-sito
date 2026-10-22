# Run log, studio «apple.com» per la home

Lavoro fatto in cloud il 22/10/2026 (orari UTC), ramo `claude/dazzling-goldberg-dblun0`.

## Tempi per fase
| Fase | Da | A | Durata |
|---|---|---|---|
| Lettura di `index.html` e delle foto | 08:29 | 08:31 | 2 min |
| 1. Guida, token, versione con le foto | 08:31 | 08:39 | 8 min |
| 2. Mockup della home | 08:39 | 08:43 | 4 min |
| 3. `verify.js`, screenshot, correzioni | 08:43 | 08:55 | 12 min |

## Pesi
| File | Peso | Limite |
|---|---|---|
| `brand-guide.html` | 81 KB | 150 KB |
| `brand-guide-hero.html` | 1,58 MB | 4 MB |
| `home/index.html` (solo HTML) | 31 KB | |
| Home all'apertura, 1440 px (HTML, poster, filmato della mappa) | 1,20 MB | 1,5 MB |
| Home all'apertura, 390 px | 1,06 MB | 1,5 MB |

Foto nella guida con le foto (WebP qualità 72, una volta sola per classe):
copertina `fungo_bianco.jpg` 2000 px, 386 KB; le altre 10 tra 26 e 128 KB.
I fotogrammi della mappa (`poster-*.jpg`) e due foto (`porcino_bosco.jpg` 900 px, `tartufo_nero.jpg` 978 px)
sono più piccoli di 1400 px: restano alla loro misura, non si ingrandiscono.

## Verifica
`node studio-apple/verify.js`: 48 controlli su 48 passati, 70 screenshot in `screenshot/`
(uscita completa in `screenshot/verify-output.txt`, dati in `screenshot/report.json`).

## Ipotesi e scelte
- I token sono quelli del brief, copiati tali e quali. Gli unici valori nuovi sono della guida o del mockup, non di apple.com:
  taglia del titolo di copertina, grigio `#a1a1a6` per il testo attenuato su nero (il `#707070` misurato su nero fa 4,24),
  `#6e6e73` nel mockup per il testo attenuato sul grigio chiaro.
- «Quota» dei font: non è stata misurata la quota d'uso; la guida mostra quanti ruoli tipografici usa ogni famiglia (5 e 3 su 8).
- Barra proporzionale dei colori: proporzionale ai ruoli (8 neutri, 3 blu), perché le quote d'area non sono state misurate. È scritto sotto la barra.
- Controllo dei font installati: `document.fonts.check` da solo risponde sì anche quando il font manca, quindi si conferma misurando il testo su canvas.
  Nel cloud il sistema rimappa ogni nome su Inter: il controllo dice «sì (o un suo alias)». Sul PC Windows dirà «no», su Mac «sì».
- Mockup: il colore d'azione è il blu Apple. Verde e oro del sito sono pronti in cima al CSS: col bianco sopra farebbero 2,6 e 2,2 di contrasto,
  quindi nelle righe pronte la scritta sulla pillola piena diventa scura e i contorni su chiaro usano una tinta più scura.
- Menu al telefono: due righe (nome, poi le cinque voci), niente ☰, come chiesto per il sito vero.
- Filmati: c'è anche un tondo pausa/play su ognuno, come quelli misurati: chi lo ferma lo ritrova fermo.
- Voci del menu: «Mappa» e «Funghi» portano alla mappa e alla pagina delle località più bagnate, «Quiz» a `/esame-tartufi/`, «YouTube» e «Chi siamo» alle fasce della pagina.
- Testi del mockup: solo fatti già scritti nell'`index.html` attuale.
- Immagini: solo del repo, con percorsi relativi; gli alt dicono cosa si vede (i nomi dei file sono scambiati).
