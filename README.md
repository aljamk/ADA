# Zrak, ki ga dihamo — ADA Hack 2026

Prototip aplikacije za izziv Abelium × ARSO. Brez prijave: odpreš in vidiš zrak.

## Zagon

```bash
npm install
npm run dev
```

## Kaj je zdaj notri

- Zadnja urna meritev PM2.5 / PM10 iz ARSO XML feeda (vse postaje v Sloveniji), označena kot MERITEV
- Izbira postaje (shrani se na napravi)
- Igra "Napovej jutri": napoveš PM2.5 jutri ob 8h (dober / zmeren / slab), razreši se z meritvijo ARSO, +100 točk
- Vse shranjeno v `localStorage`, brez računa

## Naslednji koraki

- Napoved naslednjih 12 ur (Open-Meteo CAMS, označeno kot MODEL, umerjeno na meritev)
- Zgodovina zadnjih ur, pametna opozorila, profil (nosečnica / astma / 65+)
- Liga četrtnih skupnosti, "Premagaj model", deljenje rezultata
- Krog 24 ur za dom in službo
- Widget (home + lock screen), Apple Watch
