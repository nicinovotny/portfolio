# Entscheidungen – Fotografie-Portfolio

Festlegungen hier haben Vorrang vor dem Projektbriefing.

## Designrichtung (14.10.2026)
- Richtung A „Höhenlinie“: dunkel, präzise, Instrumenten-Ästhetik, Bilder bleiben der Star.
- **Startseite** nach der verfeinerten Fassung A2 (`docs/mockups/startseite-A2.dc.html`): Titel in Geist 200 (groß, eng gesetzt), gesperrter Name in Versalien, Haarlinien (0,75 px), Link mit Haarlinie statt gerahmtem Button, große Ziffer + eine feine Fortschrittslinie, kein Kamera-Readout.
- **Karte** nach dem ursprünglichen A (`docs/mockups/karte-A.dc.html`): ~~Fadenkreuz-Marker~~ (ersetzt am 15.10.2026 durch Höhenlinien-Marker, siehe unten), Labels in Geist Mono mit Koordinaten, Cluster als gestrichelter Ring, Gradnetz mit Gradangaben, Zoom-/Kamera-Readout oben rechts, Weltübersicht unten links, „Weltansicht“-Button oben links.
- Farben und Schriftschnitte durchgehend aus A2, damit Startseite und Karte einheitlich wirken.
- **Keine Glas-Navigation.** Schlichte Leiste: Name links, Karte · Alben · Über mich + Instagram/LinkedIn rechts; auf allen Seiten gleich.

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
- Eingangsordner `images/_eingang/` (Inhalt per `.gitignore` ausgeschlossen); verarbeitete Originale nach `_eingang/erledigt/`.
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
