---
name: bilder-einpflegen
description: Neue Fotos ins Portfolio einpflegen – Bilder aus images/_eingang/ (oder genannten Dateien) ansehen, Album, Titel und Alt-Text vorschlagen und von Nici bestätigen lassen, in WebP umwandeln (2400 px groß + 1200 px breit), in data/albums.json eintragen, bei Bedarf Demo-Bilder ersetzen oder einen neuen Ort anlegen, zum Schluss alles prüfen. Verwende diesen Skill immer, wenn Nici Bilder hinzufügen, hochladen, einpflegen, austauschen oder Demo-Bilder ersetzen will, ein neues Album oder einen neuen Ort mit Fotos anlegen möchte oder sagt, dass neue Exporte im Eingangsordner liegen – auch wenn er den Skill nicht beim Namen nennt.
---

# Bilder einpflegen

Nici legt Exporte (JPEG, TIFF, PNG, HEIC, WebP – beliebig groß) in `images/_eingang/`. Dieser Skill macht daraus fertige Album-Bilder: Vorschläge machen, bestätigen lassen, umwandeln, eintragen, prüfen.

Die Bilder sind der Star der Seite und Nici ist der Fotograf – deshalb schlägst du vor und er entscheidet. Frag gebündelt (eine Übersicht für alle Bilder statt einzelner Fragen pro Feld), damit das Einpflegen von zehn Bildern nicht zwanzig Rückfragen braucht.

Alle Befehle laufen im Projektordner (Repo-Wurzel). Kommuniziere auf Deutsch.

## Werkzeug

`tools/images.mjs` erledigt alles Mechanische und gibt JSON aus:

| Befehl | Zweck |
|---|---|
| `node --no-warnings tools/images.mjs inspect [dateien…]` | Ohne Dateien: alle Bilder im Eingangsordner. Liefert Maße, Hoch/Quer, Aufnahmedatum, Kamera, GPS, die zwei nächstgelegenen Alben (km), Pfad zu einer Vorschau-JPEG und Warnungen (z. B. zu klein). |
| `node --no-warnings tools/images.mjs convert --album <id> <dateien…>` | Erzeugt `images/<id>/<id>-NN.webp` (lange Kante 2400) und `<id>-NN-1200.webp` (1200 breit), dreht nach EXIF, sRGB, entfernt Metadaten inkl. GPS. Nummer = nächste freie. Verschiebt Originale aus dem Eingangsordner nach `_eingang/erledigt/`. Gibt pro Bild `entry` mit `file`, `width`, `height` zurück. |
| `node --no-warnings tools/images.mjs check` | Prüft `albums.json` gegen die Dateien: fehlende Dateien, falsche Maße, Cover, Regionen, nicht eingetragene Dateien. |

Fehlt `tools/node_modules`, einmal `cd tools && npm install` ausführen.

## Ablauf

### 1. Bestandsaufnahme

1. `inspect` ausführen. Sind keine Bilder da, Nici sagen, dass er die Exporte nach `images/_eingang/` legen soll, und aufhören.
2. `data/albums.json` lesen (Orte, Regionen, welche Alben noch `"demo"`-Bilder haben).
3. Jede Vorschau (`preview`) mit dem Read-Werkzeug ansehen. Ohne Hinsehen gibt es keine guten Alt-Texte.

### 2. Vorschläge machen

Pro Bild:

- **Album:** Liegt ein Album laut `nearestAlbums` näher als etwa 150 km, ist es der Vorschlag. Ohne GPS nach Bildinhalt und Dateinamen schätzen und das kenntlich machen („geschätzt“). Passt kein Album: neuen Ort vorschlagen (Schritt 4).
- **Titel:** kurz, deutsch, 2–5 Wörter, ohne Punkt, im Ton der bestehenden Titel („Brandung an den Felsnadeln“, „Nebel über der Weide“). Er steht unter dem Bild und in der Großansicht.
- **Alt-Text:** ein sachlicher Satz (ca. 8–16 Wörter), der beschreibt, was zu sehen ist – Motiv, Licht, Stimmung, wichtige Formen. Kein „Bild von“ oder „Foto von“. Er ersetzt das Bild für Menschen, die es nicht sehen, und hilft Suchmaschinen.
- **Reihenfolge** im Album: Vorschlag nach Aufnahmedatum oder Bildwirkung.

Zeig alles in **einer** Tabelle (Nr., Datei, Hoch/Quer, Album, Titel, Alt-Text) und nenne Warnungen aus `inspect` (z. B. „nur 1800 px – wird nicht vergrößert“). Frag dann gebündelt mit AskUserQuestion:

- Passen die Vorschläge? (Optionen: „Alles passt“ / „Ich ändere etwas“ – Änderungen kommen dann als Freitext)
- Für jedes betroffene Album, das noch Demo-Bilder hat: **Demo-Bilder ersetzen oder vorerst behalten?** Nici hat festgelegt, dass das jedes Mal gefragt wird.
- **Jahr:** Passt das Aufnahmedatum nicht zum `year` des vorgeschlagenen Albums, darauf hinweisen – vermutlich gehört das Bild zu einer anderen Reise (eigenes Album). Hat ein Album `"year": null`, das Jahr aus den Aufnahmedaten vorschlagen.
- **Titelbild** (`cover`), wenn sich etwas ändert: Das Titelbild erscheint in der Albenübersicht, in der Kartenvorschau und – falls das Album in `"featured"` steht – auf der Startseite. Werden Demo-Bilder ersetzt, muss ein neues Titelbild gewählt werden – schlag das stärkste Querformat vor.

