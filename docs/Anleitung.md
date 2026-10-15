# Anleitung: Bilder, Orte, Veröffentlichen

Kurz und praktisch. Alles, was die Seite anzeigt, kommt aus **`data/albums.json`** und dem Ordner **`images/`**.

---

## 1. Arbeitsablauf mit GitHub Desktop

Das Projekt liegt auf jedem Gerät als eigener Klon (Mac: `~/Documents/GitHub/portfolio`). Abgeglichen wird über GitHub, nicht mehr über Google Drive.

1. **Vor dem Arbeiten:** GitHub Desktop öffnen → *Fetch origin* → falls angeboten *Pull origin*.
2. **Arbeiten und lokal testen:** im Projektordner `npx serve .` starten, dann <http://localhost:3000> öffnen.
3. **Danach sichern:** in GitHub Desktop links die Änderungen prüfen, unten eine kurze Beschreibung eintragen (z. B. „Färöer: eigene Bilder“) → *Commit to main* → *Push origin*.

Nach dem Push ist die Seite nach etwa einer Minute online aktualisiert.

> Am Windows-PC einmalig: GitHub Desktop → *File → Clone repository* → `nicinovotny/portfolio`. Danach gilt derselbe Ablauf. Den alten Drive-Ordner nicht mehr bearbeiten.

---

## 2. Eigene Bilder einfügen

### Am einfachsten: mit Claude

1. Exporte in voller Auflösung (JPEG, TIFF, PNG, HEIC oder WebP) nach **`images/_eingang/`** legen.
2. Claude Code im Projektordner öffnen und sagen: **„Bilder einpflegen“**.
3. Claude sieht sich die Bilder an und schlägt pro Bild Album (per GPS aus den Bilddaten), Titel und Alt-Text vor, fragt nach Demo-Bildern und Titelbild – du bestätigst oder änderst.
4. Claude wandelt um (`images/<album>/<album>-NN.webp` + `-1200.webp`), trägt alles in `albums.json` ein und prüft das Ergebnis. Originale landen in `images/_eingang/erledigt/` (wird nicht hochgeladen, kann geleert werden).

Der Skill steht in `.claude/skills/bilder-einpflegen/SKILL.md`, das Werkzeug dahinter in `tools/images.mjs`. Einmalig vorher: `cd tools && npm install`.

### Ohne Claude: Werkzeug direkt nutzen

```bash
node --no-warnings tools/images.mjs inspect                                   # was liegt im Eingang? Maße, Datum, GPS, nächstes Album
node --no-warnings tools/images.mjs convert --album faroe DSC_1001.jpg DSC_1002.jpg   # umwandeln
node --no-warnings tools/images.mjs check                                     # albums.json gegen die Dateien prüfen
```

`convert` gibt für jedes Bild `file`, `width` und `height` aus – diese Werte in `albums.json` eintragen (siehe unten).

### Von Hand exportieren (z. B. aus Lightroom)

Pro Bild **zwei Dateien** mit demselben Namen, die kleine mit dem Zusatz `-1200`:

| Fassung | Größe | Dateiname (Beispiel) |
|---|---|---|
| groß | lange Kante **2400 px** | `faroe-01.webp` |
| klein | **Breite 1200 px** | `faroe-01-1200.webp` |

- Format **WebP**, Qualität ca. 80. Kann dein Programm kein WebP: als JPEG exportieren und mit <https://squoosh.app> umwandeln (läuft lokal im Browser), oder einfach JPEG verwenden – dann heißen die Dateien `.jpg`, der Rest bleibt gleich.
- Farbraum sRGB, Metadaten gern entfernen (GPS!).
- Dateinamen: Kleinbuchstaben, keine Leerzeichen und Umlaute.

### Ablegen und eintragen

