# Fotografie-Portfolio Nicolas Novotny

Du unterstützt Nici beim Bau seines Fotografie-Portfolios (Landschaftsfotografie, Nicolas Novotny).

- Vollständige Spezifikation: `docs/Projektbriefing.md`
- Festlegungen: `docs/Entscheidungen.md` – haben Vorrang vor dem Briefing
- Design-Referenz: `docs/mockups/` (Quellcode der freigegebenen Mockups, nicht direkt lauffähig – nur für Layout, Farben, Abstände, Typografie). Liegen dort Screenshots, gelten diese als visuelle Vorlage.

Lies Briefing und Entscheidungen, bevor du Code schreibst oder Designentscheidungen triffst.

## Stand
- Phase 1 (Designrichtungen) ist abgeschlossen: Richtung A „Höhenlinie“, Startseite nach A2, Karte nach A, keine Glas-Navigation.
- Phase 2 (Umsetzung) ist abgeschlossen (15.10.2026):
  1. ✅ Erledigt (14.10.2026) – Grundgerüst: Ordnerstruktur, selbst gehostete Schriften (Geist, Geist Mono), `data/albums.json` mit den 7 Startorten und Demo-Bildern (picsum.photos, feste Seeds), gemeinsames CSS mit Design-Tokens, Navigation, Footer mit Impressum-Link
  2. ✅ Startseite mit Hero-Slider (nach A2)
  3. ✅ Karte: Weltansicht mit Clustern, dann Zoom (GSAP-viewBox) und Detailstufen
  4. ✅ Albumseite (`album.html?ort=<id>`) mit Lightbox
  5. ✅ Über mich, Impressum, Feinschliff (reduced motion, Tastatur, Mobil)
