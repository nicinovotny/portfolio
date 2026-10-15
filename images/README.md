# Bilder

Ein Ordner pro Ort, benannt nach der `id` in `data/albums.json`:

```
images/
  faroe/
    faroe-01.webp        ← große Fassung, lange Kante ca. 2400 px
    faroe-01-1200.webp   ← kleine Fassung, 1200 px breit (für srcset)
```

Solange ein Bild in `albums.json` noch ein `"demo"`-Feld hat, wird das Demo-Bild von picsum.photos angezeigt. Für ein eigenes Bild: beide Dateien hier ablegen, in `albums.json` `"demo"` löschen und `width`/`height` auf die Maße der großen Datei setzen.
