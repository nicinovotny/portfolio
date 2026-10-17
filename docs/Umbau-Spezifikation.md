# Auftrag für Claude Code: Umbau nicolasnovotny.de zum breiten Foto-Portfolio

Stand: 17.10.2026 · Diese Datei enthält alles, was du für den Umbau brauchst: Arbeitsauftrag, Design-Grundlagen, Spezifikation und Bestandsliste.

> Abweichungen, die mit Nici abgestimmt sind (GSAP selbst gehostet, Höhenlinien-Marker statt Fadenkreuz, Import über `tools/images.mjs`), stehen in `docs/Entscheidungen.md` unter „Umbau zum breiten Portfolio“ und haben Vorrang.

---

## 0. Dein Auftrag (bitte zuerst lesen)

Du arbeitest im Repo der live geschalteten Portfolio-Seite **nicolasnovotny.de** (GitHub Pages) von Nicolas „Nici“ Novotny. Die Seite ist bisher ein Landschafts-Portfolio mit einer Weltkarte als Herzstück. Sie wird jetzt zu einem Portfolio umgebaut, das die **ganze fotografische Breite** zeigt.

So gehst du vor:
1. **Verschaffe dir zuerst einen Überblick über das Repo** (Ordnerstruktur, `data/albums.json`, JS-Module, Seiten, CSS, vorhandene Skills/Skripte, z. B. einen Bild-Import-Skill). Fasse kurz zusammen, was du vorfindest und wo es von dieser Spezifikation abweicht, **bevor** du etwas änderst.
2. Arbeite **Schritt für Schritt** nach der Reihenfolge in Abschnitt 15. Nach jedem Schritt muss die Seite lokal testbar sein (`npx serve` oder VS Code Live Server). Halte nach jedem Schritt an, beschreibe kurz, was sich geändert hat und wie Nici es testet, und warte auf sein Okay.
3. Nenne bei jeder Änderung zuerst die betroffenen Dateien.
4. **Keine Inhalte erfinden.** Texte und Bildtitel bleiben `[Platzhalter]`. Echte Bilder und Texte füllt Nici am Ende ein. Für neue Einträge ohne Bilder verwende Demo-Bilder von picsum.photos mit festen Seeds, als `"demo": true` markiert.
5. Bei Unklarheiten oder wenn etwas im Repo dieser Spezifikation widerspricht: **nachfragen statt raten.** Größere Abweichungen kurz vorschlagen und Bestätigung abwarten.
6. Kommunikation auf Deutsch. Code-Bezeichner auf Englisch, Kommentare kurz auf Deutsch.
7. Nach jedem abgeschlossenen Schritt ein sauberer Commit mit aussagekräftiger Nachricht.

### Feste Rahmenbedingungen
- Vanilla HTML, CSS und JavaScript, GSAP (inkl. ScrollTrigger, Flip falls nötig) per CDN. **Kein Framework, kein Build-Schritt** für die Seite. Hilfsskripte unter `tools/` dürfen Node-Pakete nutzen.
- Hosting auf GitHub Pages, **alle Pfade relativ**.
- `data/albums.json` ist die **einzige Quelle** für Collections, Einträge und Bilder. Alle Seiten werden daraus generiert.
- Keine Cookies, kein Tracking, keine Analytics, kein Kontaktformular. Schriften selbst gehostet.
- Die Bilder sind der Star. Effekte nur mit Zweck.
- Performance (Lazy Loading, `srcset`, WebP/AVIF, keine Layout-Sprünge, 60 fps), voll responsiv, Tastaturbedienung, Alt-Texte, `prefers-reduced-motion` immer mitdenken.
- Sauberer, kommentierter Code, den Nici versteht und weiterentwickeln kann.

---

## 1. Design-Grundlagen (bleiben unverändert)

- Designrichtung A2 „Höhenlinie“: dunkel, präzise, Instrumenten-Ästhetik, Bilder bleiben der Star.
- Startseiten-Stil (A2): Titel in Geist 200 (groß, eng gesetzt), gesperrter Name in Versalien, Haarlinien (0,75 px), Links mit Haarlinie statt gerahmter Buttons, große Ziffer plus feine Fortschrittslinie.
- Karten-Stil (A): Fadenkreuz-Marker, Labels in Geist Mono mit Koordinaten, Cluster als gestrichelter Ring, Gradnetz mit Gradangaben, Zoom-/Kamera-Readout oben rechts, Weltübersicht unten links, „Weltansicht“-Button oben links.
- **Keine Glas-Navigation.** Schlichte Leiste, auf allen Seiten gleich.

