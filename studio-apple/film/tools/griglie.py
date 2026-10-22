#!/usr/bin/env python3
"""Griglie della pioggia per il film: la stessa interpolazione della mappa, giorno per giorno.

Legge i file giornalieri delle stazioni dal clone della mappa (sola lettura) e scrive in
studio-apple/film/cache/ una griglia sull'Italia intera con il CUMULATO dopo 0, 1, ... N giorni.
La matematica e' quella di buildGrid() nell'index.html della mappa:
  - IDW con peso 1/d^2, raggio 0,35 gradi (quello dei periodi piu' lunghi di un giorno),
    distanza in gradi con la longitudine moltiplicata per cos(lat);
  - veto locale: se la stazione piu' vicina e' entro 6 km e ha meno di 1 mm, il punto vale 0;
  - una stazione entra nel periodo se ha consegnato almeno il 60% dei giorni della sua rete
    (copFiltro), e il suo totale e' la somma dei giorni che ha.
Unica aggiunta: dove entro 0,35 gradi non c'e' nessuna stazione (l'Abruzzo, che la mappa
copre con Open-Meteo dal vivo, irraggiungibile da qui) si allarga il raggio a 0,8 gradi,
sempre e solo su stazioni vere. Cosi' nessun buco nel fotogramma.

Uso:  python3 griglie.py --mappa /tmp/mappa --da 2026-09-22 --giorni 30 [--passo 0.01]
Serve: numpy, scipy, shapely (pip install numpy scipy shapely).
"""
import argparse, json, os, sys, datetime as dt
import numpy as np
from scipy.spatial import cKDTree
import shapely
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

QUI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(os.path.dirname(QUI), 'cache')

# Le reti italiane a dati di stazione, come le carica la mappa (l'Abruzzo non ha file).
RETI = ['lombardia', 'piemonte', 'veneto', 'liguria', 'emilia', 'toscana', 'trentino', 'altoadige',
        'valledaosta-cf', 'friuli-osmer', 'meteohub-friuli'] + \
       ['meteohub-' + r for r in 'marche umbria lazio molise campania puglia basilicata calabria sicilia sardegna'.split()]
RAD, RAD_LARGO = 0.35, 0.8
VETO_D2 = (6 / 111) ** 2
VETO_MM = 1
COPERTURA_MIN = 0.6