1. Beide Dateien nach `images/<ort-id>/` legen, z. B. `images/faroe/`.
2. In `data/albums.json` beim passenden Bild:
   - `"file"` auf den Namen der **großen** Datei setzen,
   - `"width"` und `"height"` auf die Maße der **großen** Datei (Mac: Datei im Finder auswählen → `Cmd + I` → *Abmessungen*),
   - `"title"` und `"alt"` anpassen – `alt` beschreibt, was zu sehen ist (für Screenreader und Suchmaschinen),
   - die Zeile `"demo": …` **löschen**. Solange sie da ist, wird das Demo-Bild angezeigt.

```json
{ "file": "faroe-01.webp", "width": 2400, "height": 1600, "title": "Brandung an den Felsnadeln", "alt": "Felsnadeln in der Brandung vor einer dunklen Steilküste" }
```

- Mehr Bilder: einfach weitere Zeilen in `"images"` ergänzen (Komma zwischen den Einträgen nicht vergessen).
- **Titelbild** (Startseite, Albenübersicht, Kartenvorschau): `"cover"` ist die Nummer in der Bildliste, gezählt ab 0.

---

## 3. Neue Reise anlegen

Jede Reise ist ein eigenes Album – auch wenn du zweimal am selben Ort warst (z. B. `iceland-2021` und `iceland-2025`). So mischen sich die Bilder verschiedener Jahre nicht.

1. In `data/albums.json` einen bestehenden Album-Block kopieren und anpassen:

| Feld | Bedeutung |
|---|---|
| `id` | Ort + Jahr, Kleinbuchstaben, Bindestriche, keine Umlaute, z. B. `bergen-2026` – zugleich Ordnername in `images/` und Adresse `album.html?ort=<id>` |
| `name` | voller Name, z. B. „Dolomiten · Seiser Alm“ (ohne Jahr, das wird automatisch dazugeschrieben) |
| `shortName` | kurze Form für Karte und Navigation |
| `year` | Jahr der Reise, z. B. `2026` (ohne Anführungszeichen); unbekannt: `null` |
| `country` | Land (wird im Steckbrief gezählt) |
| `region` | innerste passende Region aus `"regions"` oben in der Datei, z. B. `dolomites` – steuert Cluster und Zoomstufen der Karte |
| `coords` | `lat` (Breite, Nord positiv) und `lon` (Länge, Ost positiv, West negativ). Mehrere Reisen in dieselbe Gegend gern an verschiedene Punkte legen (z. B. Reykjavík und Höfn); liegen zwei Alben genau aufeinander, fächert die Karte sie automatisch auf. |
| `text` | kurzer Text zum Ort |
| `cover`, `images` | siehe oben |

2. **Koordinaten finden:** Google Maps → Rechtsklick auf den Ort → die erste Zahl ist `lat`, die zweite `lon`.
3. **Neue Region:** oben unter `"regions"` ergänzen. `"parent"` ist die übergeordnete Region; ein Kontinent hat kein `parent`. Regionen lassen sich beliebig verschachteln, z. B.
   ```json
   "north-america": { "name": "Nordamerika" },
   "rockies":       { "name": "Rocky Mountains", "parent": "north-america" },
   "france":        { "name": "Frankreich",      "parent": "central-europe" }
   ```
   Bisherige Gliederung: Europa → Nordeuropa / Mitteleuropa → Länder (z. B. `germany`, `switzerland`, `dolomites`). Mehrere Alben in derselben Region werden auf der Karte zum Cluster (Klick zoomt hinein), ein einzelnes Album bekommt einen eigenen Marker. Ist genug Platz, teilt sich ein Cluster von selbst auf. Zoom-Ausschnitte rechnet die Karte selbst aus.
4. Ordner `images/<id>/` anlegen und Bilder wie oben einfügen.
5. **Reihenfolge** der Alben in `albums.json` = Album-Nummern und „Voriger/Nächster Ort“. Festgelegt: neueste Reise zuerst, also neue Alben passend zum Jahr einsortieren. Die Seite „Alben“ gruppiert automatisch nach Jahr.
6. **Startseite:** Die Diashow zeigt nur die Alben aus `"featured"` ganz oben in `albums.json`, in dieser Reihenfolge (z. B. `["seoul-2026", "iceland-2025", …]`). Zum Austauschen einfach eine `id` ersetzen.

