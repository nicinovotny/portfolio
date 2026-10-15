# Eingangsordner für neue Bilder

Exporte hier ablegen (JPEG, TIFF, PNG, HEIC oder WebP, Größe egal – am besten volle Auflösung)
und Claude sagen: **„Bilder einpflegen“**.

- Claude zeigt dir zu jedem Bild Vorschläge (Album, Titel, Alt-Text) zum Bestätigen.
- Danach entstehen die Web-Fassungen in `images/<album>/`, die Originale wandern nach `erledigt/`.
- Dieser Ordner wird nicht zu GitHub hochgeladen (siehe `.gitignore`) – `erledigt/` kannst du jederzeit leeren.

Ohne Claude: `node --no-warnings tools/images.mjs inspect` bzw. `convert --album <id> <dateien>` (siehe `docs/Anleitung.md`).