**Farben**
- Grund `#0B0D0E`, Land `#14181B`–`#161B1F`, Küstenlinie `#353E44`–`#3C474E`
- Text `#ECE8E1`, Sekundärtext `#8C9397`, leise Labels `#5E666B`
- Akzent Gletscher `#A9C4C4`, nur für aktive Zustände und Markierungen

**Schriften**
- Geist (200–400) für Titel, Navigation und Fließtext
- Geist Mono für Koordinaten, Labels, Readouts, Aufnahmedaten
- Beide selbst gehostet

**Karte (technisch unverändert)**
- Natural Earth (`world-atlas`), 110m für die Übersicht, 50m für Zoom-Ausschnitte, Färöer in voller Auflösung
- Projektion Natural Earth 1, Zoom über animierte viewBox, Stufen Welt → Kontinent → Region
- Zeigt künftig nur Einträge mit Koordinaten (in der Regel Trips)

---

## 2. Ziel und Grundidee des Umbaus

- Das Portfolio zeigt die **ganze fotografische Breite**: Landschaft, Automotive, Wildlife, Portrait, Creative.
- **Landschaft bleibt der Schwerpunkt** (größter Bestand), ist aber nicht mehr das einzige Thema.
- Die **Karte ist kein Hauptfeature mehr**, sondern ein eigenständiges Nebenfeature für Reisen.
- Zuerst wird das **Grundgerüst** gebaut. Inhalte folgen am Ende.

---

## 3. Informationsarchitektur

```
Startseite (index.html)
├─ Collections (collections.html)          ersetzt die Alben-Übersicht
│  └─ Collection (collection.html?id=…)    neu
│     └─ Eintrag (entry.html?id=…)         Trip oder Shoot; ersetzt album.html
│        └─ Lightbox                        Bild + Aufnahmedaten
├─ Karte (karte.html)                       bleibt, Nebenfeature
└─ Über mich (ueber-mich.html)
Impressum / Datenschutz (Footer)
```

**Navigation (alle Seiten gleich):** Name links · rechts `Collections · Karte · Über mich` + Instagram/LinkedIn-Icons. Der Menüpunkt „Alben“ entfällt.

**Alte URLs weiterleiten** (die Seite ist live):
- `alben.html` → `collections.html`
- `album.html?ort=<id>` → `entry.html?id=<id>`
- `kleinarl` → `kleinarl-2025` (id ändert sich)

Weiterleitung über eine kleine Seite mit `<meta http-equiv="refresh">` und JS-Fallback, der den Query-Parameter mitnimmt.

**Der Begriff „Album“ entfällt** in der gesamten Oberfläche.

---

## 4. Collections

| Reihenfolge | id | Name | Inhalt |
|---|---|---|---|
| 01 | `landscape` | Landscape | Landschaft, Reisen |
| 02 | `automotive` | Automotive | Motorräder und Autos |
| 03 | `wildlife` | Wildlife | Tiere, auch aus Landschaftsreisen per Tag |
| 04 | `portrait` | Portrait | Porträts, Studio, Hochzeiten |
| 05 | `creative` | Creative | Konzeptuelles, z. B. Halloween |

- Namen englisch, Reihenfolge fest, Landscape immer zuerst.
- Feld `published: true|false`. Eine Collection geht live, wenn sie genug starkes Material hat (Richtwert: mindestens 2–3 Einträge oder etwa 10 starke Bilder). Im Grundgerüst alle anlegen.
- **Analog ist keine Collection,** sondern ein Tag (`analog`).

---

## 5. Eintragsarten (ersetzen „Album“)

Intern heißt alles `entry`, die Art steht in `kind`. Die Arten werden so implementiert und im Gebrauch überprüft.

