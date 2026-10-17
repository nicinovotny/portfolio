# Anleitung: Bilder, Einträge, Veröffentlichen

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

So ist `data/albums.json` aufgebaut (Details in `docs/Umbau-Spezifikation.md`):

- **`collections`:** Landscape, Automotive, Wildlife, Portrait, Creative.
  - `published` schaltet eine Collection sichtbar.
  - `heroFavorites` sind die Bilder für die Startseite.
- **`entries`:** alle Einträge.
  - `kind` gibt die Art an: `trip` (Ort), `shoot` (Motiv/Termin) oder `frame` (Einzelbild).
  - `collection` ist die Heimat-Collection.
  - Jedes Bild hat eine `id` und wird überall als `"<eintrag>/<bild>"` angesprochen, z. B. `"iceland-2025/03"`.
- **`regions`:** die Gliederung der Karte.

### Am einfachsten: mit Claude

1. Exporte in voller Auflösung **mit Metadaten** (JPEG, TIFF, PNG, HEIC oder WebP) nach **`images/_eingang/`** legen. Aus Lightroom also nicht „Metadaten entfernen“: Die Aufnahmedaten (Kamera, Objektiv, Blende …) werden übernommen, GPS wird beim Umwandeln entfernt.
2. Benennung: Am einfachsten **`<eintrag-id>_<nummer>`**, z. B. `faroe-2024_1.jpg`, `faroe-2024_2.jpg` … Dann weiß Claude ohne Rückfrage, welcher Eintrag und welche Reihenfolge. **Nummer 1 ist immer das Titelbild.**
3. Claude Code im Projektordner öffnen und sagen: **„Bilder einpflegen“**.
4. Claude sieht sich die Bilder an und schlägt Eintrag (per GPS und Aufnahmedatum), Titel, Alt-Text und Tags vor. Fehlende Aufnahmedaten fragt Claude nach, statt sie zu schätzen. Bei analogen Bildern sind das Kamera, Objektiv und Film. Du bestätigst oder änderst.
5. Claude wandelt um (`images/<eintrag>/<eintrag>-NN.webp` + `-1200.webp`, ohne Metadaten), trägt alles in `albums.json` ein und prüft das Ergebnis. Die Originale landen in `images/_eingang/erledigt/`. Dieser Ordner wird nicht hochgeladen, aber **bitte nicht leeren**: Er ist die Quelle, falls Aufnahmedaten später neu ausgelesen werden sollen.

Der Skill steht in `.claude/skills/bilder-einpflegen/SKILL.md`, das Werkzeug dahinter in `tools/images.mjs`. Einmalig vorher: `cd tools && npm install`.

### Ohne Claude: im Terminal

```bash
node tools/images.mjs import
```

Das Werkzeug geht alle Bilder im Eingang einzeln durch.

1. Es schlägt den Eintrag vor. **Enter** übernimmt den Vorschlag in [Klammern], `x` überspringt ein Bild.
2. Es zeigt die Aufnahmedaten aus der Datei und fragt nur nach, was fehlt. Enter lässt einen Wert leer, er wird dann nicht angezeigt.
3. Es fragt nach Titel, Alt-Text (was ist zu sehen? für Screenreader) und Tags, z. B. `wildlife` oder `analog`.
4. Es fragt einmal pro Eintrag, ob noch vorhandene Demo-Bilder weg sollen.
5. Es wandelt um, trägt ein und speichert nach jedem Bild.
6. Zum Schluss bietet es an, den Zeitraum des Eintrags aus den Aufnahmedaten zu übernehmen.

Neue Einträge legt `import` nicht an. Dafür den Eintrag erst anlegen (Abschnitt 3) oder Claude fragen.

Weitere Befehle:

```bash
node --no-warnings tools/images.mjs check                           # albums.json gegen die Dateien prüfen (auch: keine Metadaten in den Web-Fassungen)
node --no-warnings tools/images.mjs backfill --entry lofoten-2024   # Aufnahmedaten aus den Originalen in _eingang/erledigt/ nachtragen
```

### Aufnahmedaten von Hand

Sie stehen am Bild unter `"exif"`. Fehlende Werte bleiben `null` und werden in der Großansicht einfach weggelassen.

```json
"exif": { "camera": "Sony α7R III", "lens": "24-70mm F2.8 DG DN Art 019", "focal": 35, "aperture": 8, "shutter": "1/250", "iso": 100, "film": null, "source": "file" }
```

- `source` sagt, woher die Werte stammen: `"file"` (aus der Datei), `"manual"` (von dir eingetragen) oder `"mixed"`.
- Analoge Bilder: Kamera, Objektiv und Film eintragen, dazu das Tag `"tags": ["analog"]`.
- Neue Kamera? Die Datei enthält oft nur einen Modellcode (z. B. `ILCE-7M4`). Den Namen ergänzt du einmal in `tools/lib/exif.mjs` unter `CAMERA_NAMES`.

### Ein Bild in eine zweite Collection

Ein Bild bleibt in seinem Eintrag und erscheint zusätzlich in einer anderen Collection, wenn es dort ein Tag bekommt. Beispiel: der Papageientaucher auf dem Island-Trip.

```json
{ "id": "03", "file": "iceland-2025-03.webp", …, "tags": ["wildlife"] }
```

Soll der **ganze Eintrag** zusätzlich in einer Collection als Kachel erscheinen, gehört `"alsoIn": ["wildlife"]` an den Eintrag.

### Startseite: Hero-Favoriten

Der Hero zeigt pro Collection ein Bild aus ihren `heroFavorites` und wechselt jede Stunde der Reihe nach durch:

```json
"heroFavorites": [
  { "image": "seiser-alm-2024/01", "focus": [50, 40] },
  { "image": "seoul-2026/04", "focus": [50, 30], "focusMobile": [60, 50] }
]
```

