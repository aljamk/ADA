# Kaj dihaš? — ADA Hack 2026

Prototip aplikacije za izziv Abelium × ARSO. Brez prijave: odpreš in vidiš zrak.
Ciljna skupina: občutljivi (nosečnice, astmatiki, starejši, otroci) in vsi, ki se želijo naučiti predvideti slab zrak.
UI sledi Figmi "Svež zrak · Redesign" (svetli in temni način po nastavitvi telefona).

## Zagon

```bash
npm install
npm run dev
```

Neposredne povezave (za pitch): `#zdaj`, `#zemljevid`, `#igra`, `#ugani` (takoj v krog igre), `#opozorila`, `#odlocevalci`. `?intro=0` preskoči uvodni zaslon.

## Zasloni

| Zaslon | Kaj pokaže | Podatki |
|---|---|---|
| 01 Dobrodošli | Komu prilagodimo nasvete (neobvezno, ostane na napravi) | — |
| 02 Zdaj | AQI in PM2,5 zdaj, nasvet za profil, naslednjih 12 ur z oknom za zračenje in večernim vrhom, zakaj | MERITEV ARSO, MODEL CAMS |
| 03 Zemljevid | Tri uradne postaje v Ljubljani, preklop meritev/model, drsnik +12 h | MERITEV ARSO, MODEL CAMS |
| 04–07 Igra "Ugani zrak" | Dnevni izziv 5 krogov: kraj + čas, oceni PM2,5, razkritje, točke, niz, liga četrti, prijatelji, značke, deljenje | MERITEV ARSO 2020–2026 iz paketa |
| 08 Za odločevalce | Priporočilo za obvestilo javnosti jutri, indeks izpostavljenosti po 17 četrtih, občutljive ustanove | MODEL CAMS, OCENA (zvezek 04), OSM |
| 09 Opozorila | Obvestilo za zračenje, opozorilo večer prej, mirne ure | iz napovedi |

## Viri podatkov

- **ARSO XML** (`ones_zrak_urni_podatki_zadnji.xml`): zadnja ura vseh postaj, odprt CORS, osvežitev vsakih 15 min.
- **Občanski senzorji** samo po paketu ARSOhack (`01_meritve`): seznam naprav Sensor.Community in PurpleAir ter koeficienti umerjanja (`senzorji_umerjanje_koeficienti.csv`) → `public/data/senzorji.json` s skripto `scripts/build_senzorji.py`. Sprotna vrednost iz živega API-ja Sensor.Community, ki ga navaja paket (bbox kotline), umerjena linearno (metoda b, sezona `vse`) na najbližjo postajo ARSO; nezanesljive naprave ostanejo neumerjene. PurpleAir brez ključa nima sprotnih podatkov, zato ga aplikacija ne prikazuje (naprave ostanejo v `senzorji.json`). Oznaka OCENA.
- **CAMS prek Open-Meteo**: urni model PM2,5. CAMS pozimi v Ljubljani precenjuje (+70 %), zato ga umerimo z razmerjem meritev/model ob zadnji izmerjeni uri na isti postaji (omejeno na 0,3–2). Vedno označeno kot MODEL.
- **Podatkovni paket** [vidacex/ARSOhack](https://github.com/vidacex/ARSOhack) → `public/data/` s skripto:
  ```bash
  python scripts/build_data.py --paket POT/DO/ARSOhack --out public/data
  ```
  - `ugani-krogi.json`: urne meritve ARSO PM2,5 (Bežigrad, Celovška, Vič), zimski meseci. Vir: ARSO; urni podatki niso formalno validirani.
  - `cetrti.json`: indeks izpostavljenosti iz `primeri/cs_kazalniki.csv` (stavbe, omrežja, relief, meritve), prikazan relativno na povprečje mesta.
  - `ustanove.json`: vrtci, šole, domovi starejših. © OpenStreetMap contributors (ODbL).
- **AQI**: lestvica US EPA (2024), izračunana iz urne meritve PM2,5. ARSO ne objavlja AQI števila. Igra uporablja učno lestvico µg/m³, ne zdravstvenih mej.

## Poštena raba podatkov

- Meritev, model in ocena so povsod ločeno označeni (● MERITEV, MODEL, ○ OCENA).
- Liga četrti razvršča po točkah v igri, ne po kakovosti zraka.
- Zemljevid kaže samo tri uradne postaje; občanski senzorji so v pripravi.
- Liga in prijatelji so primer (DEMO), dokler ni strežnika.

## Struktura

```
src/
  arso.ts, forecast.ts, rounds.ts   viri podatkov (ARSO, CAMS + umerjanje, krogi igre)
  aqi.ts, profile.ts, game.ts       lestvice, nasveti, logika igre
  screens/                          en zaslon na Figma okvir
  components/                       zavihki, izbira postaje
  theme.css                         barve in pisave iz Figme (svetlo/temno)
scripts/build_data.py               podatki iz paketa → public/data
android/                            Capacitor + nativni widget
```

## Omejitve prototipa

- Vse je v `localStorage` na napravi. Liga in prijatelji so DEMO.
- Obvestila delujejo samo, ko je aplikacija odprta (ni push strežnika).
- Android widget še ni prenovljen po Figmi.

## Naslednji koraki

- Strežnik za ligo (anonimni ID naprave + četrt) in push obvestila
- Widgeti po Figmi (krožni, pravokotni, srednji "Vstop v igro"), iOS WidgetKit in Apple Watch
- Občanski senzorji (Sensor.Community, PurpleAir, umerjeni) na zemljevidu kot OCENA
- Postavitev za tablico (Za odločevalce · Tablica)
