---
name: bilder-einpflegen
description: Neue Fotos ins Portfolio einpflegen – Bilder aus images/_eingang/ (oder genannten Dateien) ansehen, Eintrag (Trip, Shoot, Frame), Titel, Alt-Text und Tags vorschlagen und von Nici bestätigen lassen, Aufnahmedaten aus den Originalen übernehmen (fehlende erfragen, nie schätzen), in WebP umwandeln (2400 px groß + 1200 px breit, ohne Metadaten), in data/albums.json eintragen, bei Bedarf Demo-Bilder ersetzen oder einen neuen Eintrag anlegen, zum Schluss alles prüfen. Verwende diesen Skill immer, wenn Nici Bilder hinzufügen, hochladen, einpflegen, austauschen oder Demo-Bilder ersetzen will, einen neuen Trip, Shoot oder Frame mit Fotos anlegen möchte, Aufnahmedaten nachtragen will oder sagt, dass neue Exporte im Eingangsordner liegen – auch wenn er den Skill nicht beim Namen nennt.
---

# Bilder einpflegen

Nici legt Exporte (JPEG, TIFF, PNG, HEIC, WebP – beliebig groß, mit Metadaten) in `images/_eingang/`. Dieser Skill macht daraus fertige Bilder: Vorschläge machen, bestätigen lassen, umwandeln, eintragen, prüfen.

Die Bilder sind der Star der Seite und Nici ist der Fotograf – deshalb schlägst du vor und er entscheidet. Frag gebündelt (eine Übersicht für alle Bilder statt einzelner Fragen pro Feld), damit das Einpflegen von zehn Bildern nicht zwanzig Rückfragen braucht.

Alle Befehle laufen im Projektordner (Repo-Wurzel). Kommuniziere auf Deutsch. Spezifikation des Datenmodells: `docs/Umbau-Spezifikation.md` (Abschnitte 4–6 und 12).

## Begriffe

- **Collection** (`collections` in `albums.json`): Landscape, Automotive, Wildlife, Portrait, Creative.
- **Eintrag** (`entries`) mit `kind`:
  - `trip`: Ort steht im Mittelpunkt (auch ein Tagesausflug)
  - `shoot`: Motiv, Person oder Thema, ein Termin
  - `frame`: einzelnes Bild ohne Zusammenhang
  - Entscheidend ist die Absicht, nicht die Dauer.
- **Heimat-Collection** `collection` (Pflicht), dazu optional `alsoIn`: Dort erscheint der ganze Eintrag zusätzlich als Kachel.
- **Tags am Bild** (`tags`):
  - Collection-IDs, z. B. `wildlife`: Das Bild erscheint zusätzlich in dieser Collection.
  - Technik-Tag `analog`: nur ein Chip in der Lightbox.
- **Bildreferenz** überall `"<entryId>/<imageId>"`, z. B. `"iceland-2025/03"`.

## Werkzeug

`tools/images.mjs` erledigt alles Mechanische. Fehlt `tools/node_modules`, einmal `cd tools && npm install` ausführen.

