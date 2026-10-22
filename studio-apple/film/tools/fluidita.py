#!/usr/bin/env python
"""La fluidita' del film, misurata: differenza media fra fotogrammi consecutivi e velocita' della telecamera.

Per ogni coppia di fotogrammi (ridotti a 480x270, in RGB) la differenza media assoluta, in livelli su 255.
Un film fluido ha una curva liscia: niente picchi isolati (un salto di colore, una tessera che arriva, un
taglio). Il «picco» si misura contro la mediana dei 9 fotogrammi intorno: sopra 1,6 volte, e almeno +0,5
livelli, e' segnato in rosso. Le zone (dissolvenze, zoom) sono ombreggiate e misurate a parte.
Sotto, la velocita' della telecamera (da film.js, cache/camera.csv).

Uso: python fluidita.py --frames studio-apple/film/frames --camera studio-apple/film/cache/camera.csv --out fluidita.png
     [--zone '{"nome":[da,a],...}']
Serve: numpy, pillow, matplotlib.
"""
import argparse, glob, os, csv, json
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ap = argparse.ArgumentParser()
ap.add_argument('--frames', required=True)
ap.add_argument('--camera')
ap.add_argument('--out', required=True)
ap.add_argument('--fps', type=float, default=60)
ap.add_argument('--zone', default='{}')
a = ap.parse_args()
zone = json.loads(a.zone)

files = sorted(glob.glob(os.path.join(a.frames, 'f*.png')))
prev, diff = None, []
for f in files:
    im = np.asarray(Image.open(f).convert('RGB').resize((480, 270), Image.BILINEAR), dtype=np.float32)
    if prev is not None:
        diff.append(np.abs(im - prev).mean())
    prev = im
diff = np.array(diff)
t = np.arange(1, len(diff) + 1) / a.fps
med = np.array([np.median(diff[max(0, i - 4):i + 5]) for i in range(len(diff))])
picchi = np.nonzero((diff > 1.6 * med) & (diff - med > 0.5))[0]
# anche il primo fotogramma contro l'ultimo: il loop
first = np.asarray(Image.open(files[0]).convert('RGB').resize((480, 270), Image.BILINEAR), dtype=np.float32)
loop = np.abs(first - prev).mean()
# il salto piu' grande fra un fotogramma e il successivo, in rapporto ai vicini (1 = liscio)
salto = np.abs(np.diff(diff))

fig, ax = plt.subplots(2, 1, figsize=(12, 6.5), sharex=True, gridspec_kw={'height_ratios': [3, 2]})
colori = ['#f2c14e', '#7bc950', '#5bc0eb', '#c3a6ff', '#ff8c69', '#9aa0a6']
for k, (nome, (z0, z1)) in enumerate(zone.items()):
    for x in ax:
        x.axvspan(z0, z1, color=colori[k % len(colori)], alpha=0.18, lw=0)
    ax[0].text((z0 + z1) / 2, 0.98, nome, transform=ax[0].get_xaxis_transform(), ha='center', va='top', fontsize=7.5)
ax[0].plot(t, diff, color='#2a6fdb', lw=1.2, label='differenza media fra fotogrammi consecutivi')
ax[0].plot(t, med, color='#999999', lw=0.8, ls='--', label='mediana mobile (9 fotogrammi)')
if len(picchi):
    ax[0].scatter(t[picchi], diff[picchi], color='#d62728', zorder=3, s=18, label=f'picchi ({len(picchi)})')
ax[0].set_ylabel('livelli su 255')
ax[0].set_title(f'Fluidità del film: {len(files)} fotogrammi, massimo {diff.max():.2f}, '
                f'picchi {len(picchi)}, ultimo contro primo {loop:.2f}')
ax[0].legend(loc='upper left', fontsize=8)
ax[0].grid(alpha=0.25)
if a.camera and os.path.exists(a.camera):
    rows = list(csv.DictReader(open(a.camera, encoding='utf-8')))
    tc = np.array([float(r['t']) for r in rows])
    ax[1].plot(tc, [float(r['pan_px']) for r in rows], color='#2ca02c', lw=1.2, label='spostamento del centro (px a fotogramma)')
    ax[1].plot(tc, [float(r['zoom_px']) for r in rows], color='#9467bd', lw=1.2, label='zoom (px a fotogramma, all\'angolo)')
    ax[1].legend(loc='upper left', fontsize=8)
ax[1].set_xlabel('secondi')
ax[1].set_ylabel('px a fotogramma')
ax[1].grid(alpha=0.25)
fig.tight_layout()
fig.savefig(a.out, dpi=110)
np.savetxt(os.path.splitext(a.out)[0] + '.csv', np.c_[t, diff, med], delimiter=',', header='t,diff,mediana', fmt='%.4f', comments='')
print(f'fluidita: max {diff.max():.2f} a {t[diff.argmax()]:.2f}s, media {diff.mean():.2f}, picchi {len(picchi)}'
      + (f' a {", ".join(f"{t[i]:.2f}s" for i in picchi[:12])}' if len(picchi) else '') + f', loop {loop:.2f}')
for nome, (z0, z1) in zone.items():
    m = (t >= z0) & (t <= z1 + 1 / a.fps)
    if m.any():
        j = np.nonzero(m)[0]
        s = salto[j[:-1]] if len(j) > 1 else np.array([0])
        print(f'  {nome:18s} {z0:5.1f}-{z1:5.1f}s  max {diff[m].max():.2f}  media {diff[m].mean():.2f}  '
              f'salto massimo fra due differenze consecutive {s.max():.2f}  picchi {int(np.isin(picchi, j).sum())}')
