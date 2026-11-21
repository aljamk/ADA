"""Build the app's static data files from the ADA Hack 2026 data package.

Data package: https://github.com/vidacex/ARSOhack (Vir: ARSO; OSM: (c) OpenStreetMap contributors, ODbL)

Usage (stdlib only):
    python scripts/build_data.py --paket PATH_TO_ARSOhack --out public/data

Outputs:
    ugani-krogi.json  rounds for the "Ugani zrak" game: real ARSO hourly PM2.5 (MERITEV)
    cetrti.json       exposure index per četrtna skupnost (from primeri/cs_kazalniki.csv)
    ustanove.json     sensitive institutions (kindergartens, schools, care homes) with their četrt
"""

import argparse
import csv
import gzip
import json
import math
import random
from pathlib import Path

# Places in the game and the ARSO station whose measurement they use ("Najbližji senzor")
STATIONS = {"E403": "Bežigrad", "E405": "Celovška", "E404": "Vič"}
PLACES = {"E403": ["Bežigrad", "Center", "Tivoli"], "E405": ["Šiška"], "E404": ["Vič"]}
WINTER = {11, 12, 1, 2}
HOURS = {8, 12, 18, 21, 22}
ROUNDS = 2500  # sample size, keeps the file ~200 kB


def build_rounds(paket: Path):
    rows = []
    with gzip.open(paket / "01_meritve/arso_lj_pm_urno_2016_2026.csv.gz", "rt", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["station_code"] not in STATIONS or not r["pm25"]:
                continue
            t = r["time_local"]  # fixed UTC+1, e.g. 2016-01-01T21:00:00+01:00
            month, hour = int(t[5:7]), int(t[11:13])
            if month in WINTER and hour in HOURS:
                rows.append((r["station_code"], f"{t[:10]} {t[11:16]}", round(float(r["pm25"]))))
    random.seed(2026)
    sample = random.sample(rows, min(ROUNDS, len(rows)))
    out = []
    for code, time, pm25 in sorted(sample, key=lambda x: x[1]):
        for place in PLACES[code]:
            out.append({"place": place, "time": time, "pm25": pm25, "station": STATIONS[code]})
    return out


def build_cetrti(paket: Path):
    with open(paket / "primeri/cs_kazalniki.csv", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    mean = sum(float(r["indeks"]) for r in rows) / len(rows)
    return [
        {
            "ime": r["cs_ime"],
            "indeks": round(float(r["indeks"]), 3),
            "rel": round(float(r["indeks"]) / mean, 2),  # 1.0 = city average
            "vir": r["vir"],
            "vrsta": r["vrsta"],
            "pm25_zima": round(float(r["pm25_zima_2025_26"]), 1),
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
        }
        for r in rows
    ]


def build_ustanove(paket: Path, cetrti):
    """Named kindergartens, schools and care homes in Ljubljana, assigned to the nearest četrt centre."""
    kinds = {"vrtec": "Vrtec", "sola": "Šola", "dom_za_starejse": "Dom starejših"}
    out = []
    with open(paket / "04_prostor/osm_obcutljive_lokacije.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["kategorija"] not in kinds or r["naselje"] != "Ljubljana" or not r["ime"]:
                continue
            lat, lon = float(r["lat"]), float(r["lon"])
            k = math.cos(math.radians(lat))
            cs = min(cetrti, key=lambda c: (c["lat"] - lat) ** 2 + ((c["lon"] - lon) * k) ** 2)
            out.append({"vrsta": kinds[r["kategorija"]], "ime": r["ime"], "cetrt": cs["ime"], "lat": lat, "lon": lon})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paket", required=True, type=Path, help="path to the ARSOhack data package")
    ap.add_argument("--out", default=Path("public/data"), type=Path)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)

    rounds = build_rounds(a.paket)
    cetrti = build_cetrti(a.paket)
    ustanove = build_ustanove(a.paket, cetrti)
    for name, data in [("ugani-krogi.json", rounds), ("cetrti.json", cetrti), ("ustanove.json", ustanove)]:
        (a.out / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{name}: {len(data)} zapisov")


if __name__ == "__main__":
    main()