| Befehl | Zweck |
|---|---|
| `node --no-warnings tools/images.mjs inspect [dateien…]` | Ohne Dateien: alle Bilder im Eingangsordner (JSON). Liefert pro Bild: <ul><li>Maße, Hoch/Quer, Aufnahmedatum, GPS</li><li>`cameraRaw` (Modellcode aus der Datei)</li><li>`exif` (fertig für albums.json, fehlende Werte `null`; `null` = keine Aufnahmedaten in der Datei)</li><li>`suggestions` (passende Einträge nach GPS unter 150 km und Aufnahmedatum)</li><li>`preview` (Pfad zu einer Vorschau-JPEG) und Warnungen</li></ul> |
| `node --no-warnings tools/images.mjs convert --entry <id> <dateien…>` | Erzeugt `images/<id>/<id>-NN.webp` (lange Kante 2400) und `<id>-NN-1200.webp` (1200 breit). <ul><li>Dreht nach EXIF und wandelt nach sRGB um.</li><li>**Schreibt keine Metadaten** (auch kein GPS).</li><li>Verschiebt Originale aus dem Eingang nach `_eingang/erledigt/<id>__<datei>`.</li></ul> Gibt pro Bild `image` aus (id, file, width, height, exif – fertig für albums.json) sowie `missingExif` (Felder, die in der Datei fehlen). |
| `node --no-warnings tools/images.mjs backfill --entry <id> [--prefix <p>] [--dates] [--force] [--dry]` | Aufnahmedaten für schon eingepflegte Bilder aus den Originalen in `_eingang/erledigt/<p>__…` nachtragen. <ul><li>Die Zuordnung läuft über einen Bildvergleich (`diff` unter 12 = sicher).</li><li>`--dates` trägt den Zeitraum aus den Aufnahmedaten ein, wenn der Eintrag noch keinen hat.</li><li>Präfix-Standard: Eintrags-ID, sonst ID ohne Jahr.</li></ul> |
| `node --no-warnings tools/images.mjs check` | Prüft `albums.json` gegen die Dateien: Pflichtfelder, IDs, Tags, Hero-Favoriten, Maße. <ul><li>Fehler: veröffentlichte Dateien, die noch Metadaten enthalten.</li><li>Warnung: eigene Bilder ohne Aufnahmedaten.</li></ul> |
| `node tools/images.mjs import` | **Für Nici im Terminal** (interaktiv, ohne Claude): geht den Eingang Bild für Bild durch, fragt Eintrag, fehlende Aufnahmedaten, Titel, Alt-Text und Tags ab und trägt alles selbst ein. Nicht von Claude aufrufen – es wartet auf Tastatureingaben. |

`albums.json` per Skript schreiben? Dann über `tools/lib/albums-file.mjs` (`readAlbumsFile` / `writeAlbumsFile`). Es erhält die kompakte Formatierung: ein Bild pro Zeile, ausgerichtete Regionen. Gezielte Änderungen mit dem Edit-Werkzeug gehen genauso, die Datei aber **nie** mit `JSON.stringify(…, null, 2)` neu schreiben.

## Ablauf

### 1. Bestandsaufnahme

1. `inspect` ausführen. Sind keine Bilder da, Nici sagen, dass er die Exporte nach `images/_eingang/` legen soll, und aufhören.
2. `data/albums.json` lesen: Einträge, Collections, Regionen, welche Einträge noch `"demo"`-Bilder haben.
3. Jede Vorschau (`preview`) mit dem Read-Werkzeug ansehen. Ohne Hinsehen gibt es keine guten Alt-Texte.

### 2. Vorschläge machen

**Dateinamen-Regel (von Nici festgelegt):** Heißen die Exporte `<eintrag-id>_<nummer>.<endung>` (z. B. `faroe-2024_1.jpg`), gilt ohne Rückfrage:
- **Eintrag** = der Teil vor dem Unterstrich (muss es geben, sonst nachfragen).
- **Reihenfolge** = die Nummer.
- **Nummer 1 = Titelbild** (`"cover": 0`): Bühne der Eintragsseite, Kachel, Kartenvorschau.

Ist das Titelbild ein Hochformat, darauf hinweisen (die Bühne ist quer, es wird stark beschnitten).

Pro Bild:

- **Eintrag:**
  - Vorschlag aus `suggestions` (GPS + Datum). Ohne Treffer nach Bildinhalt und Dateinamen einschätzen und das kenntlich machen („geschätzt“).
  - Passt kein Eintrag: neuen vorschlagen (Schritt 4).
  - Beispiel: **Zwei Reisen in dieselbe Gegend** (Schwarzwald Sommer/Herbst 2023) über das Aufnahmedatum trennen. Den Vorschlag begründen („aufgenommen am 14.10.2023 → Herbst“).
- **Titel:** kurz, deutsch, 2–5 Wörter, ohne Punkt, im Ton der bestehenden Titel („Brandung an den Felsnadeln“).
- **Alt-Text:** ein sachlicher Satz (ca. 8–16 Wörter), der beschreibt, was zu sehen ist: Motiv, Licht, Stimmung, wichtige Formen. Kein „Bild von“.
- **Tags:**
  - `wildlife` bei Tieren (z. B. Papageientaucher auf einem Island-Trip).
  - **Wildpark-Bilder** als solche kennzeichnen, z. B. Titel „… im Wolf- und Bärenpark“, nicht als freie Wildbahn ausgeben.
  - `analog` bei Film.
