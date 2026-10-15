# Entscheidungen – Fotografie-Portfolio

Festlegungen hier haben Vorrang vor dem Projektbriefing.

## Designrichtung (14.10.2026)
- Richtung A „Höhenlinie“: dunkel, präzise, Instrumenten-Ästhetik, Bilder bleiben der Star.
- **Startseite** nach der verfeinerten Fassung A2 (`docs/mockups/startseite-A2.dc.html`): Titel in Geist 200 (groß, eng gesetzt), gesperrter Name in Versalien, Haarlinien (0,75 px), Link mit Haarlinie statt gerahmtem Button, große Ziffer + eine feine Fortschrittslinie, kein Kamera-Readout.
- **Karte** nach dem ursprünglichen A (`docs/mockups/karte-A.dc.html`): Fadenkreuz-Marker, Labels in Geist Mono mit Koordinaten, Cluster als gestrichelter Ring, Gradnetz mit Gradangaben, Zoom-/Kamera-Readout oben rechts, Weltübersicht unten links, „Weltansicht“-Button oben links.
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
- Favicon: Fadenkreuz-Marker der Karte (`favicon.svg`)

## Lokaler Server am Mac (15.10.2026)
- `npx serve` scheiterte am Mac, weil im npm-Cache (`~/.npm`) Dateien root gehörten. Am 15.10.2026 mit `sudo chown -R 501:20 ~/.npm` behoben, `npx serve .` läuft jetzt auch am Mac.
- Ausweichlösung ohne npm, falls nötig: `python3 -m http.server 3000` im Projektordner

## Schriften – Quelle (14.10.2026)
- WOFF2-Dateien aus dem offiziellen Repo `vercel/geist-font` (SIL Open Font License), abgelegt in `fonts/`

## Startorte (14.10.2026)
- Platzhalter Deutschland: Sächsische Schweiz (einzeln) und Schwarzwald (im Alpen-Cluster)
- Damit 7 Orte: Färöer, Südkorea, Lofoten, Dolomiten, Schweiz, Sächsische Schweiz, Schwarzwald

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
