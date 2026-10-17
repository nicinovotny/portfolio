# Entscheidungen – Fotografie-Portfolio

Festlegungen hier haben Vorrang vor dem Projektbriefing.

## Designrichtung (14.10.2026)
- Richtung A „Höhenlinie“: dunkel, präzise, Instrumenten-Ästhetik, Bilder bleiben der Star.
- **Startseite** nach der verfeinerten Fassung A2 (`docs/mockups/startseite-A2.dc.html`): Titel in Geist 200 (groß, eng gesetzt), gesperrter Name in Versalien, Haarlinien (0,75 px), Link mit Haarlinie statt gerahmtem Button, große Ziffer + eine feine Fortschrittslinie, kein Kamera-Readout.
- **Karte** nach dem ursprünglichen A (`docs/mockups/karte-A.dc.html`): ~~Fadenkreuz-Marker~~ (ersetzt am 15.10.2026 durch Höhenlinien-Marker, siehe unten), Labels in Geist Mono mit Koordinaten, Cluster als gestrichelter Ring, Gradnetz mit Gradangaben, Zoom-/Kamera-Readout oben rechts, Weltübersicht unten links, „Weltansicht“-Button oben links.
- Farben und Schriftschnitte durchgehend aus A2, damit Startseite und Karte einheitlich wirken.
- **Keine Glas-Navigation.** Schlichte Leiste: Name links, ~~Karte · Alben · Über mich~~ **Collections · Karte · Über mich** (seit 17.10.2026) + Instagram/LinkedIn rechts; auf allen Seiten gleich.

## Farben
- Grund `#0B0D0E`, Land `#14181B`–`#161B1F`, Küstenlinie `#353E44`–`#3C474E`
- Text `#ECE8E1`, Sekundärtext `#8C9397`, leise Labels `#5E666B`
- Akzent Gletscher `#A9C4C4`, nur für aktive Zustände und Markierungen

## Schriften
- Geist (200–400) für Titel, Navigation und Fließtext
- Geist Mono für Koordinaten, Labels, Readouts
- Beide selbst gehostet (keine Google Fonts)

## Karte
- Basis: Natural Earth (npm-Paket `world-atlas`), Welt 110m für Übersicht, 50m für Zoom-Ausschnitte; Färöer in voller Auflösung
- Projektion: Natural Earth 1, Zoom über animierte viewBox
- Stufen: Welt → Kontinent (z. B. Europa) → Region (z. B. Alpen-Cluster)
- Umsetzung (14.10.2026): `tools/build-map.mjs` erzeugt `data/map/world.json` (110m, ca. 60 KB) und `data/map/detail.json` (50m + Grenzen + Beschriftungen, ca. 117 KB gzip, wird erst nach dem Laden nachgeholt). Gradnetz wird im Browser berechnet. Weltbreite 2000 Kartenkoordinaten.
- Zoomstufen kommen aus `albums.json`: Feld `continent` und `region` je Album, Namen unter `regions`. Mehrere Alben in einer Gruppe → Cluster, eines → einzelner Marker. Album-Ansicht (`karte.html?ort=<id>`) zentriert den Ort mit mind. 36° Umgebung, Region mind. 15°, Kontinent mind. 55°.
- Kamerafahrt: Zoom logarithmisch, weite Wege (z. B. Alpen → Korea) fliegen über eine Zwischenansicht. Rauszoomen: Weltansicht-Button, Brotkrumen, Esc, Klick auf freie Fläche, Mausrad nach unten, Pinch. Reinzoomen: Klick/Tipp auf Cluster, Mausrad nach oben über einem Cluster, Pinch auf.
- Handy: Album-Vorschau als flache Leiste am unteren Rand; erster Tipp auf einen Marker zeigt die Vorschau, zweiter öffnet das Album.
- Kartendaten werden einmalig vorab per Node-Skript (`tools/`) zu schlanken SVG-Pfaden/JSON umgerechnet und im Repo abgelegt; die Seite selbst braucht keinen Build-Schritt (bestätigt 14.10.2026, Vorlage: `docs/mockups/kartendaten-generator.mjs`)