- **Aufnahmedaten** (`exif` aus `inspect`):
  - Kommen aus der Datei und werden übernommen.
  - **Fehlende Werte nie schätzen.** Nennen, was fehlt, und Nici fragen. Was er nicht weiß, bleibt `null` (wird nicht angezeigt).
  - Bei Bildern ohne Aufnahmedaten fragen, ob sie analog sind. Dann nach Kamera, Objektiv und Film fragen.
  - Von Nici genannte Werte bekommen `"source": "manual"`, gemischte `"source": "mixed"`.
  - Unbekannter Kamera-Modellcode (`cameraRaw`, z. B. `ILCE-7M4`): Namen erfragen und in `CAMERA_NAMES` in `tools/lib/exif.mjs` ergänzen.
- **Reihenfolge** im Eintrag: nach Aufnahmedatum oder Bildwirkung.

Zeig alles in **einer** Tabelle: Nr., Datei, Hoch/Quer, Datum, Eintrag, Titel, Alt-Text, Tags, Aufnahmedaten („aus Datei“ / „fehlt: …“). Nenne die Warnungen aus `inspect`. Frag dann gebündelt mit AskUserQuestion:

- Passen die Vorschläge? (Optionen: „Alles passt“ / „Ich ändere etwas“ – Änderungen kommen dann als Freitext.)
- Fehlende Aufnahmedaten bzw. analoge Angaben.
- Für jeden betroffenen Eintrag mit Demo-Bildern: **Demo-Bilder ersetzen oder vorerst behalten?** Nici hat festgelegt, dass das jedes Mal gefragt wird.
- **Jahr/Zeitraum:**
  - Passt das Aufnahmedatum nicht zum `year` des Eintrags, darauf hinweisen. Vermutlich ist es eine andere Reise.
  - Fehlt am Eintrag `dateStart`/`dateEnd` bzw. `date`, den Zeitraum aus den Aufnahmedaten vorschlagen.
- **Titelbild** (`cover`), wenn Demo-Bilder ersetzt werden: das stärkste Querformat vorschlagen.
- **Hero-Favorit?** Besonders starke Bilder anbieten, als Favorit der Startseite in `collections[].heroFavorites` aufgenommen zu werden. Der Fokuspunkt `focus: [x%, y%]` (optional `focusMobile`) bestimmt den Ausschnitt; bei Hochformaten wichtig.

Erst weitermachen, wenn Nici bestätigt hat.

### 3. Umwandeln und eintragen

Für jeden Eintrag nacheinander:

1. **Demo-Bilder ersetzen** (falls gewählt): die Bilder mit `"demo"` aus `"images"` löschen, **bevor** du umwandelst. Dann beginnt die Nummerierung wieder bei `01`.
2. `convert --entry <id>` mit den Dateien in der bestätigten Reihenfolge.
3. Für jedes Ergebnis das `image` aus der Ausgabe übernehmen und Titel, Alt-Text, Tags sowie erfragte Aufnahmedaten ergänzen. Die Maße stammen immer aus `convert`, weil die Datei verkleinert wurde. Format wie die bestehenden Zeilen, ein Bild pro Zeile, Feldreihenfolge `id, file, width, height, title, alt, tags, exif`:

   ```json
   { "id": "03", "file": "iceland-2025-03.webp", "width": 2400, "height": 1600, "title": "Papageientaucher am Dyrhólaey", "alt": "Papageientaucher mit Fisch im Schnabel auf einer grasbewachsenen Klippe", "tags": ["wildlife"], "exif": { "camera": "Sony α7R III", "lens": "FE 100-400mm F4.5-5.6 GM OSS", "focal": 400, "aperture": 5.6, "shutter": "1/1000", "iso": 400, "film": null, "source": "file" } },
   ```

   - Kein `"demo"`-Feld bei eigenen Bildern.
   - Leere optionale Felder (`title`, `tags`) weglassen.
   - Kommas zwischen den Einträgen, keins nach dem letzten.
4. `"cover"` setzen (Index in `"images"`, ab 0 gezählt), ggf. `dateStart`/`dateEnd` (nach `year`) und Hero-Favoriten.