- Zusätzlich zu Schritt 1 gebaut: `alben.html` (Übersicht aller Orte, Ziel des Menüpunkts „Alben“). Demo-Bilder sind handverlesene picsum-IDs (Feld `"demo"` in `albums.json`) statt zufälliger Seeds.
- ✅ Schritt 2 erledigt (14.10.2026): Startseite `index.html` + `css/home.css` + `js/home.js`. Diashow der Album-Titelbilder (7 s pro Bild, Überblendung + langsamer Zoom), Fortschrittslinie aus 7 klickbaren Abschnitten, Pause-Knopf, Pfeiltasten, Wischen, Parallax beim Rausscrollen, kurzer Einstiegstext darunter ([Platzhalter]). Bei `prefers-reduced-motion` keine automatische Diashow. „Auf der Karte zeigen“ verlinkt auf `karte.html?ort=<id>` – das muss die Karte in Schritt 3 auswerten.
- ✅ Schritt 3 erledigt (14.10.2026): `karte.html` + `css/map.css` + `js/map.js` (Darstellung, Eingaben), `js/map-views.js` (Zoomstufen, Cluster, Ausschnitte), `js/map-projection.js` (Natural Earth 1 ohne Bibliothek). Kartendaten-Generator in `tools/` (Details in `docs/Entscheidungen.md`). `serve.json` schaltet saubere URLs beim lokalen Server ab, sonst geht `?ort=` verloren.
- ✅ Schritt 4 erledigt (15.10.2026, am Mac): `album.html` + `css/album.css` + `js/album.js` (Kopf, Galerie, Ortsnavigation) + `js/lightbox.js` (Großansicht als `<dialog>`, FLIP-Übergang aus der Galerie). Details in `docs/Entscheidungen.md`. Getestet: Desktop und Handy, Tastatur (Pfeile, Esc, Fokus-Rückgabe), unbekannter Ort; von Nici im eigenen Browser abgenommen.
- ✅ Schritt 5 erledigt (15.10.2026, am Mac): `ueber-mich.html` + `css/about.css` + `js/about.js` (Steckbrief, Ausrüstung, Werdegang, „Diese Seite“; Zahlen aus `albums.json`), `impressum.html` mit Impressum und Datenschutz-Gerüst (alles mit [Platzhalter], vor Veröffentlichung rechtlich prüfen), Footer „Impressum · Datenschutz“ und `favicon.svg` auf allen Seiten. Feinschliff in `css/base.css`: sanfte Seitenübergänge (View Transitions, Kopfzeile bleibt stehen), globale Regel für reduzierte Bewegung; `js/nav.js` sperrt bei offenem Handy-Menü den Rest der Seite (`inert`).
- Offene Platzhalter für Nici: Porträt, Texte „Über mich“, Ausrüstung, Werdegang, Texte in `albums.json`, Einstiegstext auf der Startseite.
- Phase 3 (15.10.2026): Anleitung `docs/Anleitung.md` (Arbeitsablauf, eigene Bilder, neue Orte, GitHub Pages, eigene Domain, Checkliste). Projekt aus Google Drive ins Git-Repo umgezogen (siehe Arbeitsweise), `.nojekyll` für GitHub Pages.
- ✅ Live seit 15.10.2026 unter <https://nicolasnovotny.de> (GitHub Pages, main, root; Domain bei INWX, `CNAME`-Datei im Repo). `nicinovotny.github.io/portfolio/` und `www.` leiten dorthin um.
- ✅ Skill „bilder-einpflegen“ (15.10.2026): `.claude/skills/bilder-einpflegen/SKILL.md` + `tools/images.mjs` (inspect / convert / check), Eingangsordner `images/_eingang/`. An Testbildern durchgespielt (EXIF-Drehung, GPS-Zuordnung, HEIC, Demo ersetzen, neuer Ort).
- ✅ Ein Album pro Reise (15.10.2026, am PC): 18 Reisen 2021–2026 in `albums.json` (IDs `<ort>-<jahr>`, Feld `year`, neueste zuerst), Regionen verschachtelt über `parent` (z. B. Europa → Alpen → Dolomiten), Startseite zeigt nur die 5 Favoriten aus `"featured"`, Alben-Übersicht nach Jahren gruppiert, Jahr in allen Labels. Karte: beliebig tiefe Zoomstufen, Alben an gleicher Stelle werden aufgefächert (Seoul 2025/2026). Neue Alben haben je 3 Demo-Bilder. Logik getestet; Kamerafahrten nach dem Umbau noch nicht im sichtbaren Browser angesehen.
- ✅ Karte neu gegliedert (15.10.2026): Nordeuropa / Mitteleuropa / Länder, Startansicht = Reisegebiete statt ganze Welt, Cluster teilen sich automatisch auf, wenn nichts überlappt (Details in `docs/Entscheidungen.md`, „Gliederung der Karte“). Logik für 1440, 1280 und 390 px Breite getestet; Kamerafahrten nicht im sichtbaren Browser angesehen.
- ✅ Feinschliff 15.10.2026: Höhenlinien-Marker statt Fadenkreuz, neues Favicon, bildabhängige Verläufe im Hero, kräftigere Kopfzeile; neue Alben Stockholm 2021 und Algarve 2020 (Region Südeuropa), 20 Reisen. Koordinaten aller Alben geprüft (passen).
- ✅ Album-Bühne + „Bild fliegt ins Album“ (15.10.2026): `album.html`/`css/album.css`/`js/album.js` umgebaut, neu `js/transitions.js` und `js/scrim.js` (Details in `docs/Entscheidungen.md`). Logik getestet; Übergang und Scroll-Effekte nicht im sichtbaren Browser angesehen.
- ✅ Qualitätsrunde 15.10.2026: Aufklapp-Animation der Galerie entfernt, Voriger/Nächster Ort direkt auf der Bühne, Album-Wechsel ohne harten Schnitt, schnellere Seitenwechsel (Vorab-Laden, schlankere Übergänge), bessere Lesbarkeit der Labels. Im sichtbaren Browser getestet (Desktop + Handy). Details in `docs/Entscheidungen.md`, „Qualitätsrunde“.
- Offen: genauer Ort in Schottland (vorläufig Glencoe).
- **Umbau zum breiten Portfolio (ab 17.10.2026):** Spezifikation in `docs/Umbau-Spezifikation.md` (Collections Landscape/Automotive/Wildlife/Portrait/Creative, Einträge `trip`/`shoot`/`frame`, Tags, neue Startseite, Lightbox mit Aufnahmedaten). 8 Schritte, nach jedem anhalten, Nici testet, dann Commit. Abweichungen (GSAP selbst gehostet, Höhenlinien-Marker, Import über `tools/images.mjs`) in `docs/Entscheidungen.md`.
  1. ✅ Datenmodell (17.10.2026): `albums.json` mit `collections` + `entries` (21 Trips, Schwarzwald geteilt, `kleinarl-2025`), `js/data.js` mit neuen Funktionen + Übergangsfunktionen `getAlbums`/`getFeatured`, alte IDs leiten weiter, Karte nur Einträge mit `coords`, `images.mjs check` fürs neue Format. Seiten sehen aus wie vorher (im Browser geprüft).
  2. ✅ Eintragsseite (17.10.2026): `entry.html` + `js/entry.js` + `css/entry.css` (aus album.* umgezogen), Trip = Galerie, Shoot = Bildstrecke, Voriger/Nächster innerhalb der Collection, `album.html` leitet weiter, Karte spricht von Trips. Mit einem Test-Shoot im Browser geprüft (Desktop, Handy, Lightbox per Tastatur), Test-Shoot wieder entfernt.
  3. Lightbox mit Aufnahmedaten · 4. Collection-Seite · 5. Collections-Übersicht + Navigation · 6. Startseite · 7. Import mit EXIF · 8. neue Einträge aus der Bestandsliste