def stazioni(mappa, giorni):
    """(lat, lon, cumulati[giorni+1]) per ogni stazione che passa la copertura."""
    lat, lon, cum = [], [], []
    for rete in RETI:
        mm, cop, meta = {}, {}, {}
        for i, g in enumerate(giorni):
            f = os.path.join(mappa, 'data', rete, g + '.json')
            if not os.path.exists(f):
                continue
            for s in json.load(open(f)).get('stations', []):
                if s.get('lat') is None or s.get('lon') is None:
                    continue
                k = s.get('id') or s.get('n')
                meta.setdefault(k, (s['lat'], s['lon']))
                mm.setdefault(k, np.zeros(len(giorni)))[i] = s.get('mm') or 0
                cop[k] = cop.get(k, 0) + 1
        if not cop:
            print('  rete senza file nel periodo:', rete)
            continue
        massimo = max(cop.values())
        tenute = [k for k in cop if cop[k] >= massimo * COPERTURA_MIN]
        for k in tenute:
            lat.append(meta[k][0]); lon.append(meta[k][1])
            cum.append(np.concatenate([[0], np.cumsum(mm[k])]))
        print(f'  {rete:20s} {len(tenute):4d} stazioni')
    return np.array(lat), np.array(lon), np.array(cum)   # cum: (n_stazioni, giorni+1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mappa', default='/tmp/mappa')
    ap.add_argument('--da', default='2026-09-22')
    ap.add_argument('--giorni', type=int, default=30)
    ap.add_argument('--passo', type=float, default=0.01)
    a = ap.parse_args()
    d0 = dt.date.fromisoformat(a.da)
    giorni = [(d0 + dt.timedelta(i)).isoformat() for i in range(a.giorni)]
    print('periodo', giorni[0], '->', giorni[-1])
    os.makedirs(CACHE, exist_ok=True)

    # contorno dell'Italia: unione delle 20 regioni (serve alla griglia, alla terra e al ritaglio)
    reg = json.load(open(os.path.join(a.mappa, 'italia-regioni-confine.geojson')))
    italia = unary_union([shape(f['geometry']).buffer(0) for f in reg['features']])
    italia = italia.simplify(0.0008, preserve_topology=True)
    json.dump({'type': 'Feature', 'properties': {}, 'geometry': mapping(italia)},
              open(os.path.join(CACHE, 'italia-contorno.json'), 'w'), separators=(',', ':'))
    # confini fra regioni (linee), per un filo appena visibile se lo si vuole
    linee = unary_union([shape(f['geometry']).boundary for f in reg['features']]).difference(italia.boundary.buffer(0.002))
    linee = linee.simplify(0.0008)
    json.dump({'type': 'Feature', 'properties': {}, 'geometry': mapping(linee)},
              open(os.path.join(CACHE, 'italia-regioni-linee.json'), 'w'), separators=(',', ':'))

    la, lo, cum = stazioni(a.mappa, giorni)
    print('stazioni in tutto', len(la))

    GR = a.passo
    lat_min, lon_min, lat_max, lon_max = 35.4, 6.5, 47.2, 18.6
    lats = np.round(np.arange(lat_min, lat_max + GR / 2, GR), 6)
    lons = np.round(np.arange(lon_min, lon_max + GR / 2, GR), 6)
    LON, LAT = np.meshgrid(lons, lats)
    dentro = shapely.contains_xy(italia, LON.ravel(), LAT.ravel())
    iy, ix = np.divmod(np.nonzero(dentro)[0], len(lons))
    plat, plon = lats[iy], lons[ix]
    print('celle in Italia', len(plat))

    # albero sulle coordinate scalate al coseno medio, poi distanze esatte col coseno della cella
    c0 = np.cos(np.radians(42))
    albero = cKDTree(np.c_[la, lo * c0])
    n_st, n_g = cum.shape
    out = np.zeros((n_g, len(plat)), np.float32)
    largo = 0
    BLOCCO = 20000
    for b in range(0, len(plat), BLOCCO):
        pl, po = plat[b:b + BLOCCO], plon[b:b + BLOCCO]
        vicini = albero.query_ball_point(np.c_[pl, po * c0], r=RAD_LARGO * 1.25)
        for j, v in enumerate(vicini):
            if not v:
                continue
            v = np.array(v)
            dlat = pl[j] - la[v]
            dlon = (po[j] - lo[v]) * np.cos(np.radians(pl[j]))
            d2 = dlat * dlat + dlon * dlon
            raggio = RAD
            if not (d2 <= RAD * RAD).any():
                raggio = RAD_LARGO; largo += 1
            m = d2 <= raggio * raggio
            if not m.any():
                continue
            v, d2 = v[m], d2[m]
            k = np.argmin(d2)
            if d2[k] < 1e-6:
                val = cum[v[k]]
            else:
                w = 1 / d2
                val = (w[:, None] * cum[v]).sum(0) / w.sum()
            if d2[k] <= VETO_D2:
                val = np.where(cum[v[k]] < VETO_MM, 0, val)
            out[:, b + j] = val
        print(f'\r  celle {min(b + BLOCCO, len(plat))}/{len(plat)}', end='', file=sys.stderr)
    print(file=sys.stderr)
    print('celle col raggio largo (nessuna stazione entro 0,35 gradi):', largo)

    q = np.clip(np.round(out * 10), 0, 65535).astype(np.uint16)   # decimi di mm
    nome = f'pioggia-{giorni[0]}-{a.giorni}g'
    q.tofile(os.path.join(CACHE, nome + '.u16'))
    np.c_[iy, ix].astype(np.uint16).tofile(os.path.join(CACHE, nome + '.idx'))
    meta = {'da': giorni[0], 'a': giorni[-1], 'giorni': giorni, 'passo': GR, 'lat0': lat_min, 'lon0': lon_min,
            'nx': len(lons), 'ny': len(lats), 'celle': int(len(plat)), 'fotogrammi': n_g,
            'stazioni': int(len(la)), 'raggio_largo': int(largo),
            'massimo_finale_mm': float(out[-1].max()), 'mediana_finale_mm': float(np.median(out[-1]))}
    json.dump(meta, open(os.path.join(CACHE, nome + '.json'), 'w'), indent=1)
    print(json.dumps({k: v for k, v in meta.items() if k != 'giorni'}))


if __name__ == '__main__':
    main()