| kind | Label (UI) | Wann | Darstellung | Zeitangabe |
|---|---|---|---|---|
| `trip` | TRIP | Der **Ort** steht im Mittelpunkt, egal ob Tagesausflug oder zwei Wochen | Galerie (wie die heutige Albumseite) | Jahr oder Zeitraum, z. B. `AUG 2024 · 12 TAGE` |
| `shoot` | SHOOT | Ein **Motiv, eine Person oder ein Thema** steht im Mittelpunkt, ein Termin, oft nur 3–8 Bilder | großzügige Bildstrecke (untereinander oder paarweise, Magazin-Look) | Datum, Monat oder Jahr |
| `frame` | FRAME | **einzelnes Bild** ohne Zusammenhang | keine eigene Seite, Klick öffnet direkt die Lightbox | Jahr |
| *(später)* `series` | SERIES | offene Serie über längere Zeit | wachsende Bildstrecke | `SEIT 2024` |

Regeln:
- Die Art hängt **am Eintrag, nicht an der Collection.**
- Unterscheidung nach **Absicht, nicht nach Dauer** (Tagesausflug zum Eibsee = Trip).
- **Jahr ist ein eigenes, optionales Feld,** nicht Teil des Namens. Anzeige: `NAME · JAHR`.
- UI-Labels englisch in Geist Mono: `TRIP · FÄRÖER-INSELN · 2024`, `SHOOT · HALLOWEEN · 2023`.

---

## 6. Tags und Mehrfachzuordnung

Beispiel: Ein Papageientaucher aus dem Island-Trip gehört zu Landscape (über den Trip) **und** zu Wildlife.

**Eintragsebene**
- `collection` (Pflicht): Heimat-Collection. Dort erscheint der Eintrag als Kachel.
- `alsoIn` (optional, Array): weitere Collections, in denen der **ganze Eintrag** ebenfalls als Kachel erscheint.

**Bildebene**
- `tags` (optional, Array): Collection-IDs und Technik-Tags, z. B. `["wildlife"]`, `["analog"]`.
- Ein Bild gehört automatisch zur Collection seines Eintrags. Tags fügen nur zusätzliche Collections hinzu.
- Technik-Tags (zunächst nur `analog`) erzeugen keine Collection, nur einen Chip in der Lightbox.

**Collection-Seite**
1. **Einträge:** alle mit `collection == id` oder `id ∈ alsoIn`, gruppiert nach Trips und Shoots, Neuestes zuerst, als Raster. **Keine Jahresüberschriften,** damit Lücken nicht auffallen.
2. **Frames:** eigene Frames **plus alle getaggten Bilder aus anderen Einträgen**, letztere mit Herkunftszeile `AUS: ISLAND · 2025 →`. Raster respektiert die Formate (kein Zwangszuschnitt).
3. Collections **ohne eigene Einträge sind erlaubt** (Wildlife startet so).

**Zähler (Readout):** z. B. `WILDLIFE · 23 BILDER · AUS 6 EINTRÄGEN`, `AUTOMOTIVE · 8 SHOOTS`.

**Lightbox:** Tags als kleine Mono-Chips, die zur Collection verlinken.

---

## 7. Startseite (index.html)

Vier Abschnitte, danach der Footer.

### 7.1 Hero: Collection-Slides mit stündlicher Rotation
- **Ein fester Slot pro veröffentlichter Collection,** in fester Reihenfolge (Landscape zuerst).
- Pro Slot ein Bild aus den **Hero-Favoriten** dieser Collection. Favoriten werden **pro Bild** gesetzt und können aus jedem Eintrag stammen, auch über Tags.
- **Stündliche, deterministische Rotation:**
  ```js
  // Stündliche Rotation: jeder Favorit kommt der Reihe nach dran
  const hourIndex = Math.floor(Date.now() / 3_600_000);
  const offset = hashString(collection.id);            // Versatz, damit nicht alle gleichzeitig wechseln
  const pick = favorites[(hourIndex + offset) % favorites.length];
  ```
  Es wird nichts gespeichert. Innerhalb einer Stunde bleibt der Hero stabil.
- **Fokuspunkt pro Favorit** (`focus: [x%, y%]`, optional `focusMobile`) als `object-position`, damit Hochformate richtig beschnitten werden.
- **Slide-Inhalt** im A2-Stil:
  - große Ziffer und Name: `02 / 05 — AUTOMOTIVE`
  - Link mit Haarlinie: `Collection öffnen →`
  - Herkunftszeile in Mono: `AUS: SHOOT · APRILIA RS 660 · 2026 →`
  - feine Fortschrittslinie, Pause-Button wie bisher