## Alben = Reisen (15.10.2026)
- **Ein Album pro Reise**, auch bei mehreren Reisen an denselben Ort (Nici will Bilder verschiedener Jahre nicht mischen). ID-Schema `<ort>-<jahr>` (z. B. `iceland-2021`), Feld `"year"` (Zahl oder `null`). Mehrere Reisen in dieselbe Gegend an verschiedene Punkte legen (Island 2021 Reykjavík, Island 2025 Höfn); liegen Alben genau aufeinander (Seoul 2025/2026), fächert die Karte sie auf.
- **Reihenfolge** in `albums.json`: neueste Reise zuerst. Bestimmt Album-Nummern und „Voriger/Nächster Ort“.
- **Startseite** zeigt nur die Favoriten aus `"featured"` (derzeit 5: Seoul 2026, Island 2025, Dolomiten · Seiser Alm 2024, Lofoten 2024, Sächsische Schweiz 2025), in dieser Reihenfolge; die Album-Nummer im Label bleibt die aus der Gesamtliste.
- **Jahr** steht in allen Mono-Labels (`ALBUM 01 — 2026 — 37°34′N …`), im Seitentitel, im Steckbrief der Albumseite, in Kartenmarker und Kartenvorschau.
- **Alben-Übersicht** (`alben.html`, „Alle Reisen“) gruppiert nach Jahr, großes Jahr in Geist 200 über einer Haarlinie; Alben ohne Jahr am Ende.
- **Regionen** verschachtelt über `"parent"` (ohne `parent` = Kontinent); Alben nennen nur ihre innerste Region (`"region"`), `"continent"` und `"level"` entfallen.
- **Gliederung der Karte** (15.10.2026, nach Nicis Rückmeldung „Alpenraum überladen“): Europa → **Nordeuropa** (Island 2 · Norwegen 2 · Färöer · Schottland) und **Mitteleuropa** (Deutschland 3 · Schweiz 2 · Dolomiten 2 · Österreich · Bukarest einzeln), Gran Canaria einzeln (Kanaren), Asien → Südkorea. Unterhalb der Großregionen wird nach Ländern gegliedert.
- **Startansicht = Reisegebiete:** Die Karte startet auf dem Ausschnitt aller Alben (Gran Canaria/Island bis Korea), nicht auf der ganzen Welt. Ganze Welt per Esc/Rausscrollen (`?gebiet=welt`), Knopf dort „Reisegebiete“.
- **Automatisches Aufteilen:** Ein Cluster zeigt sich als seine Unterregionen bzw. Alben, solange sich dabei keine Marker samt Beschriftung überschneiden (geschätzte Flächen in `js/map-views.js`, `MARKER`). Große Bildschirme sehen daher direkt Nordeuropa/Mitteleuropa, das Handy zunächst „Europa“. Neu berechnet bei jedem Ebenenwechsel und bei Größenänderung.
- Mindestausschnitt nach Tiefe 55° / 25° / 8°, Album 36°. Rauszoomen überspringt Ebenen ohne Unterschied und Kontinente (Nordeuropa → Startansicht). Längengrade am oberen Rand nur, wenn die Karte oben angeschnitten ist. Cluster-Untertitel: bis 3 Alben die Namen, sonst „N Alben · 2021–2026“.
- Startorte 15.10.2026: 18 Reisen – 2026 Seoul, Bergen, Berner Oberland · 2025 Island (Höfn), Seoul, Zermatt, Cortina, Sächsische Schweiz, Bukarest · 2024 Lofoten, Färöer, Schottland (vorläufig Glencoe), Seiser Alm, Gran Canaria · 2023 Schwarzwald, Neuschwanstein · 2021 Island (Reykjavík) · ohne Jahr Kleinarl (Ski). Gliederung siehe „Gliederung der Karte“.

## Marker, Lesbarkeit (15.10.2026)
- **Kartenmarker als Höhenlinien** statt Fadenkreuz (Nici: „zu militärisch, zu taktisch“): Punkt mit zwei leicht unregelmäßigen Konturringen, Form je Album fest (aus der ID berechnet). Aktiv: Ringe weiten sich, dritter Ring erscheint, einmalige Welle in Gletscherfarbe. Cluster = „Gipfel“: dunkle Fläche mit bis zu drei inneren Linien und Anzahl. Passt zur Designrichtung „Höhenlinie“ und zu den Linien im Hero.
- **Lesbarkeit über hellen Bildern:** Kopfzeile in Geist 400 mit weichem Textschatten. Hero-Verläufe oben und unten passen sich der Bildhelligkeit an: `js/home.js` misst beim Bildwechsel die Helligkeit oben/unten (kleines Canvas) und setzt `--scrim-top` / `--scrim-bottom` (0–1), die per `@property` weich überblenden. Dafür werden Hero-Bilder mit `crossorigin="anonymous"` geladen (picsum erlaubt das, eigene Bilder liegen auf derselben Domain). Zähler, Demo-Label und Pause in Sekundärtextfarbe statt leiser Labelfarbe.
- Kartenvorschau: Meta-Zeile nur noch Jahr + Koordinaten (Album-Nummer brach die Zeile um).
- Neue Alben: Stockholm 2021 (Nordeuropa), Algarve 2020 (neue Region Südeuropa, zusammen mit Gran Canaria). Damit 20 Reisen.

## Album-Bühne und Übergang ins Album (15.10.2026)
- **Album-Bühne:** Die Albumseite öffnet mit dem Titelbild über die ganze Fläche (sticky), unten links Label und Titel in Geist 200 wie auf der Startseite, unten Mitte „NN Bilder“ mit laufender Linie (springt zur Galerie). Beim Scrollen zoomt das Bild leicht (1 → 1,08), dunkelt ab und der Titel verschwindet (GSAP ScrollTrigger, `js/album.js`); der Inhalt (`.album-body`, eigener Hintergrund, Schatten nach oben) schiebt sich darüber. Verläufe passen sich wie im Hero der Bildhelligkeit an (`js/scrim.js`, gemeinsam mit der Startseite).
- **Einleitung** unter der Bühne: Ortstext groß links, Steckbrief + Links rechts.
- ~~Galerie deckt sich auf~~ – am 15.10.2026 wieder entfernt (Nici: gefällt nicht, unnötige Last). Galeriebilder blenden nur beim Laden weich ein.
- **Bild fliegt ins Album:** Cross-Document View Transitions. `js/transitions.js` gibt beim Klick auf einen Album-Link dem zugehörigen Bild den Namen `album-cover` (Startseite: aktuelles Hero-Bild + Titel als `album-title`; Alben-Übersicht: Kartenbild; Karte: Vorschaubild) und legt Bildadresse + Titel im sessionStorage ab. Die Albumseite setzt beides per Inline-Skript sofort, damit Bild und Titel beim Übergang schon da sind, und lädt danach die große Fassung. Altes Bild bleibt während des Flugs sichtbar, neues blendet am Ende ein (0,8 s). Album → Album (voriger/nächster Ort) überblendet Bühne zu Bühne. Firefox und Browser ohne Unterstützung wechseln normal.
- Bilder, die als Übergangsquelle dienen (Hero, Übersicht, Kartenvorschau, Bühne), laden mit `crossorigin="anonymous"`, damit sie aus demselben Cache kommen und ihre Helligkeit messbar ist.