- **Als Nächstes:** Umbau Schritt 3 (Lightbox mit Aufnahmedaten). Danach eigene Bilder und Texte (Checkliste in `docs/Anleitung.md`, Abschnitt 5 – Anleitung wird in Schritt 7 aufs neue Datenformat umgeschrieben).

## Rahmen (gilt immer)
- Vanilla HTML/CSS/JS + GSAP (inkl. ScrollTrigger) selbst gehostet in `vendor/gsap/`, kein Framework, kein Build-Schritt für die Seite, Hosting auf GitHub Pages, alle Pfade relativ.
- `data/albums.json` ist die einzige Quelle für Orte und Bilder. Karte, Startseite und Alben werden daraus generiert. Bilder liegen in `images/<ort-id>/`.
- Keine Datenerhebung, kein Tracking, keine Cookies, kein Kontaktformular, selbst gehostete Schriften.
- Die Bilder sind der Star. Effekte nur, wenn sie einen Zweck haben.
- Performance (Lazy Loading, srcset, WebP/AVIF, keine Layout-Sprünge, 60 fps), Responsiveness, Barrierefreiheit (Tastatur, Alt-Texte) und `prefers-reduced-motion` immer mitdenken.
- Lokal testen über einen Dev-Server (z. B. `npx serve`), da `fetch` nicht über `file://` lädt.

## Arbeitsweise
- Kommuniziere auf Deutsch. Code-Bezeichner auf Englisch, Kommentare kurz auf Deutsch.
- Arbeite inkrementell: ein Feature oder Schritt pro Iteration, das Ergebnis soll danach lokal testbar sein. Sag am Ende jedes Schritts, wie Nici ihn testet.
- Nenne bei jeder Änderung zuerst, welche Dateien betroffen sind.
- Größere Architektur- oder Designänderungen schlägst du kurz vor und wartest auf Bestätigung.
- Wenn Nici neue Bilder oder Orte liefert: Skill `bilder-einpflegen` verwenden (Eingangsordner `images/_eingang/`, Werkzeug `tools/images.mjs`).
- Wenn etwas Wichtiges festgelegt wird (Farben, Schriften, Kartenstil, Architektur), trag es in `docs/Entscheidungen.md` ein.
- Git: Das Projekt liegt im Repo `nicinovotny/portfolio` (Mac: `~/Documents/GitHub/portfolio`, PC: eigener Klon über GitHub Desktop). Abgleich zwischen den Geräten nur über GitHub, der alte Google-Drive-Ordner ist Archiv. Commits nur, wenn Nici darum bittet; gepusht wird über GitHub Desktop (dort ist Nici angemeldet), jeder Push auf `main` geht sofort live.
- Nach jedem abgeschlossenen Schritt hier unter „Stand“ festhalten, was erledigt ist und was als Nächstes kommt.
- Lokaler Server: `npx serve .` im Projektordner, dann http://localhost:3000
