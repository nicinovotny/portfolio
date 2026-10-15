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
- Offene Platzhalter für Nici: LinkedIn-URL (alle Seiten), Porträt, Texte „Über mich“, Ausrüstung, Werdegang, Impressum-Anschrift und E-Mail, Datenschutz-Details, Texte in `albums.json`, Einstiegstext auf der Startseite.
- Phase 3 (15.10.2026): Anleitung `docs/Anleitung.md` (Arbeitsablauf, eigene Bilder, neue Orte, GitHub Pages, eigene Domain, Checkliste). Projekt aus Google Drive ins Git-Repo umgezogen (siehe Arbeitsweise), `.nojekyll` für GitHub Pages.
- **Als Nächstes:** Nici pusht über GitHub Desktop und schaltet GitHub Pages ein (Anleitung Abschnitt 4), dann Live-Seite prüfen. Danach: eigene Bilder und Texte einpflegen.

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
- Wenn Nici neue Bilder oder Orte liefert: `albums.json` aktualisieren, Ordner und Dateinamen nennen, Export-Hinweise geben (groß: lange Kante 2400 px, klein: 1200 px breit mit Zusatz `-1200`, WebP – siehe `docs/Anleitung.md`).
- Wenn etwas Wichtiges festgelegt wird (Farben, Schriften, Kartenstil, Architektur), trag es in `docs/Entscheidungen.md` ein.
- Git: Das Projekt liegt im Repo `nicinovotny/portfolio` (Mac: `~/Documents/GitHub/portfolio`, PC: eigener Klon über GitHub Desktop). Abgleich zwischen den Geräten nur über GitHub, der alte Google-Drive-Ordner ist Archiv. Commits nur, wenn Nici darum bittet; gepusht wird über GitHub Desktop (dort ist Nici angemeldet), jeder Push auf `main` geht sofort live.
- Nach jedem abgeschlossenen Schritt hier unter „Stand“ festhalten, was erledigt ist und was als Nächstes kommt.
- Lokaler Server: `npx serve .` im Projektordner, dann http://localhost:3000
