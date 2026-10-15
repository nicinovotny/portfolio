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

## 3. Neuen Ort anlegen

1. In `data/albums.json` einen bestehenden Ort-Block kopieren und anpassen:

| Feld | Bedeutung |
|---|---|
| `id` | kurz, Kleinbuchstaben, Bindestriche – zugleich Ordnername in `images/` und Adresse `album.html?ort=<id>` |
| `name` | voller Name, z. B. „Südtirol · Dolomiten“ |
| `shortName` | kurze Form für Karte und Navigation |
| `country` | Land (wird im Steckbrief gezählt) |
| `continent`, `region` | Schlüssel aus `"regions"` oben in der Datei – steuern Cluster und Zoomstufen der Karte |
| `coords` | `lat` (Breite, Nord positiv) und `lon` (Länge, Ost positiv, West negativ) |
| `text` | kurzer Text zum Ort |
| `cover`, `images` | siehe oben |

2. **Koordinaten finden:** Google Maps → Rechtsklick auf den Ort → die erste Zahl ist `lat`, die zweite `lon`.
3. **Neue Region oder neuer Kontinent:** oben unter `"regions"` ergänzen, z. B.
   ```json
   "iceland": { "name": "Island", "level": "region", "continent": "europe" },
   "north-america": { "name": "Nordamerika", "level": "continent" }
   ```
   Mehrere Orte in derselben Region werden auf der Karte automatisch zum Cluster, ein einzelner Ort bekommt einen eigenen Marker. Zoom-Ausschnitte rechnet die Karte selbst aus.
4. Ordner `images/<id>/` anlegen und Bilder wie oben einfügen.
5. **Reihenfolge** der Orte in `albums.json` = Album-Nummern, Reihenfolge der Startseiten-Diashow und „Voriger/Nächster Ort“.

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

### Später: eigene Domain (nicolasnovotny.de)

1. GitHub → Settings → Pages → *Custom domain*: `nicolasnovotny.de` eintragen → *Save* (legt eine Datei `CNAME` im Repo an – danach in GitHub Desktop *Pull*).
2. Beim Domain-Anbieter DNS setzen:
   - vier **A-Einträge** für `nicolasnovotny.de`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - **CNAME** für `www` → `nicinovotny.github.io`
3. Wenn GitHub die Domain bestätigt hat: **Enforce HTTPS** anhaken.

Weil alle Pfade relativ sind, muss an der Seite selbst nichts geändert werden.

---

## 5. Checkliste vor dem „richtigen“ Start

- [ ] Eigene Bilder überall eingefügt (kein `"demo"` mehr in `albums.json`)
- [ ] Dann: `<link rel="preconnect" href="https://fastly.picsum.photos">` aus `index.html` und `album.html` löschen und im Datenschutz den Abschnitt „Demo-Bilder“ entfernen
- [ ] Ortstexte in `albums.json` und Einstiegstext auf der Startseite (`index.html`)
- [ ] LinkedIn-Link in allen HTML-Dateien (Suchen nach `[Platzhalter] LinkedIn`)
- [ ] Porträt und Texte in `ueber-mich.html`
- [ ] Impressum und Datenschutz ausfüllen und prüfen lassen
