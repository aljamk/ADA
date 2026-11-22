# Kaj dihaš?

Zrak v Ljubljani. Veš, kdaj ven.

Aplikacija pokaže, kakšen zrak dihaš zdaj v svoji četrti, kdaj je pravi čas za sprehod ali zračenje in zakaj je zrak tak, kot je. Brez prijave in brez sledenja. Vodi te golob Robert, ki s svojim razpoloženjem odigra trenutno kakovost zraka.

**Aplikacija je objavljena na [kajdihas.netlify.app](https://kajdihas.netlify.app).** Na telefonu se odpre kot aplikacija, na računalniku v okvirju telefona s predogledom widgetov in animacij.

Nastala je na ADA Hack 2026 za izziv Abelium × ARSO.

## Kaj zna

- **Zdaj**: kakovost zraka v tvoji četrti z uro, lestvica US EPA, spodbuden nasvet za tvojo skupino (starejši, nosečnost, astma, otroci) in kratka razlaga, zakaj je zrak tak.
- **Zemljevid**: tri uradne postaje ARSO in umerjeni občanski senzorji, Moje postaje in Meritve.
- **Igre**: štiri dnevne naloge, s katerimi se Robert prebije iz megle, in učenje o delcih.
- **Četrti**: ocena za vseh 17 četrtnih skupnosti iz meritev in izpostavljenosti.
- **Opozorila**: obvestilo za zračenje, opozorilo večer prej, kurilna in turistična sezona.
- **Za odločevalce**: semafor za naslednjih 48 ur (zgodnje opozorilo) in od kod delci po četrtih, kurišča ali promet.
- **Android**: trije widgeti za domači zaslon (kvadrat, podolgovat, večji).

## Podatki

Vsi podatki so iz paketa [vidacex/ARSOhack](https://github.com/vidacex/ARSOhack) in javnih virov, ki jih paket navaja. Meritev, model in ocena so v aplikaciji vedno ločeno označeni.

| Kaj | Vir | Oznaka |
|---|---|---|
| Zrak zdaj | ARSO XML, tri postaje v Ljubljani (Bežigrad, Celovška, Vič) | MERITEV |
| Občanski senzorji | Sensor.Community, naprave in umerjanje iz paketa | OCENA |
| Naslednje ure in dnevi | CAMS prek Open-Meteo, umerjen na meritve | NAPOVED |
| Vreme za zgodnje opozorilo | Open-Meteo (veter, mejna plast, padavine) | NAPOVED |
| Od kod delci | Model GRAL (ARSO) za leto 2021, po četrtih in urah | OCENA · MODEL GRAL |
| Četrti | kazalniki izpostavljenosti iz paketa | OCENA |

Lestvica: US EPA AQI iz urne meritve PM2,5.

## Zagon

```bash
npm install
npm run dev
```

Neposredne povezave: `#zdaj`, `#zemljevid`, `#igra`, `#cetrti`, `#opozorila`, `#odlocevalci`. `?intro=0` preskoči uvodni zaslon.

Android (Capacitor):

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Struktura

```
src/screens/      en zaslon na zavihek, Predstavitev.tsx je okvir telefona za namizje
src/components/   Robert (plasti in animacije), izbira četrti in postaje, zavihki
src/*.ts          viri podatkov (arso, sensors, forecast, opozorilo), lestvica, nasveti
public/data/      podatki iz paketa (četrti, senzorji, viri GRAL), ustvarjeni s skriptami v scripts/
android/          Capacitor in trije nativni widgeti
```

## Omejitve

- Vse ostane na napravi (localStorage), ni strežnika in ni push obvestil.
- Vrednosti po četrtih in občanskih senzorjih so ocene, ne meritve.
- Napoved za 48 ur je model, umerjen na zadnjo meritev, in se lahko moti.