`focus` ist der Punkt (x %, y %), der beim Beschneiden sichtbar bleibt. `focusMobile` gilt auf dem Handy; das ist wichtig bei Hochformaten. Collections ohne Favoriten fehlen im Hero.

### Von Hand exportieren (ohne Werkzeug)

Pro Bild **zwei Dateien** mit demselben Namen, die kleine mit dem Zusatz `-1200`:

| Fassung | Größe | Dateiname (Beispiel) |
|---|---|---|
| groß | lange Kante **2400 px** | `faroe-2024-06.webp` |
| klein | **Breite 1200 px** | `faroe-2024-06-1200.webp` |

- Format **WebP**, Qualität ca. 80, Farbraum sRGB.
- Hier **Metadaten entfernen** (GPS!). Die Aufnahmedaten dann von Hand unter `"exif"` eintragen.
- Beide Dateien nach `images/<eintrag-id>/` legen.
- Das Bild in `"images"` eintragen: `id`, `file` (große Datei), `width` und `height` (Maße der großen Datei), `title`, `alt`. Eine eventuelle Zeile mit `"demo"` löschen.

---

## 3. Neuen Eintrag anlegen

Jede Reise und jeder Termin ist ein eigener Eintrag, auch wenn du zweimal am selben Ort warst (z. B. `iceland-2021` und `iceland-2025`). In `data/albums.json` einen bestehenden Eintrag kopieren und anpassen:

| Feld | Bedeutung |
|---|---|
| `id` | Ort/Thema + Jahr, Kleinbuchstaben, Bindestriche, keine Umlaute, z. B. `bergen-2026`. Zugleich Ordnername in `images/` und Adresse `entry.html?id=<id>` |
| `kind` | `trip` (Ort im Mittelpunkt), `shoot` (Motiv, Person, Thema – ein Termin) oder `frame` (einzelnes Bild) |
| `name` | Name ohne Jahr, z. B. „Dolomiten · Cortina d'Ampezzo“. Das Jahr wird automatisch dazugeschrieben. |
| `shortName` | kurze Form für Karte und Navigation |
| `collection` | Heimat-Collection, z. B. `landscape` |
| `alsoIn` | optional: weitere Collections für den ganzen Eintrag |
| `year` | Jahr, z. B. `2026` (ohne Anführungszeichen); unbekannt: `null` |
| `date` oder `dateStart` + `dateEnd` | optional: `"2023-10-31"`, `"2023-03"` bzw. Zeitraum. Anzeige z. B. „Aug 2024 · 12 Tage“ |
| `country` | Land (wird in „Länder“ gezählt) |
| `region`, `coords` | nur für Einträge auf der Karte (Trips). `region` = innerste Region aus `"regions"`, z. B. `dolomites`. `coords`: `lat` (Nord positiv) und `lon` (Ost positiv, West negativ). Shoots und Frames: `"coords": null`, ohne `region`. |
| `text` | kurzer Text (Platzhalter erlaubt) |
| `cover`, `images` | Titelbild (Nummer in der Bildliste, ab 0) und Bilder, siehe Abschnitt 2 |

1. **Koordinaten finden:** Google Maps → Rechtsklick auf den Ort → die erste Zahl ist `lat`, die zweite `lon`. Liegen zwei Einträge genau aufeinander, fächert die Karte sie automatisch auf.
2. **Neue Region:** oben unter `"regions"` ergänzen. `"parent"` ist die übergeordnete Region; ein Kontinent hat kein `parent`. Beispiel:
   ```json
   "north-america": { "name": "Nordamerika" },
   "rockies":       { "name": "Rocky Mountains", "parent": "north-america" }
   ```
   Mehrere Einträge in derselben Region werden auf der Karte zum Cluster. Ist genug Platz, teilt sich ein Cluster von selbst auf.
3. **Reihenfolge:** neueste Einträge zuerst. Die Reihenfolge bestimmt „Voriger/Nächster“ innerhalb der Collection. Auf der Startseite („Zuletzt“) zählt das Datum.
4. Ordner `images/<id>/` anlegen und Bilder wie in Abschnitt 2 einfügen.

Optional: zusätzliche Kartenbeschriftungen (Länder, Meere) stehen in `tools/build-map.mjs` unter `LABELS`. Danach einmal `cd tools && npm install && npm run build-map`.

### Wenn nach einer Änderung nichts mehr lädt

Meist ist es ein Tippfehler im JSON (fehlendes Komma, Anführungszeichen, Komma nach dem letzten Eintrag). In VS Code wird die Stelle rot markiert. Danach hilft `node --no-warnings tools/images.mjs check`.

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
- [ ] Dann: `<link rel="preconnect" href="https://fastly.picsum.photos">` aus `index.html`, `entry.html`, `collection.html` und `collections.html` löschen und im Datenschutz den Abschnitt „Demo-Bilder“ entfernen
- [ ] Pro Collection entscheiden, ob sie sichtbar bleibt (`"published"` in `albums.json`, Richtwert: 2–3 Einträge oder ca. 10 starke Bilder)
- [ ] Hero-Favoriten pro Collection festlegen (`heroFavorites`, mit Fokuspunkt)
- [ ] Texte: Einträge und Collections in `albums.json`, Intro und Ort auf der Startseite (`index.html`)
- [x] LinkedIn-Link in allen HTML-Dateien (15.10.2026: linkedin.com/in/nicolas-novotny)
- [ ] Porträt und Texte in `ueber-mich.html`
- [x] Impressum und Datenschutz ausgefüllt (15.10.2026) – bei Änderungen anpassen (z. B. Verkauf von Fotos → ggf. Steuerangaben ins Impressum, neue externe Dienste → Datenschutz)