### 4. Neuer Eintrag

Jede Reise bzw. jeder Termin ist ein eigener Eintrag, auch bei wiederholten Reisen an denselben Ort (Nici will Jahre nicht mischen). Felder mit Nici klären, Vorschläge machen, wo möglich:

| Feld | Vorschlag |
|---|---|
| `id` | Ort/Thema + Jahr: Kleinbuchstaben, Bindestriche, keine Umlaute (`isle-of-skye-2026`, `rs660-2026`) |
| `kind` | `trip`, `shoot` oder `frame` (siehe Begriffe) |
| `name`, `shortName` | Name ohne Jahr; `shortName` = kurze Form für Karte und Bühnen-Navigation (bei Trips) |
| `collection`, `alsoIn` | Heimat-Collection; `alsoIn` nur, wenn der ganze Eintrag woanders auch hingehört |
| `year` | aus dem Aufnahmedatum; unbekannt: `null` |
| `date` bzw. `dateStart`/`dateEnd` | aus den Aufnahmedaten (`"2023-10-31"` oder `"2023-03"`), bei Trips Zeitraum |
| `country` | Land (bei Trips; zählt in „Länder“) |
| `region`, `coords` | **nur bei Einträgen auf der Karte** (in der Regel Trips). `region` = innerste passende Region aus `"regions"`, sonst neue Region anlegen (`{ "name": …, "parent": … }`, ein Kontinent hat kein `parent`). `coords` = Mittelwert der GPS-Daten, 2 Nachkommastellen; ohne GPS nachfragen. Shoots und Frames meist `"coords": null` und ohne `region`. |
| `text` | `"[Platzhalter]"` oder ein Entwurf, den Nici bestätigt |
| Position | Einträge stehen neueste zuerst; die Reihenfolge bestimmt „Voriger/Nächster“ innerhalb der Collection |

Den Block im Stil der bestehenden einfügen und die Bilder wie in Schritt 3 umwandeln und eintragen.

### 5. Prüfen und abschließen

1. `check` ausführen. Fehler beheben; Warnungen erklären (z. B. „noch Demo-Bilder neben eigenen“ ist in Ordnung, wenn Nici sie behalten wollte).
2. Kurz berichten: welche Bilder in welchem Eintrag unter welcher Referenz, Titelbild, Tags, Aufnahmedaten (vollständig / was fehlt), ob Demo-Bilder ersetzt wurden.
3. Sagen, wie Nici es ansieht: `npx serve .` → `http://localhost:3000/entry.html?id=<id>`, bei Tags auch `collection.html?id=<tag>`, bei Hero-Favoriten die Startseite.
4. Erinnern: In GitHub Desktop committen und pushen, dann ist es nach etwa einer Minute online. Selbst nur committen, wenn Nici darum bittet.
5. Hat danach **kein** Eintrag mehr Demo-Bilder: auf die Checkliste in `docs/Anleitung.md` (Abschnitt 5) hinweisen und anbieten, das direkt zu erledigen. Zu entfernen sind:
   - der picsum-`preconnect` in `index.html`, `entry.html`, `collection.html` und `collections.html`
   - der Datenschutz-Abschnitt „Demo-Bilder“ in `impressum.html`

## Gut zu wissen

- Originale außerhalb von `images/_eingang/` werden nur gelesen, nie verschoben oder verändert. Verarbeitete Originale liegen in `_eingang/erledigt/` (nicht im Repo) und dienen `backfill` als Quelle.
- GPS und alle anderen Metadaten stehen nur in den Originalen. Die Web-Fassungen enthalten keine (`check` prüft das). Kartenkoordinaten kommen nur aus `albums.json`.
- HEIC liest das Werkzeug am Mac über das Systemprogramm `sips`; am Windows-PC Nici bitten, als JPEG zu exportieren.
- Ist ein Bild kleiner als 2400 px, wird es nicht hochgerechnet. Nici darauf hinweisen, falls ein größerer Export möglich ist.
- Ein Bild entfernen:
  1. Zeile in `albums.json` löschen und beide Dateien in `images/<id>/` löschen (nach Rückfrage).
  2. `cover` und Hero-Favoriten prüfen.
  3. `check` ausführen.