- Optional: leises Label `AUSWAHL 13:00`.
- Slots von Collections ohne Favoriten oder mit `published: false` entfallen.
- Erstes Bild eager mit `fetchpriority="high"`, die übrigen lazy.
- `prefers-reduced-motion`: einfache Überblendung, kein Autoplay.

### 7.2 Persönliches Intro
- Ersetzt den bisherigen Platzhalter-Satz („Orte, an denen das Licht …“).
- Kleines Porträt (Platzhalter), zwei bis drei Sätze persönlicher Ton („Hey, ich bin Nici …“, Platzhalter) in Geist 200.
- Readout-Zeile in Mono, z. B. `STUTTGART · SEIT 2019 · DIGITAL & FILM`. Zahlen (Länder, Einträge) aus `albums.json` berechnen.
- Link zu „Über mich“.

### 7.3 Collections als typografische Liste
- Große Zeilen: `01  LANDSCAPE ……………… 30 TRIPS`.
- Desktop: Beim Überfahren blendet ein Vorschaubild ein (neben dem Cursor oder rechts).
- Mobil: große Bildzeilen mit Cover und Namen, ohne Hover-Abhängigkeit.
- Tastatur-fokussierbar, Fokuszustand im Akzent `#A9C4C4`.

### 7.4 Zuletzt + Kartenstreifen
- Die **drei neuesten Einträge** (Trips und Shoots, keine Frames) mit Art-Label, Name, Datum.
- Daneben bzw. darunter ein **schmaler Kartenstreifen** mit Fadenkreuz-Markern und `Karte öffnen →`. Einziger Karten-Einstieg auf der Startseite.

---

## 8. Collections-Übersicht (collections.html)

- Ersetzt `alben.html`.
- Alle veröffentlichten Collections in fester Reihenfolge mit großem Cover, Name, ein bis zwei Sätzen (Platzhalter) und Zähler.
- Layout wie die Liste der Startseite, nur größer und mit sichtbaren Covern.

## 9. Collection-Seite (collection.html?id=…)

- Kopf: Ziffer und Name, kurzer Text (Platzhalter), Readout mit Zählern.
- Danach Einträge, dann Frames inklusive getaggter Bilder (siehe Abschnitt 6).
- Ende: `Nächste Collection →` (zyklisch) und `Alle Collections`.

## 10. Eintragsseite (entry.html?id=…)

- Gemeinsames Template, **zwei Layouts** je nach `kind`:
  - `trip`: Galerie wie die bisherige Albumseite
  - `shoot`: großzügige Bildstrecke, damit auch 3–5 Bilder hochwertig wirken
- Kopf: Art-Label, Name, Datum/Zeitraum, Kurztext (Platzhalter). Bei Trips mit Koordinaten `Auf der Karte zeigen →` in den passenden Zoom-Ausschnitt (wie bisher).
- Navigation: vorheriger/nächster Eintrag **innerhalb der Collection**, `← Zurück zu <Collection>`.
- Frames haben keine Eintragsseite. `entry.html?id=<frame>` öffnet die Collection mit dem Frame in der Lightbox.

## 11. Lightbox mit Aufnahmedaten

- Öffnet beim bewussten Anklicken eines Bildes.
- Darunter (Mobil) bzw. rechts daneben (breite Screens):
  ```
  Sonnenuntergang über Seoul                      ← Titel, Geist
  TRIP · SEOUL · 2026 →                            ← Herkunft, Link, Versalien gesperrt
  ─────────────────────────────────────────────
  SONY α7 V · 24–70 MM   35 MM   ƒ/8   1/250 S   ISO 100   ← Mono, leise Labelfarbe
  WILDLIFE   ANALOG                                ← Tag-Chips (falls vorhanden)
  ```
- Analoge Bilder: `CANON AE-1 · 50 MM · KODAK PORTRA 400` statt EXIF.
- **Nur vorhandene Werte anzeigen,** fehlende Felder entfallen ohne Platzhalter.
- Mobil: `i`-Button blendet die Daten ein/aus, Standard ausgeblendet.
- Pfeiltasten und Wischen zum Blättern, Escape schließt, Fokusfalle, `aria-modal`, Alt-Text aus den Daten.

## 12. Datenmodell (`data/albums.json`)

Dateiname bleibt. `featured` entfällt, `regions` bleibt für die Karte.

