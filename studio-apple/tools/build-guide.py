#!/usr/bin/env python3
"""Costruisce le due guide a partire da brand-guide.html.

1. Copia tokens.json dentro brand-guide.html (blocco <script id="src-json">), cosi' pannelli,
   copia e scarico restano uguali al file.
2. Scrive brand-guide-hero.html: stessa pagina, ma ogni classe .img-* riceve una foto del repo
   in WebP (2000 px la copertina, 1400 le altre, mai ingrandite), incorporata UNA volta sola
   e riusata dalle classi. Le etichette diventano «Immagine da avventuremicologiche.it» e
   l'aria-label diventa la descrizione di cosa si VEDE (data-alt).

Uso, dalla radice del repo:  python3 studio-apple/tools/build-guide.py
Serve Pillow con WebP.
"""
import base64, io, json, os, re, sys
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
STUDIO = os.path.dirname(QUI)
REPO = os.path.dirname(STUDIO)
GUIDA = os.path.join(STUDIO, 'brand-guide.html')
HERO = os.path.join(STUDIO, 'brand-guide-hero.html')

# classe -> (file in immagini/, larghezza massima). I nomi dei file sono scambiati:
# il commento dice cosa si vede davvero.
FOTO = {
    'img-cover': ('fungo_bianco.jpg', 2000),      # cestino di ovoli e porcini
    'img-a': ('archie_tartufo.jpg', 1400),        # Archie e un tartufo nero in mano
    'img-b': ('porcino_bosco.jpg', 1400),         # spugnole nel sottobosco
    'img-c': ('porcini.jpg', 1400),               # ovoli in mano
    'img-d': ('poster-piogge.jpg', 1400),         # mappa delle piogge (768 px, resta 768)
    'img-e': ('poster-scheda.jpg', 1400),         # scheda di un pluviometro
    'img-f': ('Clipboard03.jpg', 1400),           # tartufi bianchi in mano
    'img-g': ('spugnole.jpg', 1400),              # Archie tra le foglie
    'img-h': ('poster-radar.jpg', 1400),          # diretta radar
    'img-i': ('tartufo_nero.jpg', 1400),          # due porcini tra le foglie
    'img-j': ('poster-boschi-satellite.jpg', 1400),  # boschi sul satellite
}
QUALITA = 72
ETICHETTA_GUIDA = 'Spazio immagine: sfumatura coi colori misurati'
ETICHETTA_HERO = 'Immagine da avventuremicologiche.it'


def webp(nome, larg):
    im = Image.open(os.path.join(REPO, 'immagini', nome)).convert('RGB')
    if im.width > larg:
        im = im.resize((larg, round(im.height * larg / im.width)), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=QUALITA, method=6)
    return b.getvalue(), im.size


def main():
    html = open(GUIDA, encoding='utf-8').read()

    # 1. tokens.json dentro la guida
    tok = open(os.path.join(STUDIO, 'tokens.json'), encoding='utf-8').read().strip()
    json.loads(tok)  # se non e' valido si ferma qui
    html, n = re.subn(r'(<script type="application/json" id="src-json">)(.*?)(</script>)',
                      lambda m: m.group(1) + tok + m.group(3), html, flags=re.S)
    assert n == 1, 'blocco src-json non trovato'
    open(GUIDA, 'w', encoding='utf-8').write(html)

    # 2. versione con le foto
    regole, rapporto = [], []
    for cls, (nome, larg) in FOTO.items():
        dati, size = webp(nome, larg)
        regole.append('.%s{background-image:url(data:image/webp;base64,%s)}' % (cls, base64.b64encode(dati).decode()))
        rapporto.append('  %-10s %-28s %4dx%-4d %6.1f KB' % (cls, nome, size[0], size[1], len(dati) / 1024))
    hero = html.replace('/*HERO-IMAGES*/', '/* foto di avventuremicologiche.it, una volta sola per classe */\n' + '\n'.join(regole), 1)
    hero = hero.replace(ETICHETTA_GUIDA, ETICHETTA_HERO)
    hero = re.sub(r'aria-label="[^"]*" data-alt="([^"]*)"', r'aria-label="\1" data-alt="\1"', hero)
    hero = hero.replace('ogni spazio immagine e\' una sfumatura CSS coi colori misurati.',
                        'questa e\' la versione con le foto del sito incorporate in WebP.')
    open(HERO, 'w', encoding='utf-8').write(hero)

    print('\n'.join(rapporto))
    for f in (GUIDA, HERO):
        print('%-24s %8.1f KB' % (os.path.basename(f), os.path.getsize(f) / 1024))


if __name__ == '__main__':
    sys.exit(main())