## Qualitätsrunde (15.10.2026)
- **Voriger/Nächster Ort auf der Bühne** (unten rechts, untereinander, je „Name ← 15“ / „Name 17 →“; Handy: Leiste ganz unten). Der Titel lässt rechts 18rem frei. Die Navigation am Seitenende bleibt.
- **Album → Album** überblendet die ganze Bühne (Bild, Verläufe, Beschriftung) in 0,5 s (`album-swap`-Übergangstyp, gesetzt im `pagereveal` der Albumseite). Die Titelbilder der Nachbarn werden im Leerlauf vorgeladen (1200er-Fassung) und per sessionStorage übergeben → kein harter Schnitt.
- **Übergangsname liegt auf der ganzen Bühne** (`.album-stage`), nicht nur auf dem Bild – sonst blitzt das Bild beim Überblenden ohne Verläufe hell auf. Der Titel gleitet nur bei Ankunft von der Startseite (`morphTitle`), sonst blendet er mit der Bühne.
- **Seite ohne Gegenstück** (z. B. Album → Startseite): altes Titelbild blendet in 0,3 s aus statt 0,8 s stehen zu bleiben (`:only-child`-Regeln in `css/base.css`). Ist die Bühne weggescrollt (`.is-covered`), nimmt sie gar nicht am Übergang teil.
- `js/transitions.js` ist jetzt auch auf der Albumseite eingebunden (fehlte, deshalb kam beim Album-Wechsel nichts an).
- **Vorab-Laden beim Überfahren** (Speculation Rules, `eagerness: moderate`) auf allen Seiten: Chrome/Edge bauen die Zielseite schon beim Überfahren eines Links auf. Andere Browser ignorieren es.
- **Leistung:** Nur das sichtbare Hero-Bild bekommt eine eigene Grafikebene (`will-change`), vorher alle fünf in voller Größe. Erstes Hero-Bild blendet weich ein statt aufzupoppen. Albumtitel ohne eigene Einblend-Animation (überschnitt sich mit dem Seitenübergang). Label über Bildern in Geist Mono 500, heller, stärkerer Schatten.
- Gemessen (Chrome, 1440 × 900): Startseite, Albumseite beim Scrollen und alle Kamerafahrten der Karte durchgehend ohne Ruckler (kein Bild über 20 ms).

## Albumseite (15.10.2026)
- Kopf zweispaltig: links Label (Album-Nr. + Koordinaten) und Titel in Geist 200, rechts Kurztext, Steckbrief in Mono (Land · Region · Bilder) und „Zurück zur Karte“ (→ `karte.html?ort=<id>`) / „Alle Alben“
- Galerie als Bildzeilen gleicher Höhe (wie Flickr/Google Fotos): Bilder werden nie beschnitten, Hoch- und Querformate mischen sich. Zeilenumbruch rechnet `js/album.js`, die Breiten verteilt CSS (`flex-grow` = Seitenverhältnis). Unter 560 px ein Bild pro Zeile. Darunter dezent Nummer + Titel.
- Lightbox als natives `<dialog>` (Fokus, Esc, inaktiver Hintergrund vom Browser). Übergang: Bild wächst aus seiner Galerie-Position und fliegt beim Schließen dorthin zurück (FLIP mit GSAP); Blättern als kurze Überblendung mit leichtem Versatz. Bedienung: Pfeiltasten, Wischen, Tipp neben das Bild schließt. Bei reduzierter Bewegung kein Übergang.
- Unten Navigation zum vorigen/nächsten Ort in der Reihenfolge von `albums.json` (mit Umlauf)

## Über mich, Rechtliches, Feinschliff (15.10.2026)
- Über mich als Steckbrief: Porträt (4:5, Platzhalter mit Höhenlinien) neben Name, Kurztext und Mono-Steckbrief; darunter nummerierte Abschnitte Ausrüstung · Werdegang · Diese Seite. „Unterwegs“ (Orte · Länder · Bilder) wird aus `albums.json` gezählt.
- Impressum und Datenschutz auf einer Seite (`impressum.html`, Anker `#datenschutz`), Footer-Links auf allen Seiten. Texte sind nur ein Gerüst und müssen vor der Veröffentlichung geprüft werden.
- Seitenwechsel: Überblendung per View Transitions (nur bei `prefers-reduced-motion: no-preference`), Kopfzeile bleibt stehen. Browser ohne Unterstützung wechseln ohne Übergang.
- Reduzierte Bewegung: globale CSS-Regel kürzt alle Übergänge; GSAP-Animationen prüfen die Einstellung selbst.
- Favicon: ~~Fadenkreuz-Marker~~ → seit 15.10.2026 Höhenlinien um einen Punkt (`favicon.svg`), passend zu den Kartenmarkern