```json
{
  "collections": [
    {
      "id": "landscape",
      "name": "Landscape",
      "order": 1,
      "published": true,
      "text": "[Platzhalter: 1–2 Sätze Haltung]",
      "cover": "faroe-2024/02",
      "heroFavorites": [
        { "image": "faroe-2024/02", "focus": [50, 40] },
        { "image": "seoul-2026/01", "focus": [50, 50], "focusMobile": [60, 50] }
      ]
    }
  ],

  "regions": { "…": "unverändert für die Karte" },

  "entries": [
    {
      "id": "iceland-2025",
      "kind": "trip",
      "name": "Island",
      "collection": "landscape",
      "alsoIn": [],
      "year": 2025,
      "dateStart": "2025-08-02",
      "dateEnd": "2025-08-14",
      "region": "iceland",
      "coords": { "lat": 64.9, "lon": -18.6 },
      "text": "[Platzhalter]",
      "cover": 0,
      "images": [
        {
          "id": "03",
          "file": "puffin-03.webp",
          "width": 2400, "height": 1600,
          "title": "Papageientaucher am Dyrhólaey",
          "alt": "[Alt-Text]",
          "tags": ["wildlife"],
          "exif": {
            "camera": "Sony A7R III",
            "lens": "FE 100–400mm",
            "focal": 400,
            "aperture": 5.6,
            "shutter": "1/1000",
            "iso": 400,
            "film": null,
            "source": "file"
          }
        }
      ]
    },
    {
      "id": "halloween-2023",
      "kind": "shoot",
      "name": "Halloween",
      "collection": "creative",
      "year": 2023,
      "date": "2023-10-31",
      "coords": null,
      "images": []
    },
    {
      "id": "nebel-2025",
      "kind": "frame",
      "name": "Nebel über dem Kessel",
      "collection": "creative",
      "year": 2025,
      "images": [ { "id": "01", "file": "…" } ]
    }
  ]
}
```

(Die Werte oben sind Beispiele für die Struktur, keine echten Daten.)

- **Bildreferenz** überall als `"<entryId>/<imageId>"`.
- **Pflicht:** Eintrag `id`, `kind`, `name`, `collection`, `images`. Bild `id`, `file`, `width`, `height`, `alt`. Rest optional. `date` darf `"2023-03"` sein.
- **Karte** zeigt alle Einträge mit `coords`. Shoots/Frames haben meist `coords: null`. Cluster-Logik bleibt.

**Migration der bestehenden 20 Alben**
- `albums` → `entries`, jedes bekommt `kind: "trip"` und `collection: "landscape"`.
- Bilder bekommen eine `id` (`"01"`, `"02"` …).
- `featured` entfernen, `collections` mit Platzhalter-Favoriten ergänzen.
- `black-forest-2023` aufteilen in `black-forest-summer-2023` und `black-forest-autumn-2023`.
- `kleinarl` → `kleinarl-2025`, `year: 2025` setzen.
- `bergen-2026` umbenennen in „Bergen & Hardangerfjord“.

## 13. Bildimport und EXIF (Hilfsskript, kein Build-Schritt der Seite)

`tools/import.mjs`, lokal mit Node, Pakete `exifr` und `sharp` (nur in `tools/`). Falls im Repo schon ein Import-Skill oder -Skript existiert, diesen erweitern statt neu bauen.

Ablauf pro Bild:
1. **Originaldatei** lesen (JPEG oder Lightroom-Export mit Metadaten), **nicht** das fertige WebP.
2. Kamera, Objektiv, Brennweite, Blende, Belichtungszeit, ISO, Aufnahmedatum auslesen.
3. `images/<entryId>/<datei>.webp` mit langer Kante 2400 px plus ca. 1200 px für `srcset` erzeugen, Breite/Höhe eintragen.
4. **Alle Metadaten aus veröffentlichten Dateien entfernen, insbesondere GPS.** Kartenkoordinaten kommen nur aus `albums.json`.
5. Werte mit `"source": "file"` in `albums.json` schreiben.
6. **Fehlende Werte NICHT schätzen.** Im Terminal nachfragen (Enter = leer lassen). Bei analogen Bildern nach Kamera, Objektiv, Film fragen. Manuelle Werte mit `"source": "manual"`, unbekannte bleiben `null` und werden nicht angezeigt.
7. Optional Titel, Alt-Text und Tags abfragen.
8. Kann ein Bild über das Aufnahmedatum einem Eintrag zugeordnet werden (z. B. Sommer- vs. Herbst-Trip), dies vorschlagen und bestätigen lassen.

