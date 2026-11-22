"""Where do the particles come from: the GRAL (ARSO) contributions of small heating and of passenger-car traffic
to PM10, per četrtna skupnost and hour of day in winter -> public/data/viri.json.

Source (data package 02_modeli/gral): gral_kurisca_cs_urno.csv and gral_promet_cs_urno.csv, hourly means per ČS
for the year 2021 (UTC). The traffic field's scale is 5-20x too high (README), so both fields are scaled with the
regression against the Bežigrad 2021 measurements from the README: PM10 = 11.2 + 0.45 * kurišča + 0.17 * promet.
What remains is the LOCAL contribution of each source; the regional background is not included.

Usage: python scripts/build_viri.py --paket PATH/02_modeli/gral --out public/data/viri.json
"""
import argparse
import csv
import json
from pathlib import Path

WINTER = {1, 2, 3, 10, 11, 12}
B_KURISCA, C_PROMET = 0.45, 0.17  # Bežigrad (E403) regression, gral/README.md
PREFIX = 'ČETRTNA SKUPNOST '


def hourly_means(path: Path):
    """{ime ČS: [24 means by local hour]} over the winter months"""
    sums: dict[str, list[float]] = {}
    counts: dict[str, list[int]] = {}
    with open(path, encoding='utf-8') as f:
        rows = csv.DictReader(l for l in f if not l.startswith('#'))
        for r in rows:
            if int(r['mesec']) not in WINTER:
                continue
            h = (int(r['ura']) + 1) % 24  # UTC -> CET
            for col, v in r.items():
                if not (col.startswith(PREFIX) or col == 'MOL') or v in ('', 'nan'):
                    continue
                name = col[len(PREFIX):].capitalize() if col.startswith(PREFIX) else 'MOL'
                sums.setdefault(name, [0.0] * 24)[h] += float(v)
                counts.setdefault(name, [0] * 24)[h] += 1
    return {n: [round(sums[n][h] / counts[n][h], 2) if counts[n][h] else None for h in range(24)] for n in sums}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--paket', required=True, help='02_modeli/gral folder of the ARSOhack package')
    ap.add_argument('--out', default='public/data/viri.json')
    a = ap.parse_args()
    paket = Path(a.paket)
    kur = hourly_means(paket / 'gral_kurisca_cs_urno.csv')
    pro = hourly_means(paket / 'gral_promet_cs_urno.csv')
    out = {
        'opis': 'Lokalni prispevek k PM10 po uri dneva (pozimi: jan–mar, okt–dec 2021), µg/m³, model GRAL (ARSO), umerjen na Bežigrad 2021',
        'b_kurisca': B_KURISCA,
        'c_promet': C_PROMET,
        'cetrti': {
            n: {
                'kurisca': [round(v * B_KURISCA, 2) if v is not None else None for v in kur[n]],
                'promet': [round(v * C_PROMET, 2) if v is not None else None for v in pro.get(n, [None] * 24)],
            }
            for n in kur
        },
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    mol = out['cetrti']['MOL']
    print(f"{a.out}: {len(out['cetrti'])} območij; MOL ob 20h kurišča {mol['kurisca'][20]} / promet {mol['promet'][20]}, ob 8h {mol['kurisca'][8]} / {mol['promet'][8]}")


if __name__ == '__main__':
    main()
