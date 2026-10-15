# Nicolas Novotny – Landschaftsfotografie

Portfolio-Website mit Weltkarte. Vanilla HTML, CSS und JavaScript, ohne Build-Schritt, gehostet auf GitHub Pages.

## Lokal starten

`fetch` funktioniert nicht über `file://`, deshalb einen kleinen Server starten:

```bash
npx serve .
```

Dann <http://localhost:3000> öffnen.

## Struktur

```
index.html          Startseite
karte.html          Weltkarte
alben.html          Übersicht aller Orte
album.html          Album-Template (album.html?ort=<id>)
ueber-mich.html     Über mich
impressum.html      Impressum
css/tokens.css      Farben, Schriften, Abstände (Design-Tokens)
css/base.css        Grundstil, Kopfzeile, Footer
js/data.js          Lädt data/albums.json, baut Bild-URLs
js/nav.js           Navigation und Handy-Menü
js/album.js         Albumseite: Kopf, Galerie (Bildzeilen), voriger/nächster Ort
js/lightbox.js      Großansicht der Bilder
js/about.js         Über mich: zählt Orte, Länder, Bilder
favicon.svg         Seitensymbol
data/albums.json    Alle Orte und Bilder – die einzige Datenquelle
data/map/           Kartendaten (erzeugt von tools/build-map.mjs)
js/map*.js          Karte: Darstellung, Zoomstufen, Projektion
tools/              Node-Werkzeuge: Kartendaten (build-map.mjs), Bilder umwandeln/prüfen (images.mjs)
.claude/skills/     Claude-Skill „bilder-einpflegen“
serve.json          Einstellung für den lokalen Server (npx serve)
images/<ort-id>/    Eigene Bilder (siehe images/README.md)
images/_eingang/    Eingangsordner für neue Exporte (wird nicht hochgeladen)
fonts/              Geist und Geist Mono (selbst gehostet, SIL OFL)
vendor/gsap/        GSAP + ScrollTrigger (selbst gehostet)
docs/               Briefing, Entscheidungen, Mockups
```

Neue Orte und Bilder werden nur in `data/albums.json` und im passenden Bilderordner ergänzt.

**Anleitung** für eigene Bilder, neue Orte und die Veröffentlichung: [`docs/Anleitung.md`](docs/Anleitung.md)

Live (GitHub Pages): <https://nicinovotny.github.io/portfolio/>