## 14. Hinweise

- **Hochzeiten:** Hochzeiten von Freunden, Einwilligung des Paars liegt vor. Bei gut erkennbaren Gästen im Zweifel Bilder ohne Gäste wählen.
- **Wildpark-Bilder:** als Wildpark kennzeichnen (`WOLF- UND BÄRENPARK`), nicht als freie Wildbahn.
- **Idee für später, nicht umsetzen:** Equipment-Zeitleiste auf „Über mich“ (Kameras verlinkt auf die Einträge, die damit entstanden sind).
- Offene Designfrage: Art-Labels englisch (TRIP / SHOOT / FRAME) oder deutsch. **Standard: Englisch.**

---

## 15. Umsetzungsreihenfolge

Nach jedem Schritt anhalten, Testanleitung geben, auf Okay warten, committen.

1. **Datenmodell migrieren:** `albums.json` auf `collections` + `entries` umstellen (siehe Abschnitt 12), JS-Loader anpassen, Karte und bestehende Seiten funktionieren weiter.
2. **Eintragsseite:** `album.html` → `entry.html` mit beiden Layouts, Weiterleitungen für alte URLs.
3. **Lightbox** mit Aufnahmedaten, Tag-Chips, `i`-Button für Mobil.
4. **Collection-Seite** inklusive Tag-Logik und Frames.
5. **Collections-Übersicht** und Navigation umstellen, `alben.html` weiterleiten.
6. **Startseite:** Hero mit stündlicher Rotation und Fokuspunkt, Intro, Collections-Liste, Zuletzt + Kartenstreifen.
7. **Import-Skript** mit EXIF, GPS-Entfernung, WebP und srcset.
8. **Neue Einträge** aus der Bestandsliste (Abschnitt 16) als Platzhalter mit Demo-Bildern anlegen.

---

## 16. Bestandsliste

Legende: **neu** = Eintrag anlegen · **vorhanden** = existiert bereits · **erweitern** = vorhanden, Name oder Bilder ergänzen.
Kamera nur zur Orientierung, verbindlich sind später die EXIF-Daten.

### Nikon D3300 (2019–2020)
| id | Name | kind | Collection | Jahr | Status | Notiz |
|---|---|---|---|---|---|---|
| `scotland-2019` | Schottland | trip | landscape | 2019 | neu | erste Fotoreise |
| `salzkammergut-2020` | Salzkammergut | trip | landscape | 2020 | neu | Gollinger Wasserfall, Hallstatt, Gosau |
| `saxony-harz-2020` | Sächsische Schweiz & Harz | trip | landscape | 2020 | neu | inkl. Dresden |
| `allgaeu-zugspitze-2020` | Allgäu & Zugspitze | trip | landscape | 2020 | neu | Wochenende: Oberstdorf · Neuschwanstein · St. Coloman · Geroldsee · Eibsee |
| `dolomites-2020` | Dolomiten | trip | landscape | 2020 | neu | |
| `algarve-2020` | Algarve | trip | landscape | 2020 | vorhanden | |

### Nikon D750 (2021–2022)
| id | Name | kind | Collection | Jahr | Status | Notiz |
|---|---|---|---|---|---|---|
| `allgaeu-winter-2021` | Allgäu im Winter | trip | landscape | 2021 | neu | Bad Hindelang · Nesselwang · St. Coloman |
| `stockholm-2021` | Stockholm | trip | landscape | 2021 | vorhanden | |
| `iceland-2021` | Island | trip | landscape | 2021 | vorhanden | |
| `tuono-660-2022` | Aprilia Tuono 660 | shoot | automotive | 2022 | neu | erstes Motorrad-Shooting |