Erst weitermachen, wenn Nici bestätigt hat.

### 3. Umwandeln und eintragen

Für jedes Album nacheinander:

1. **Demo-Bilder ersetzen** (falls gewählt): die Einträge mit `"demo"` aus `"images"` dieses Albums löschen, **bevor** du umwandelst – dann beginnt die Nummerierung wieder bei `-01`.
2. `convert --album <id>` mit den Dateien in der bestätigten Reihenfolge.
3. Für jedes Ergebnis eine Zeile in `"images"` einfügen – Maße immer aus `entry` von `convert` (die Datei wurde verkleinert, die Werte aus `inspect` stimmen nicht mehr). Format wie die bestehenden Zeilen, ein Bild pro Zeile:

   ```json
   { "file": "faroe-01.webp", "width": 2400, "height": 1600, "title": "Brandung an den Felsnadeln", "alt": "Felsnadeln in der Brandung vor einer dunklen Steilküste" },
   ```

   Kein `"demo"`-Feld bei eigenen Bildern. Kommas zwischen Einträgen, keins nach dem letzten.
4. `"cover"` setzen (Index in `"images"`, ab 0 gezählt).

Bearbeite `albums.json` mit gezielten Änderungen, nicht durch Neuschreiben der ganzen Datei – die übersichtliche Formatierung (ein Bild pro Zeile, ausgerichtete Regionen) soll erhalten bleiben.

### 4. Neue Reise (neues Album)

Jede Reise ist ein eigenes Album, auch bei wiederholten Reisen an denselben Ort (Nici will Jahre nicht mischen). Wenn Bilder zu keinem Album passen – oder zu einem Ort, aber aus einem anderen Jahr – mit Nici diese Felder klären (Vorschläge machen, wo möglich):

| Feld | Vorschlag |
|---|---|
| `id` | Ort + Jahr: Kleinbuchstaben, Bindestriche, keine Umlaute (`isle-of-skye-2026`) |
| `year` | Jahr der Reise aus dem Aufnahmedatum (`inspect` → `date`); unbekannt: `null` |
| `name`, `shortName` | voller und kurzer Name (Karte, Navigation) |
| `country` | Land |
| `region` | innerste passende Region aus `"regions"`; sonst neue Region anlegen (`{ "name": …, "parent": <übergeordnete Region> }`, ein Kontinent hat kein `parent`). Mehrere Alben einer Region werden auf der Karte zum Cluster. |
| `coords` | Mittelwert der GPS-Daten der Bilder, auf 2 Nachkommastellen; ohne GPS nachfragen. Gibt es schon ein Album derselben Gegend aus einem anderen Jahr, die Punkte möglichst an die tatsächlichen, unterschiedlichen Orte legen. |
| `text` | 1–2 kurze Sätze im Stil der anderen Ortstexte – Entwurf anbieten, Nici formuliert ggf. selbst |
| Position | nach Jahr einsortieren (neueste zuerst) – die Reihenfolge bestimmt Album-Nummer und „Nächster Ort“. Die Startseite zeigt nur die Alben in `"featured"`; fragen, ob das neue Album dazukommen soll. |

Den neuen Block im Stil der bestehenden einfügen und die Bilder dann wie in Schritt 3 umwandeln und eintragen.

### 5. Prüfen und abschließen

1. `check` ausführen. Fehler beheben; Warnungen erklären (z. B. „noch Demo-Bilder neben eigenen“ ist in Ordnung, wenn Nici sie behalten wollte).
2. Kurz berichten: welche Bilder in welchem Album unter welchem Dateinamen, Titelbild, ob Demo-Bilder ersetzt wurden.
3. Sagen, wie Nici es ansieht: `npx serve .` → `http://localhost:3000/album.html?ort=<id>` (bei neuem Titelbild auch die Startseite).
4. Erinnern: In GitHub Desktop committen und pushen, dann ist es nach etwa einer Minute online. Selbst nur committen, wenn Nici darum bittet.
5. Hat danach **kein** Album mehr Demo-Bilder: auf die Checkliste in `docs/Anleitung.md` (Abschnitt 5) hinweisen – picsum-`preconnect` in `index.html` und `album.html` und den Datenschutz-Abschnitt „Demo-Bilder“ entfernen. Anbieten, das direkt zu erledigen.

## Gut zu wissen

- Originale außerhalb von `images/_eingang/` werden nur gelesen, nie verschoben oder verändert.
- GPS steht nur in den Originalen; die Web-Fassungen enthalten keine Metadaten. Das ist Absicht (Privatsphäre, kleinere Dateien).
- HEIC liest das Werkzeug am Mac über das Systemprogramm `sips`; am Windows-PC Nici bitten, als JPEG zu exportieren.
- Ist ein Bild kleiner als 2400 px, wird es nicht hochgerechnet – Nici darauf hinweisen, falls ein größerer Export möglich ist.
- Ein Bild aus einem Album entfernen: Zeile in `albums.json` löschen, beide Dateien in `images/<id>/` löschen (nach Rückfrage), `cover` prüfen, dann `check`.
