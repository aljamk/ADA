"""Citizen sensors of the Ljubljana basin from the ADA Hack 2026 data package -> public/data/senzorji.json

Data package: https://github.com/vidacex/ARSOhack, folder 01_meritve:
    sensor_community_lj_naprave.geojson   the 10 Sensor.Community devices found in the basin (one is indoor)
    purpleair_lj_naprave.geojson          the 3 PurpleAir devices (no live feed without an API key)
    senzorji_umerjanje_koeficienti.csv    calibration of every device against its nearest ARSO station

Usage (stdlib only):
    python scripts/build_senzorji.py --paket PATH_TO_ARSOhack/01_meritve --out public/data/senzorji.json

The app applies the linear calibration (method b, season "vse": ARSO = a * sensor + b) to the live value of a
device, as the package recommends; devices the package marks unreliable (r < 0.6 or fewer than 500 hours)
keep their raw value and are labelled "neumerjen".
"""

import argparse
import csv
import json
from pathlib import Path

# Neighbourhood of each Sensor.Community device (from the package README table "Naprave" and the coordinates).
# Deliberately without the names of the ARSO stations, so a sensor is never mistaken for the station it is calibrated to.
PLACE = {
    9821: "Rožna dolina",
    14576: "Šiška zahod",
    21901: "Polje",
    44606: "Šiška vzhod",
    56181: "Tabor",
    64688: "Spodnja Šiška",
    67867: "Dravlje",
    74650: "Fužine",
    75285: "Žale",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paket", required=True, help="01_meritve folder of the ARSOhack package")
    ap.add_argument("--out", default="public/data/senzorji.json")
    a = ap.parse_args()
    paket = Path(a.paket)

    cal = {}
    with open(paket / "senzorji_umerjanje_koeficienti.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["pollutant"] == "pm25" and r["season"] == "vse" and r["method"] == "b_linearna":
                n, rr = int(r["n"]), float(r["r"])
                cal[(r["source"], int(r["sensor_id"]))] = {
                    "ref": r["ref_station"],
                    "km": float(r["distance_km"]),
                    "a": float(r["a"]),
                    "b": float(r["b"]),
                    "r": rr,
                    "n": n,
                    "zanesljiv": rr >= 0.6 and n >= 500,
                }

    out = []
    sc = json.load(open(paket / "sensor_community_lj_naprave.geojson", encoding="utf-8"))
    for ft in sc["features"]:
        p = ft["properties"]
        if p.get("indoor"):
            continue
        sid = int(p["sensor_id"])
        out.append({
            "vir": "SC",
            "id": sid,
            "ime": PLACE.get(sid, "Ljubljana"),
            "lat": p["lat"],
            "lon": p["lon"],
            "vlaga": p.get("humidity_sensor_id"),
            "zadnji_dan": p.get("zadnji_dan"),
            **cal.get(("sensor_community", sid), {}),
        })
    pa = json.load(open(paket / "purpleair_lj_naprave.geojson", encoding="utf-8"))
    for ft in pa["features"]:
        p = ft["properties"]
        sid = int(p["sensor_index"])
        lon, lat = ft["geometry"]["coordinates"]
        out.append({
            "vir": "PA",
            "id": sid,
            "ime": p["name"],
            "lat": lat,
            "lon": lon,
            "zadnji_dan": (p.get("last_seen") or "")[:10],
            **cal.get(("purpleair", sid), {}),
        })

    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{a.out}: {len(out)} naprav ({sum(1 for d in out if d['vir'] == 'SC')} Sensor.Community, {sum(1 for d in out if d['vir'] == 'PA')} PurpleAir)")


if __name__ == "__main__":
    main()