### Sony A7R III (2023 – Anfang 2026)
| id | Name | kind | Collection | Jahr | Status | Notiz |
|---|---|---|---|---|---|---|
| `tuono-660-2023` | Aprilia Tuono 660 | shoot | automotive | 2023-03 | neu | |
| `black-forest-summer-2023` | Schwarzwald · Sommer | trip | landscape | 2023 | erweitern | Roadtrip, Schwerpunkt Triberger Wasserfälle; entsteht aus `black-forest-2023` |
| `black-forest-autumn-2023` | Schwarzwald · Herbst | trip | landscape | 2023 | neu | Roadtrip, Schwerpunkt Bühlertal |
| `hohenzollern-2023` | Burg Hohenzollern | trip | landscape | 2023 | neu | |
| `neuschwanstein-2023` | Allgäu · Neuschwanstein | trip | landscape | 2023 | vorhanden | Herbst |
| `halloween-2023` | Halloween | shoot | creative | 2023 | neu | |
| `eibsee-winter-2023` | Eibsee im Winter | trip | landscape | 2023 | neu | Tagesausflug |
| `gran-canaria-2024` | Gran Canaria | trip | landscape | 2024 | vorhanden | |
| `tuono-660-2024` | Aprilia Tuono 660 | shoot | automotive | 2024 | neu | |
| `seiser-alm-2024` | Dolomiten | trip | landscape | 2024 | vorhanden | Lieblingseintrag, Kandidat für Hero-Favoriten |
| `scotland-2024` | Schottland | trip | landscape | 2024 | vorhanden | |
| `faroe-2024` | Färöer-Inseln | trip | landscape | 2024 | vorhanden | |
| `lofoten-2024` | Lofoten | trip | landscape | 2024 | vorhanden | |
| `iceland-2025` | Island | trip | landscape | 2025 | vorhanden | Papageientaucher → Tag `wildlife` |
| `cortina-2025` | Dolomiten · Cortina d'Ampezzo | trip | landscape | 2025 | vorhanden | |
| `zermatt-2025` | Zermatt | trip | landscape | 2025 | vorhanden | |
| `saxon-switzerland-2025` | Sächsische Schweiz | trip | landscape | 2025 | vorhanden | |
| `seoul-2025` | Seoul | trip | landscape | 2025 | vorhanden | |
| `s1000rr-2025` | BMW S 1000 RR | shoot | automotive | 2025 | neu | kleines Shooting |
| `s1000rr-porsche-2025` | BMW S 1000 RR & Porsche | shoot | automotive | 2025 | neu | erstes Auto |
| `rs660-2026` | Aprilia RS 660 | shoot | automotive | 2026 | neu | Stuttgart, letztes Shooting mit der R3 |

### Fujifilm X100VI (2025)
| id | Name | kind | Collection | Jahr | Status | Notiz |
|---|---|---|---|---|---|---|
| `bucharest-2025` | Bukarest | trip | landscape | 2025 | vorhanden | |
| `kleinarl-2025` | Kleinarl · Ski | trip | landscape | 2025 | vorhanden | bisherige id `kleinarl`, umbenennen + weiterleiten |

### Sony α7 V (2026)
| id | Name | kind | Collection | Jahr | Status | Notiz |
|---|---|---|---|---|---|---|
| `motorcycles-friends-2026` | Motorräder · Freunde | shoot | automotive | 2026 | neu | kleines Shooting |
| `bergen-2026` | Bergen & Hardangerfjord | trip | landscape | 2026 | erweitern | umbenennen |
| `wedding-1-2026` | Hochzeit | shoot | portrait | 2026 | neu | Freunde, Einwilligung liegt vor |
| `wedding-2-2026` | Hochzeit | shoot | portrait | 2026 | neu | Freunde, Einwilligung liegt vor |
| `bernese-oberland-2026` | Berner Oberland | trip | landscape | 2026 | vorhanden | Interlaken |
| `seoul-2026` | Seoul | trip | landscape | 2026 | vorhanden | September |

### Beim Import zuzuordnen
Mummelsee und Wolf- und Bärenpark (bisher in `black-forest-2023`) per EXIF-Datum dem Sommer- oder Herbst-Trip zuordnen. Wildpark-Bilder bekommen den Tag `wildlife`.

### Ergebnis pro Collection
- **Landscape:** 30 Trips
- **Automotive:** 8 Shoots (2022–2026)
- **Wildlife:** nur getaggte Bilder (live, sobald etwa 10 starke Bilder getaggt sind)
- **Portrait:** 2 Hochzeiten
- **Creative:** Halloween 2023

Im Grundgerüst stehen **alle Collections auf `published: true`,** damit alles mit Demo-Bildern testbar ist. Vor dem Live-Gang entscheidet Nici pro Collection, was sichtbar bleibt.
