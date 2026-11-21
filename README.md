# Zrak, ki ga dihamo — ADA Hack 2026

Prototip aplikacije za izziv Abelium × ARSO. Brez prijave: odpreš in vidiš zrak.
Ciljna skupina: občutljivi (nosečnice, astmatiki, starejši, otroci) in vsi, ki se želijo naučiti predvideti slab zrak.

## Zagon

```bash
npm install
npm run dev          # odpre na http://localhost:5173
```

Za pitch: `http://localhost:5173/?demo=1` doda gumb, ki jutrišnjo napoved razreši takoj z zadnjo meritvijo.

## Kaj je notri

| Zavihek | Kaj pokaže | Podatki |
|---|---|---|
| 💨 Zdaj | Meritev zdaj + nasvet za tvoj profil, hitra napoved za jutri, pametno opozorilo, naslednjih 12 ur z najboljšim časom za zračenje, zadnjih 24 ur | MERITEV ARSO, MODEL CAMS |
| 🎯 Igra | "Napovej jutri" (PM2.5 jutri ob 8h), točke, niz 🔥, Premagaj model, deljenje rezultata, liga četrti | MERITEV ARSO razreši napoved |
| 🕓 Moj dan | 24-urni krog za dom (zunanji) in službo (notranji) | MODEL CAMS, umerjen |
| 📊 Postaje | Postaje razvrščene po trenutnem PM2.5 | MERITEV ARSO |
| 🙂 Jaz | Profil v enem dotiku, obvestila, predogled widgetov | — |

## Viri podatkov

- **ARSO XML** (`ones_zrak_urni_podatki_zadnji.xml`): zadnja ura vseh postaj, odprt CORS. Aplikacija ga bere vsakih 15 min in meritve shrani na napravi (7 dni) za zgodovino in razreševanje igre.
- **CAMS prek Open-Meteo**: urni model PM2.5. CAMS pozimi v Ljubljani precenjuje (+70 %), zato ga umerimo z razmerjem meritev/model ob zadnji izmerjeni uri na isti postaji (omejeno na 0,3–2). Vedno označeno kot MODEL.
- Stopnje: EEA European Air Quality Index za PM2.5 (TODO: potrdi z ARSO).

## Poštena raba podatkov

- Meritev in model sta povsod ločeno označena.
- Liga četrti razvršča po točnosti napovedi, ne po kakovosti zraka (tri uradne postaje so v isti celici modela).
- Lestvica postaj razvršča merilna mesta, ne ulic.
- Krog "Moj dan" je zunanji zrak na najbližji postaji, ne zrak v prostoru.

## Struktura

```
src/
  arso.ts, forecast.ts      viri podatkov (ARSO, CAMS + umerjanje)
  game.ts, profile.ts       logika igre in profilov
  storage.ts, time.ts       pomožne funkcije
  components/               ena komponenta na funkcijo
  App.tsx                   stanje in zavihki
```

## Omejitve prototipa

- Vse je v `localStorage` na napravi. Liga uporablja DEMO točke drugih četrti.
- Napoved se razreši le, če je bila aplikacija odprta v uri po objavi meritve (~9:45–10:45). Rešitev: strežnik ali 5-dnevni zajem iz paketa (`v_zivo/README.md`).
- Obvestila delujejo samo, ko je aplikacija odprta (ni push strežnika).
- Widgeti so predogled; pravi potrebujejo nativno kodo.

## Naslednji koraki

- Strežnik za ligo (anonimni ID naprave + četrt) in push obvestila
- Pravi widgeti: iOS WidgetKit (home, lock screen, Apple Watch) in Android App Widgets
- Vadnica v slogu GeoGuessr na 10 letih meritev ARSO iz paketa
- Občanski senzorji (Sensor.Community, umerjeni) za gostejšo lestvico
- Družinska povezava: pošlji opozorilo babici po SMS / Viber
- Višina mejne plasti (Open-Meteo) za razlago "zakaj" (inverzija)