## Lokaler Server am Mac (15.10.2026)
- `npx serve` scheiterte am Mac, weil im npm-Cache (`~/.npm`) Dateien root gehörten. Am 15.10.2026 mit `sudo chown -R 501:20 ~/.npm` behoben, `npx serve .` läuft jetzt auch am Mac.
- Ausweichlösung ohne npm, falls nötig: `python3 -m http.server 3000` im Projektordner

## Schriften – Quelle (14.10.2026)
- WOFF2-Dateien aus dem offiziellen Repo `vercel/geist-font` (SIL Open Font License), abgelegt in `fonts/`

## Startorte (14.10.2026, ersetzt am 15.10.2026 – siehe „Alben = Reisen“)
- Ursprünglich 7 Orte mit Demo-Bildern: Färöer, Südkorea, Lofoten, Dolomiten, Schweiz, Sächsische Schweiz, Schwarzwald

## Farben – Abgleich
- Die abweichenden Werte im Karten-Mockup (`#0E1113`, `#E6E4DF`, `#9CC3C5`) gelten nicht; überall gilt die Palette oben (aus A2)

## Git und Ablage (15.10.2026)
- Das Projekt liegt im öffentlichen Repo `nicinovotny/portfolio` (Remote `https://github.com/nicinovotny/portfolio.git`). Mac: Klon unter `~/Documents/GitHub/portfolio`, Windows-PC: eigener Klon über GitHub Desktop.
- Mac und PC gleichen sich über GitHub ab (Pull vor der Arbeit, Commit + Push danach), nicht mehr über Google Drive. Der Drive-Ordner `Claude/Portfolio/portfolio-starter` ist nur noch Archiv (Stand 15.10.2026).
- Gepusht wird über GitHub Desktop, dort ist Nici angemeldet. Der SSH-Schlüssel des Macs ist bei GitHub nicht hinterlegt, Pushen aus dem Terminal geht daher derzeit nicht.
- Vorher (14.10.2026): kein Git, weil ein `.git`-Ordner in Drive Sync-Konflikte verursacht hätte. Die alte Sicherung `C:\Users\Nici\portfolio-git-backup\` auf dem PC wird nicht mehr gebraucht.

## Veröffentlichung (15.10.2026)
- GitHub Pages aus dem Branch `main`, Ordner `/` (root).
- Eigene Domain `nicolasnovotny.de` seit 15.10.2026: registriert bei INWX, DNS dort (4 A-Einträge auf GitHub, `www` als CNAME auf `nicinovotny.github.io`, TXT `_github-pages-challenge-nicinovotny` zur Domain-Bestätigung). Datei `CNAME` im Repo nicht löschen, sonst fällt die Domain weg. HTTPS erzwungen.
- `.nojekyll` im Repo: GitHub liefert die Dateien unverändert aus, ohne Jekyll-Verarbeitung.

## Bilder einpflegen (15.10.2026)
- Projekt-Skill `.claude/skills/bilder-einpflegen/` + Werkzeug `tools/images.mjs` (Node, `sharp` + `exif-reader`, nur lokal – die Seite selbst bleibt ohne Build-Schritt).
- Eingangsordner `images/_eingang/` (Inhalt per `.gitignore` ausgeschlossen); verarbeitete Originale nach `_eingang/erledigt/` (seit 17.10.2026 mit Präfix `<eintrag>__`; aufheben, sie sind die Quelle für `backfill`).
- Ausgabe: `<album>-NN.webp` (lange Kante 2400, Qualität 82) und `<album>-NN-1200.webp` (1200 breit, Qualität 75), nach EXIF gedreht, sRGB, ohne Metadaten (auch kein GPS). Nicht hochgerechnet.
- Claude schlägt Album (GPS, unter ca. 150 km), Titel und Alt-Text vor, Nici bestätigt. Demo-Bilder eines Albums: jedes Mal nachfragen, ob ersetzen oder behalten.
- HEIC nur am Mac (über `sips`), am PC als JPEG exportieren.

## Bibliotheken (14.10.2026)
- GSAP 3.12.5 inkl. ScrollTrigger wird **selbst gehostet** (`vendor/gsap/`) statt per CDN – wie die Schriften, damit beim Seitenaufruf keine IP-Adressen an fremde Server gehen. Gilt auch für alle künftigen Bibliotheken.
- Einzige externe Quelle bleibt picsum.photos für die Demo-Bilder; entfällt, sobald alle eigenen Bilder eingefügt sind.

## Links und Zwischenspeicher (15.10.2026)
- Instagram: `@nici.novotny` (https://www.instagram.com/nici.novotny/), nicht `@nicinovotny`.
- LinkedIn: https://www.linkedin.com/in/nicolas-novotny/ (Kopfzeile aller Seiten + Steckbrief „Über mich“).
- GitHub Pages erlaubt Browsern, Dateien 10 Minuten zwischenzuspeichern. Direkt nach einem Push kann ein Browser deshalb neues HTML mit altem CSS/JS mischen (z. B. Albumtitel klebt oben links). Zum Prüfen: `Strg + Shift + R` bzw. in den Chrome-Entwicklertools „Disable cache“. Favicon-Link trägt eine Versionsnummer (`favicon.svg?v=2`), weil Browser Favicons besonders lange halten – bei einem neuen Favicon hochzählen.

## Karte im Hochformat (15.10.2026)
- Handy hochkant: Welt, Startansicht und Regionen füllen die Höhe statt als schmaler Streifen mit 20–30 % Leerraum oben und unten zu erscheinen. Sichtbar bleibt mindestens 35 % (Welt, Startansicht) bzw. 80 % (Regionen) der Ausschnittbreite; Welt und Startansicht richten sich auf den Schwerpunkt der Alben aus (Europa). Album-Ansichten unverändert.
- Karte lässt sich mit einem Finger (bzw. der Maus) verschieben; danach löst das Loslassen keinen Marker-Klick aus. Hinweis auf dem Handy: „Ziehen zum Verschieben · Tippen zum Zoomen“.
- Behoben: Tippen auf freie Fläche zoomte auf Touch-Geräten nicht heraus.

## Umbau zum breiten Portfolio (ab 17.10.2026)
Spezifikation: `docs/Umbau-Spezifikation.md` (Collections, Eintragsarten, Tags, neue Startseite, Lightbox mit Aufnahmedaten). Wo sie früheren Festlegungen widerspricht, gilt (mit Nici abgestimmt 17.10.2026):
- **GSAP bleibt selbst gehostet** (`vendor/gsap/`), nicht per CDN – siehe „Bibliotheken“. Gilt auch für Flip, falls nötig.
- **Höhenlinien-Marker bleiben**, auch im neuen Kartenstreifen der Startseite – kein Fadenkreuz.
- **Import:** kein neues `tools/import.mjs`, sondern `tools/images.mjs` + Skill `bilder-einpflegen` werden erweitert (EXIF bleibt bei `exif-reader`).
- **Commits:** nach jedem Umbau-Schritt, sobald Nici ihn abgenommen hat. Gepusht wird weiter von Nici über GitHub Desktop.
- Bestandsliste: Die Tabelle ergibt 29 Trips und 7 Automotive-Shoots (die Zusammenfassung nennt 30 bzw. 8); maßgeblich ist die Tabelle, bis Nici etwas ergänzt.

### Schritt 1 – Datenmodell (17.10.2026)
- `albums.json` hat jetzt `collections` (Landscape, Automotive, Wildlife, Portrait, Creative; `order`, `published`, `text`, `cover`, `heroFavorites`), `regions` (unverändert) und `entries` statt `albums`. `featured` entfällt.
- Alle bisherigen Alben sind Einträge mit `"kind": "trip"`, `"collection": "landscape"`. Felder `shortName`, `country`, `region` bleiben (Karte, Steckbrief). Jedes Bild hat eine `id` (`"01"` …), Dateinamen bleiben unverändert. Bildreferenz überall `"<entryId>/<imageId>"`.
- Demo-Bilder bleiben im bisherigen Format `"demo": <picsum-ID>` (statt `"demo": true`), weil die ID das Bild festlegt.
- Hero-Favoriten von Landscape = die bisherigen fünf Startseiten-Favoriten (jeweils Titelbild, `focus: [50, 50]`). Die übrigen Collections haben noch keine Favoriten.
- `black-forest-2023` aufgeteilt in `black-forest-autumn-2023` („Schwarzwald · Herbst“, Bühlertal 48,69° N 8,19° O) und `black-forest-summer-2023` („Schwarzwald · Sommer“, Triberg 48,13° N 8,23° O), je zwei der vier Demo-Bilder. Herbst steht als neuere Reise vor Sommer.
- `kleinarl` → `kleinarl-2025` (`year: 2025`, einsortiert am Ende von 2025). `bergen-2026` heißt „Bergen & Hardangerfjord“ (Kurzname auf der Karte weiter „Bergen“).
- **Alte IDs** leiten in `js/data.js` (`LEGACY_IDS`, `canonicalId()`) weiter: `album.html?ort=kleinarl` und `karte.html?ort=black-forest-2023` funktionieren. Die eigenen Weiterleitungsseiten kommen in Schritt 2.
- `js/data.js`: neue Funktionen `getCollections`, `getCollection`, `getEntries`, `getEntry`, `getMapEntries`, `resolveImage`, `imageRef`. Übergangsweise bleiben `getAlbums` (= alle Trips) und `getFeatured` (= Einträge hinter den Landscape-Favoriten), bis die Seiten umgebaut sind.
- Karte zeigt nur Einträge mit `coords` (`getMapEntries`).
- `tools/images.mjs check` prüft das neue Format (kind, collection, alsoIn, Bild-IDs, Tags, Hero-Favoriten, Collection-Cover); `convert --entry <id>` (`--album` geht weiter) liefert die Bild-`id` mit.

### Schritt 2 – Eintragsseite (17.10.2026)
- `album.html` → **`entry.html?id=<id>`** (`js/entry.js`, `css/entry.css`, per `git mv` umgezogen). Klassen und Datenattribute heißen jetzt `entry-…` statt `album-…`, Übergangsnamen `entry-cover` / `entry-title` / `entry-swap`, sessionStorage-Schlüssel `entry-cover`.
- **Ein Template, zwei Layouts** (`data-kind` am `<main>`):
  - `trip`: Bühne + Galerie in Bildzeilen wie bisher.
  - `shoot`: Bühne + **Bildstrecke** (`.strip`): Querformate einzeln, zwei aufeinanderfolgende Hochformate als Paar, ein einzelnes Hochformat mittig. Jede Zeile höchstens 86 % der Fensterhöhe hoch, nie beschnitten, viel Abstand (bis 6,5 rem). Unter 560 px alles untereinander in voller Breite.
- **Kopf:** Label `Trip — Aug 2024 · 12 Tage — 62°00′N …` (Art, Zeitangabe, Koordinaten nur wenn vorhanden). Zeitangabe aus `dateStart`/`dateEnd`, sonst `date` (`"2023-10-31"` oder `"2023-03"`), sonst `year` (`formatWhen` in `js/format.js`). Steckbrief: Zeitraum/Datum/Jahr · Land · Region · Bilder, leere Felder entfallen.
- **Links:** „Auf der Karte zeigen“ nur bei Einträgen mit `coords`; „← Zurück zu <Collection>“ in der Einleitung und unter der Navigation. Bis Schritt 4 führt er auf `alben.html` (`collectionUrl()` in `js/data.js`, dort umstellen).
- **Voriger/Nächster** nur innerhalb der Heimat-Collection (`getCollectionEntries`, ohne Frames), mit Umlauf. Unten „Voriger Trip — 03“ + voller Name mit Jahr, auf der Bühne der Kurzname (`shortName`) mit Jahr.
- **Frames** haben keine Seite: `entry.html?id=<frame>` leitet auf die Collection mit `&bild=<entryId>/<imageId>` (wertet die Collection-Seite in Schritt 4 aus).
- **Alte Adressen:** `album.html` ist jetzt eine kleine Weiterleitung (`?ort=<id>` → `entry.html?id=<id>`, ohne JavaScript zur Übersicht). Alte ids ersetzt `entry.html` in der Adresszeile durch die neuen (`history.replaceState`). In Schritt 5 das Ziel ohne id von `alben.html` auf `collections.html` umstellen.
- Karte: Texte „Album/Alben“ → „Trip/Trips“, Vorschau-Link „Ansehen →“; Links auf `entry.html` (`entryUrl()`).
- Behoben: Ein einzelnes Hochformat in einer Zeile (Handy-Galerie, Bildstrecke) war nur zwei Drittel so breit wie die Zeile (`flex-grow` unter 1 verteilt nur einen Teil des Platzes) → `.gallery__item:only-child { flex-grow: 1 }`.

### Schritt 3 – Lightbox mit Aufnahmedaten (17.10.2026)
- `js/lightbox.js` erzeugt sein `<dialog>` selbst (kein Markup mehr in den Seiten), Styles in eigener Datei `css/lightbox.css`. Jede Seite mit Großansicht bindet `css/lightbox.css` ein und ruft `createLightbox({ images: [{ entry, image }], thumbs, collections, currentEntryId })` auf. Bilder dürfen aus verschiedenen Einträgen stammen (für die Collection-Seite).
- **Infobereich:** Titel (Geist) · Herkunft `TRIP · SEOUL · 2026 →` (Link zum Eintrag; auf dessen eigener Seite und bei Frames nur Text) · Haarlinie · Aufnahmedaten in Geist Mono, leise Labelfarbe: erste Zeile Kamera · Objektiv (· Film), zweite Zeile Brennweite, Blende, Zeit, ISO · Tag-Chips (Collections verlinkt, Technik-Tags wie „Analog“ nur Text) · „Demo-Bild“ bei Demo-Bildern.
- Nur vorhandene Werte (`formatExif` in `js/format.js`); ohne Daten entfällt der ganze Block. Versalien setzt `monoUpper()`, damit α (Sony α7) und ƒ (Blende) klein bleiben.
- **Ab 64rem Breite:** Infobereich rechts neben dem Bild (17rem), unten bündig, immer sichtbar; rechter Pfeil sitzt zwischen Bild und Infobereich.
- **Schmaler:** Titel unten mittig, Aufnahmedaten per **i-Knopf** (oben neben „Schließen“, Taste „i“) zwischen Bild und Bedienung; das Bild rückt dafür nach oben (`--info-h`). Standard: ausgeblendet; die Wahl bleibt beim Blättern erhalten.
- `aria-modal`, Fokus auf „Schließen“, Rückgabe auf das zuletzt gezeigte Bild, Pfeiltasten, Wischen, Esc wie bisher.
- Getestet mit vorübergehenden Testdaten (Sony mit allen Werten + Tags Wildlife/Analog, Canon AE-1 mit Film, nur ISO, gar nichts) bei 1440 px und 375 px; Testdaten wieder entfernt. Echte Aufnahmedaten kommen mit Schritt 7 (Import).

### Schritt 4 – Collection-Seite (17.10.2026)
- **`collection.html?id=<collection>`** (`js/collection.js`, `css/collection.css`). Unveröffentlichte (`"published": false`) oder unbekannte Collections zeigen „Nicht gefunden“.
- **Kopf:** `01 / 05 — Collection`, Name in Display-Größe (Geist 200), darunter über einer Haarlinie Text links und Readout rechts, z. B. `Landscape · 21 Trips`, `Automotive · 8 Shoots`. Besteht eine Collection nur aus Einzelbildern: `Wildlife · 23 Bilder · aus 6 Einträgen`; mit Einträgen und Frames zusätzlich `· 4 Frames`.
- **Abschnitte** Trips → Shoots (→ Series) → Frames, je mit Haarlinie, Überschrift (Geist 200) und Anzahl; keine Jahresüberschriften. Leere Abschnitte entfallen; ganz leere Collection: „Noch keine Bilder in dieser Collection.“
- **Kacheln** wie bisher in der Alben-Übersicht (Titelbild 3:2, Label `Trip — 2025` bzw. `Shoot — Mai 2026`, Name). Das Bild fliegt beim Klick in die Eintragsseite.
- **Frames** = eigene Frames + Bilder anderer Einträge mit passendem Tag (`getCollectionFrames` in `js/data.js`; gehört der ganze Eintrag schon per `collection`/`alsoIn` dazu, nicht doppelt). Galerie in Bildzeilen ohne Beschnitt; Unterschrift: Titel + `Aus: Island · 2025 →` (Link zum Eintrag) bzw. bei eigenen Frames das Jahr. Klick öffnet die Großansicht über alle Frames; `&bild=<entryId>/<imageId>` öffnet sie beim Laden (Ziel von `entry.html?id=<frame>`).
- **Ende:** `← Alle Collections` (bis Schritt 5 `alben.html`, Konstante `OVERVIEW_URL` in `js/data.js`) und `Nächste Collection — 02 →` mit Name (zyklisch über die veröffentlichten).
- Galerie-Code für Trips und Frames gemeinsam in **`js/gallery.js`** (`createGalleryItem`, `justifyGallery`, `loadGalleryImage`) und **`css/gallery.css`**. „Zurück zu <Collection>“ auf der Eintragsseite führt jetzt auf die Collection-Seite.
- Getestet mit vorübergehenden Testdaten (Wildlife-Tags an Island/Lofoten, Test-Frame in Creative, Test-Shoot in Automotive) bei 1440 und 375 px; Testdaten wieder entfernt.

### Schritt 5 – Collections-Übersicht und Navigation (17.10.2026)
- **`collections.html`** (`js/collections.js`, `css/collections.css`; aus `alben.html` bzw. `js/albums-overview.js` per `git mv`): Kopf „Portfolio — 05 Collections“ / „Collections“, darunter je veröffentlichter Collection eine große Zeile: oben Ziffer · gepunktete Führungslinie · Zähler (`21 Trips`, „Noch leer“), darunter Titelbild (16:10) links und rechts Name in Display-Größe, Text, „Collection öffnen“. Die ganze Zeile ist ein Link; Überfahren/Fokus: Bild zoomt leicht, Ziffer und Zähler in Gletscherfarbe. Handy: Bild über dem Text.
- **Titelbild einer Collection** (`getCollectionCover` in `js/data.js`): `cover` → erster Hero-Favorit → Titelbild des neuesten Eintrags → erstes Einzelbild; ohne Bilder eine leere Fläche.
- Zähler gemeinsam in `formatCollectionCounts` (`js/format.js`), genutzt von Übersicht und Collection-Seite (und später der Startseite).
- **Navigation** auf allen Seiten: Collections · Karte · Über mich. Eintrags- und Collection-Seiten markieren „Collections“ als aktuellen Bereich (`js/nav.js`, `aria-current`).
- **`alben.html`** ist jetzt eine Weiterleitung auf `collections.html`; `album.html` ohne id ebenfalls. Alte Styles der Alben-Übersicht aus `css/base.css` entfernt. „Alle Alben“ heißt überall „Alle Collections“.

### Schritt 6 – Startseite (17.10.2026)
- **Hero:** ein Slot pro veröffentlichter Collection mit Hero-Favoriten, in fester Reihenfolge (Landscape zuerst); Collections ohne Favoriten entfallen (ohne jeden Favoriten: Titelbild der ersten Collection). Pro Slot ein Favorit nach **stündlicher Rotation**: `favorites[(Stunde seit 1970 + hash(collection.id)) % Anzahl]` (`js/home.js`, `pickFavorite`) – innerhalb einer Stunde für alle gleich, nichts wird gespeichert. Leises Label „Auswahl 14:00“ neben Pause.
- **Fokuspunkt:** `focus` bzw. auf dem Handy `focusMobile` aus `heroFavorites` als `object-position`.
- **Bildunterschrift:** Label `Collection — 21 Trips`, Name in Geist 200, „Collection öffnen“ (Haarlinien-Link) und Herkunft in Mono `Aus: Trip · Seoul · 2026 →` (Link zum Eintrag; ist das Bild dessen Titelbild, fliegt es in die Bühne). Zähler `01 / 05`, Fortschrittslinie, Pause, Wischen, Pfeiltasten, Parallax wie bisher; bei nur einem Slot keine Linie und keine Pause. „Auf der Karte zeigen“ entfällt im Hero.
- **Intro:** kleines Porträt (Platzhalter mit Höhenlinien wie auf „Über mich“), Text in Geist 200 (Platzhalter), Readout `[Platzhalter: Ort] · Seit 2020 · 13 Länder · 21 Einträge` – Ort von Hand in `index.html`, Rest aus `albums.json`. Link „Mehr über mich“.
- **Collections-Liste:** Zeilen `01  Landscape ……… 21 Trips` (Name bis 5rem, gepunktete Führungslinie). Mit Maus ab 48rem: Vorschaubild (Titelbild der Collection) folgt dem Zeiger weich, bleibt aber rechts der Bildschirmmitte, damit die Namen frei bleiben; bei Tastaturfokus rechts neben der Zeile. Touch/Handy: Titelbild über jeder Zeile, keine Ziffer.
- **Zuletzt:** drei neueste Trips/Shoots (`getNewestEntries`: spätestes Datum aus `dateEnd`/`dateStart`/`date`/`year`, bei Gleichstand Reihenfolge der Datei) als Kacheln.
- **Kartenstreifen:** einziger Karten-Einstieg der Startseite. Ausschnitt aller Einträge mit Ort (Projektion, Landflächen und Gradnetz 10° wie auf der Karte), Höhenlinien-Marker (zwei Ringe + Punkt), Readout „Karte — 21 Trips“, „Karte öffnen“. Lädt die Kartendaten erst, wenn der Streifen in die Nähe kommt.
- Neu ausgelagert: `js/contours.js` (Marker-Form, von Karte und Startseite genutzt), `js/tiles.js` + Kachel-Styles in `css/base.css` (Collection-Seite und „Zuletzt“). Übergangsfunktionen `getAlbums`/`getFeatured` aus `js/data.js` entfernt; `about.js` zählt jetzt über `getEntries`.
- Getestet bei 1440 und 375 px, Diashow mit vorübergehenden Favoriten in Automotive und Wildlife (wieder entfernt); Rotation rechnerisch geprüft.

### Schritt 7 – Import mit Aufnahmedaten (17.10.2026)
- Kein neues `tools/import.mjs`: `tools/images.mjs` erweitert, aufgeteilt in `tools/lib/exif.mjs` (Aufnahmedaten lesen und aufbereiten) und `tools/lib/albums-file.mjs` (albums.json lesen/schreiben im kompakten Stil; Einlesen + Schreiben ergibt die Datei Zeichen für Zeichen unverändert).
- **Aufnahmedaten** kommen nur aus den Originalen (nie aus den WebP). Am Bild als `"exif": { camera, lens, focal, aperture, shutter, iso, film, source }`, fehlende Werte `null`. `source`: `"file"`, `"manual"` (von Nici) oder `"mixed"`.
  - Kamera-Modellcodes werden über `CAMERA_NAMES` in Namen übersetzt (`ILCE-7RM3` → „Sony α7R III“, `ILCE-7M5` → „Sony α7 V“, `X100VI` → „Fujifilm X100VI“, Nikon D750/D3300). Unbekannte Codes: Hersteller + Modell.
  - Belichtungszeit als Bruch (`"1/160"`, `"5"`).
  - Objektivnamen ohne „|“ (`24-70mm F2.8 DG DN Art 019`).
- **Nie schätzen:** Fehlende Werte fragt der Import bzw. Claude nach. Ohne Antwort bleiben sie `null` und werden nicht angezeigt. Bei Bildern ohne Aufnahmedaten wird gefragt, ob sie analog sind; dann Kamera, Objektiv, Film.
- **Metadaten:** Veröffentlichte WebP enthalten keine (sharp schreibt keine EXIF/XMP/IPTC, auch kein GPS). `check` meldet einen Fehler, falls doch.
- **Befehle:**
  - `import`: interaktiv im Terminal für Nici. Eintrag-Vorschlag aus GPS (< 150 km) und Aufnahmedatum (Zeitraum > Datum > Jahr), fehlende Daten, Titel, Alt-Text, Tags, Demo-Bilder ersetzen, Zeitraum übernehmen. Speichert nach jedem Bild. Neue Einträge legt `import` nicht an.
  - `inspect`: liefert `exif`, `cameraRaw` und `suggestions`.
  - `convert --entry`: gibt das fertige Bild-Objekt inkl. `exif` aus.
  - `backfill`: ordnet Originale aus `_eingang/erledigt/` per Bildvergleich (16×16-Graustufen) den vorhandenen WebP zu und trägt die Aufnahmedaten nach. `--dates` übernimmt den Zeitraum.
  - `check`: prüft zusätzlich Datumsformate, fehlende Aufnahmedaten und Metadaten in den Dateien.
- **Nachgetragen (17.10.2026):** Aufnahmedaten aller 25 eigenen Bilder (Seoul 2026, Island 2025, Sächsische Schweiz 2025, Lofoten 2024, Seiser Alm 2024), alle Zuordnungen eindeutig (Abweichung 1,4–3,4 bei Schwelle 12). Zeiträume **nicht** eingetragen – Vorschläge aus den Aufnahmedaten: Island 26.02.–02.03.2025, Lofoten 10.–15.09.2024, Sächsische Schweiz 19.–21.10.2025, Seiser Alm 20.–24.06.2024, Seoul 21.–25.09.2026.
- Skill `bilder-einpflegen` und `docs/Anleitung.md` aufs neue Datenformat umgeschrieben (Einträge, Collections, Tags, Hero-Favoriten, Aufnahmedaten).

### Vorbereitung Schritt 8 – neue Einträge (17.10.2026, mit Nici geklärt)
- **Kartenpunkt bei Trips mit mehreren Orten: Hauptort.** Sächsische Schweiz & Harz 2020 → Bastei; Allgäu & Zugspitze 2020 → Neuschwanstein/Füssen; Salzkammergut 2020 → Hallstatt. Weitere: Allgäu im Winter 2021 → Bad Hindelang; Eibsee im Winter 2023 → Eibsee; Burg Hohenzollern 2023 → Burg Hohenzollern.
- **Schottland 2019 → Edinburgh.**
- **Shoots ohne Karte** (`"coords": null`, ohne `region`), wie in der Spezifikation.
- **Kleinarl 2025** behält seine Demo-Bilder.
- Noch offen, beim Anlegen kurz nachfragen: Ort für Dolomiten 2020 (Vorschlag: Hauptort der Reise erfragen).
