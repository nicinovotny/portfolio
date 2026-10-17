# Eingangsordner für neue Bilder

Exporte hier ablegen (JPEG, TIFF, PNG, HEIC oder WebP, Größe egal – am besten volle Auflösung **mit Metadaten**,
damit Kamera, Objektiv und Belichtung übernommen werden) und Claude sagen: **„Bilder einpflegen“**.

- Claude zeigt dir zu jedem Bild Vorschläge (Eintrag, Titel, Alt-Text, Tags) zum Bestätigen und fragt fehlende Aufnahmedaten nach.
- Danach entstehen die Web-Fassungen in `images/<eintrag>/` (ohne Metadaten, auch ohne GPS), die Originale wandern nach `erledigt/`.
- Dieser Ordner wird nicht zu GitHub hochgeladen (siehe `.gitignore`). `erledigt/` bitte aufheben: Aus diesen Originalen lassen sich Aufnahmedaten später erneut auslesen (`tools/images.mjs backfill`).

Ohne Claude: `node tools/images.mjs import` – fragt alles im Terminal ab (siehe `docs/Anleitung.md`).
