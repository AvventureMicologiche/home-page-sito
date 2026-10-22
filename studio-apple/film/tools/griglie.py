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
Le ESCLUSIONI della mappa valgono anche qui (dal 22/10/2026): i pluviometri guasti che la mappa tiene fuori
a mano (LOMB_ESCLUSE, PIEMONTE_ESCLUSE, LIGURIA_ESCLUSE, EMILIA_ESCLUSE, TOSCANA_ESCLUSE, MH_ESCLUSE) si leggono
dal suo index.html e si tolgono; i doppioni del Friuli (MeteoHub entro 1 km da OSMER) pure, vince OSMER.
Prima non si toglievano, e i pluviometri fermi a zero facevano col veto i «puntini neri» nella pioggia del film.
Tre aggiunte, tutte solo per l'immagine:
  - una stazione SORDA NEL PERIODO (totale sotto il 15% della mediana dei cinque vicini, con i vicini ad almeno
    20 mm) non entra: e' la regola del controllo automatico della mappa (check-stazioni-ferme.js, 15% dei cinque
    vicini), con la soglia dei vicini piu' bassa perche' in Sicilia l'autunno e' piovuto 25-40 mm. Sono i
    pluviometri che hanno consegnato zeri mentre intorno pioveva, o che mancano proprio i giorni di pioggia;
  - dove la stazione piu' vicina e' lontana (l'interno dell'Abruzzo, che la mappa copre con
    Open-Meteo dal vivo, irraggiungibile da qui) il valore sfuma verso un'IDW a 0,8 gradi,
    sempre e solo su stazioni vere: niente buchi e niente cuciture nette;
  - la griglia sborda di 0,04 gradi in mare, cosi' il ritaglio sul confine taglia colore pieno
    e la costa resta netta anche da vicino (la mappa sfuma l'ultima mezza cella).

Uso:  python3 griglie.py --mappa /tmp/mappa --da 2026-09-22 --giorni 30 [--passo 0.01]
Serve: numpy, scipy, shapely (pip install numpy scipy shapely).
"""
import argparse, json, os, re, sys, datetime as dt
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
SFUMA_DA = 0.22          # gradi: oltre questa distanza dalla stazione piu' vicina si comincia a sfumare
BORDO = 0.04             # gradi di griglia oltre la costa
VETO_D2 = (6 / 111) ** 2
VETO_MM = 1
COPERTURA_MIN = 0.6


def esclusioni(mappa):
    """Le liste dei pluviometri guasti scritte a mano nell'index.html della mappa: {rete: set di chiavi}."""
    src = open(os.path.join(mappa, 'index.html'), encoding='utf-8').read()
    def blocco(nome):
        i = src.index('var ' + nome + '={') + len('var ' + nome + '=')
        d = 0
        for k in range(i, len(src)):
            d += {'{': 1, '}': -1}.get(src[k], 0)
            if d == 0:
                return re.sub(r'//[^\n]*', '', src[i:k + 1])
    chiavi = lambda b: set(re.findall(r"'([^']+)'\s*:", b))
    out = {'lombardia': chiavi(blocco('LOMB_ESCLUSE')), 'piemonte': chiavi(blocco('PIEMONTE_ESCLUSE')),
           'liguria': chiavi(blocco('LIGURIA_ESCLUSE')), 'emilia': chiavi(blocco('EMILIA_ESCLUSE')),
           'toscana': chiavi(blocco('TOSCANA_ESCLUSE'))}
    for reg, corpo in re.findall(r'([a-z]+)\s*:\s*\{([^}]*)\}', blocco('MH_ESCLUSE')):
        out['meteohub-' + reg] = chiavi(corpo)
    return out


def esclusa(rete, s, escl):
    """Le stesse chiavi della mappa: per NOME il Piemonte, per id o nome la Toscana, per id le altre."""
    e = escl.get(rete)
    if rete == 'lombardia' and not s.get('id'):
        return True   # coordinate corrotte, come nella mappa
    if not e:
        return False
    if rete == 'piemonte':
        return s.get('n') in e
    if rete == 'toscana':
        return (s.get('id') or s.get('n')) in e
    return str(s.get('id')) in e


def stazioni(mappa, giorni, escl):
    """(lat, lon, cumulati[giorni+1], reti) per ogni stazione che passa la copertura e non e' esclusa."""
    lat, lon, cum, reti = [], [], [], []
    tolte = 0
    for rete in RETI:
        mm, cop, meta = {}, {}, {}
        for i, g in enumerate(giorni):
            f = os.path.join(mappa, 'data', rete, g + '.json')
            if not os.path.exists(f):
                continue
            for s in json.load(open(f)).get('stations', []):
                if s.get('lat') is None or s.get('lon') is None:
                    continue
                if esclusa(rete, s, escl):
                    tolte += 1
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
            lat.append(meta[k][0]); lon.append(meta[k][1]); reti.append(rete)
            cum.append(np.concatenate([[0], np.cumsum(mm[k])]))
        print(f'  {rete:20s} {len(tenute):4d} stazioni')
    print('  righe tolte dalle liste della mappa (stazione x giorno):', tolte)
    la, lo, cu, re_ = np.array(lat), np.array(lon), np.array(cum), np.array(reti)
    # doppioni del Friuli: MeteoHub entro 1 km da una stazione OSMER si scarta, vince OSMER (come la mappa)
    os_ = re_ == 'friuli-osmer'
    if os_.any():
        t = cKDTree(np.c_[la[os_], lo[os_] * np.cos(np.radians(46))])
        d, _ = t.query(np.c_[la, lo * np.cos(np.radians(46))])
        via = (re_ == 'meteohub-friuli') & (d < 1 / 111)
        print('  doppioni MeteoHub del Friuli tolti:', int(via.sum()))
        la, lo, cu, re_ = la[~via], lo[~via], cu[~via], re_[~via]
    # sorde nel periodo: sotto il 15% della mediana dei cinque vicini, con i vicini ad almeno 20 mm
    c0 = np.cos(np.radians(42))
    t = cKDTree(np.c_[la, lo * c0])
    _, vv = t.query(np.c_[la, lo * c0], k=6)
    tot = cu[:, -1]
    med = np.median(tot[vv[:, 1:]], axis=1)
    sorde = ((med >= 20) & (tot < 0.15 * med)) | ((med >= 5) & (tot < 1.5) & (tot < 0.2 * med))
    print('  sorde nel periodo, tolte:', int(sorde.sum()))
    for i in np.nonzero(sorde)[0]:
        print(f'    {re_[i]:18s} {la[i]:.4f},{lo[i]:.4f}  {tot[i]:.1f} mm contro {med[i]:.0f} dei vicini')
    return la[~sorde], lo[~sorde], cu[~sorde]   # cum: (n_stazioni, giorni+1)


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
    # ⚠️ SENZA BUCHI: San Marino (e il Vaticano) non sono regioni italiane, e nel contorno erano un buco. Col ritaglio
    # «evenodd» della mappa il buco restava nero in mezzo alla pioggia: era il puntino nero vicino a Rimini.
    # Qui si tengono solo i bordi esterni: la pioggia li' e' l'interpolazione delle stazioni intorno.
    from shapely.geometry import Polygon, MultiPolygon
    parti = italia.geoms if italia.geom_type == 'MultiPolygon' else [italia]
    italia = MultiPolygon([Polygon(p.exterior) for p in parti])
    json.dump({'type': 'Feature', 'properties': {}, 'geometry': mapping(italia)},
              open(os.path.join(CACHE, 'italia-contorno.json'), 'w'), separators=(',', ':'))
    # confini fra regioni (linee), per un filo appena visibile se lo si vuole
    linee = unary_union([shape(f['geometry']).boundary for f in reg['features']]).difference(italia.boundary.buffer(0.002))
    linee = linee.simplify(0.0008)
    json.dump({'type': 'Feature', 'properties': {}, 'geometry': mapping(linee)},
              open(os.path.join(CACHE, 'italia-regioni-linee.json'), 'w'), separators=(',', ':'))

    la, lo, cum = stazioni(a.mappa, giorni, esclusioni(a.mappa))
    print('stazioni in tutto', len(la))

    GR = a.passo
    lat_min, lon_min, lat_max, lon_max = 35.4, 6.5, 47.2, 18.6
    lats = np.round(np.arange(lat_min, lat_max + GR / 2, GR), 6)
    lons = np.round(np.arange(lon_min, lon_max + GR / 2, GR), 6)
    LON, LAT = np.meshgrid(lons, lats)
    dentro = shapely.contains_xy(italia.buffer(BORDO), LON.ravel(), LAT.ravel())
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
            k = np.argmin(d2)
            dmin = np.sqrt(d2[k])
            def idw(m):
                if d2[k] < 1e-6:
                    return cum[v[k]]
                w = 1 / d2[m]
                return (w[:, None] * cum[v[m]]).sum(0) / w.sum()
            m_largo = d2 <= RAD_LARGO * RAD_LARGO
            if dmin <= SFUMA_DA:
                val = idw(d2 <= RAD * RAD)
            else:
                largo += 1
                u = min(1.0, (dmin - SFUMA_DA) / (RAD - SFUMA_DA))
                u = u * u * (3 - 2 * u)
                val = idw(m_largo) if dmin > RAD else (1 - u) * idw(d2 <= RAD * RAD) + u * idw(m_largo)
            if d2[k] <= VETO_D2:
                val = np.where(cum[v[k]] < VETO_MM, 0, val)
            out[:, b + j] = val
        print(f'\r  celle {min(b + BLOCCO, len(plat))}/{len(plat)}', end='', file=sys.stderr)
    print(file=sys.stderr)
    print('celle sfumate verso il raggio largo (stazione piu\' vicina oltre 0,22 gradi):', largo)

    q = np.clip(np.round(out * 10), 0, 65535).astype(np.uint16)   # decimi di mm
    nome = f'pioggia-{giorni[0]}-{a.giorni}g'
    q.tofile(os.path.join(CACHE, nome + '.u16'))
    np.c_[iy, ix].astype(np.uint16).tofile(os.path.join(CACHE, nome + '.idx'))
    meta = {'da': giorni[0], 'a': giorni[-1], 'giorni': giorni, 'passo': GR, 'lat0': lat_min, 'lon0': lon_min,
            'nx': len(lons), 'ny': len(lats), 'celle': int(len(plat)), 'fotogrammi': n_g,
            'stazioni': int(len(la)), 'raggio_largo': int(largo),
            'massimo_finale_mm': float(out[-1].max()), 'mediana_finale_mm': float(np.median(out[-1]))}
    # I PALLINI DEI PLUVIOMETRI, diradati: uno ogni cinque circa, scelti perche' stiano distanti fra loro
    # (a caso, con un seme fisso, si tiene una stazione solo se non ce n'e' gia' una piu' vicina di DIRADA gradi).
    # Ognuno ha il suo ritardo di comparsa (0..1). Accanto, per ogni cella, la distanza dal pallino piu' vicino:
    # serve al film per far «nascere» la pioggia dai pallini.
    rng = np.random.default_rng(22)
    ordine = rng.permutation(len(la))
    DIRADA = 0.145
    presi = []
    alb_p = None
    for i in ordine:
        q = np.array([la[i], lo[i] * c0])
        if presi and min(np.hypot(*(np.array(presi) - q).T)) < DIRADA:
            continue
        presi.append(q)
    presi = np.array(presi)
    pal = [[round(float(y), 4), round(float(x / c0), 4), round(float(r), 3)]
           for (y, x), r in zip(presi, rng.random(len(presi)))]
    json.dump(pal, open(os.path.join(CACHE, nome + '-pallini.json'), 'w'), separators=(',', ':'))
    dpal, _ = cKDTree(presi).query(np.c_[plat, plon * c0])
    np.clip(np.round(dpal / 0.004), 0, 255).astype(np.uint8).tofile(os.path.join(CACHE, nome + '.dist'))
    meta['pallini'] = len(pal)
    print(f'pallini: {len(pal)} su {len(la)} stazioni (uno ogni {len(la) / len(pal):.1f})')
    json.dump(meta, open(os.path.join(CACHE, nome + '.json'), 'w'), indent=1)
    print(json.dumps({k: v for k, v in meta.items() if k != 'giorni'}))


if __name__ == '__main__':
    main()
