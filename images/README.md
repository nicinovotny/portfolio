# Bilder

Ein Ordner pro Eintrag, benannt nach der `id` in `data/albums.json`:

```
images/
  faroe-2024/
    faroe-2024-01.webp        ← große Fassung, lange Kante ca. 2400 px
    faroe-2024-01-1200.webp   ← kleine Fassung, 1200 px breit (für srcset)
```

Die Dateien enthalten keine Metadaten (auch kein GPS) – die Aufnahmedaten stehen in `albums.json` unter `"exif"`.

Solange ein Bild in `albums.json` noch ein `"demo"`-Feld hat, wird das Demo-Bild von picsum.photos angezeigt. Eigene Bilder am besten über `images/_eingang/` einpflegen (siehe `docs/Anleitung.md`).