Optional: zusätzliche Kartenbeschriftungen (Länder, Meere) stehen in `tools/build-map.mjs` unter `LABELS`. Danach einmal `cd tools && npm install && npm run build-map`.

### Wenn nach einer Änderung nichts mehr lädt

Meist ist es ein Tippfehler im JSON (fehlendes Komma, Anführungszeichen, Komma nach dem letzten Eintrag). In VS Code wird die Stelle rot markiert, sonst hilft <https://jsonlint.com>.

---

## 4. Veröffentlichen auf GitHub Pages

### Einmalig

1. In GitHub Desktop *Push origin* (bzw. *Publish branch*).
2. Auf github.com: Repository `nicinovotny/portfolio` → **Settings → Pages**.
3. *Source:* **Deploy from a branch**, *Branch:* **main**, Ordner **/ (root)** → *Save*.
4. Nach ein bis zwei Minuten ist die Seite erreichbar unter **<https://nicinovotny.github.io/portfolio/>**.

Das Repository ist öffentlich – alle Dateien (auch `docs/`) sind dort für jeden sichtbar.

### Danach

Jeder Push auf `main` aktualisiert die Seite automatisch.

### Eigene Domain (nicolasnovotny.de)

GitHub Pages kostet auch mit eigener Domain nichts – zahlen musst du nur die Domain selbst beim Anbieter (für .de grob 5–16 € pro Jahr, auf den Verlängerungspreis achten). Ein reiner Domain-Vertrag reicht, kein Webhosting-Paket.

1. **Domain registrieren** beim Anbieter deiner Wahl.
2. **Domain bei GitHub bestätigen** (schützt davor, dass jemand anderes sie für eine eigene Pages-Seite nutzt): github.com → Profilbild → *Settings* → *Pages* → *Add a domain* → `nicolasnovotny.de`. GitHub zeigt einen **TXT-Eintrag** (Name `_github-pages-challenge-nicinovotny`, Wert = Code) – diesen beim Anbieter anlegen, dann bei GitHub *Verify*.
3. **DNS beim Anbieter setzen** – vorher vom Anbieter angelegte Standard-Einträge für `@` und `www` (Parkseite) löschen:

   | Typ | Name | Wert |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA (optional) | `@` | `2606:50c0:8000::153`, `…8001::153`, `…8002::153`, `…8003::153` |
   | CNAME | `www` | `nicinovotny.github.io` |

   Keine Platzhalter-Einträge (`*`) anlegen.
4. **Im Repo eintragen:** `nicinovotny/portfolio` → *Settings → Pages → Custom domain*: `nicolasnovotny.de` → *Save*. Das legt eine Datei `CNAME` im Repo an – danach in GitHub Desktop *Fetch* + *Pull*.
5. Warten, bis der *DNS check* grün ist (Minuten bis ca. 24 Stunden), dann **Enforce HTTPS** anhaken.

Die alte Adresse `nicinovotny.github.io/portfolio/` leitet danach automatisch auf die Domain um. Weil alle Pfade relativ sind, muss an der Seite selbst nichts geändert werden.

---

## 5. Checkliste vor dem „richtigen“ Start

- [ ] Eigene Bilder überall eingefügt (kein `"demo"` mehr in `albums.json`)
- [ ] Dann: `<link rel="preconnect" href="https://fastly.picsum.photos">` aus `index.html` und `album.html` löschen und im Datenschutz den Abschnitt „Demo-Bilder“ entfernen
- [ ] Ortstexte in `albums.json` und Einstiegstext auf der Startseite (`index.html`)
- [ ] LinkedIn-Link in allen HTML-Dateien (Suchen nach `[Platzhalter] LinkedIn`)
- [ ] Porträt und Texte in `ueber-mich.html`
- [x] Impressum und Datenschutz ausgefüllt (15.10.2026) – bei Änderungen anpassen (z. B. Verkauf von Fotos → ggf. Steuerangaben ins Impressum, neue externe Dienste → Datenschutz)
