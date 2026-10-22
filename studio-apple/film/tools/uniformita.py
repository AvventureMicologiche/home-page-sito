#!/usr/bin/env python
"""La pioggia compare UNIFORME? Si misura, regione per regione, nei fotogrammi della comparsa.

Per ogni pixel di terra, l'opacita' della pioggia in quel fotogramma si stima confrontandolo con un fotogramma
prima della comparsa (base) e uno con la pioggia piena (pieno):  a = (f - base)·(pieno - base) / |pieno - base|^2.
La pioggia e' una tela sopra la terra con un'opacita': il fotogramma e' lineare in quell'opacita', quindi la stima
e' esatta dove pieno e base sono abbastanza diversi (sopra 12 livelli). Per regione si prende la mediana (i pallini
che sfumano nel frattempo sono pochi pixel e non la spostano). Se la pioggia sale insieme ovunque, le curve delle
20 regioni sono una sola.

Uso: python uniformita.py --frames frames --regioni cache/regioni.png --nomi cache/regioni.json
                          --base 144 --pieno 366 --lista 144,156,... --fps 60 --out uniformita.png
"""
import argparse, json, os
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ap = argparse.ArgumentParser()
ap.add_argument('--frames', required=True)
ap.add_argument('--regioni', required=True)
ap.add_argument('--nomi', required=True)
ap.add_argument('--base', type=int, required=True)
ap.add_argument('--pieno', type=int, required=True)
ap.add_argument('--lista', required=True)
ap.add_argument('--fps', type=float, default=60)
ap.add_argument('--out', required=True)
a = ap.parse_args()

leggi = lambda i: np.asarray(Image.open(os.path.join(a.frames, f'f{i:05d}.png')).convert('RGB'), dtype=np.float32)
nomi = json.load(open(a.nomi, encoding='utf-8'))
rg = np.asarray(Image.open(a.regioni).convert('RGBA'))
idr = np.where(rg[..., 3] == 255, rg[..., 0].astype(int), 0)        # solo i pixel pieni (il bordo antialias no)
base, pieno = leggi(a.base), leggi(a.pieno)
d = pieno - base
d2 = (d * d).sum(-1)
ok = d2 > 12 ** 2
lista = [int(x) for x in a.lista.split(',')]
tempi = np.array(lista) / a.fps
curve = {}
for k, nome in enumerate(nomi, start=1):
    m = (idr == k) & ok
    if m.sum() < 200:
        continue
    curve[nome] = []
for i in lista:
    f = leggi(i)
    alfa = ((f - base) * d).sum(-1) / np.maximum(d2, 1)
    for k, nome in enumerate(nomi, start=1):
        if nome in curve:
            curve[nome].append(float(np.median(alfa[(idr == k) & ok])))
M = np.array(list(curve.values()))                    # regioni x fotogrammi
spread = M.max(0) - M.min(0)
fig, ax = plt.subplots(figsize=(10, 5))
for nome, c in curve.items():
    ax.plot(tempi, c, lw=1, alpha=0.8, label=nome)
ax.set_xlabel('secondi')
ax.set_ylabel('opacità della pioggia (mediana della regione, 1 = piena)')
ax.set_title(f'Comparsa della pioggia, {len(curve)} regioni: scarto massimo fra regioni {spread.max():.3f}')
ax.grid(alpha=0.25)
ax.legend(fontsize=6.5, ncol=4, loc='upper left')
fig.tight_layout()
fig.savefig(a.out, dpi=110)
righe = ['t,' + ','.join(curve)] + [f'{t:.3f},' + ','.join(f'{M[r, j]:.4f}' for r in range(len(curve))) for j, t in enumerate(tempi)]
open(os.path.splitext(a.out)[0] + '.csv', 'w', encoding='utf-8').write('\n'.join(righe))
print(f'uniformita: {len(curve)} regioni, scarto massimo fra regioni {spread.max():.3f} (a {tempi[spread.argmax()]:.2f} s)')
for j in range(0, len(lista), max(1, len(lista) // 6)):
    print(f'  t={tempi[j]:.2f}s  media {M[:, j].mean():.3f}  min {M[:, j].min():.3f}  max {M[:, j].max():.3f}')
