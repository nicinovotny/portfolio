// Zentrale Datenschicht: lädt data/albums.json und baut Bild-URLs.
// Alle Seiten (Startseite, Karte, Alben) holen ihre Daten nur über dieses Modul.

// Pfad relativ zu dieser Datei – funktioniert auch unter username.github.io/repo-name/
const DATA_URL = new URL('../data/albums.json', import.meta.url);
const IMAGE_BASE = new URL('../images/', import.meta.url);

// Breiten für srcset: kleine Variante + volle Größe (lange Kante ca. 2400 px)
const SMALL_WIDTH = 1200;

let cache = null;

/** Lädt albums.json einmal und merkt sich das Ergebnis. */
export async function loadData() {
  if (!cache) {
    cache = fetch(DATA_URL).then((res) => {
      if (!res.ok) throw new Error(`albums.json konnte nicht geladen werden (${res.status})`);
      return res.json();
    });
  }
  return cache;
}

export async function getAlbums() {
  return (await loadData()).albums;
}

export async function getAlbum(id) {
  return (await getAlbums()).find((album) => album.id === id) ?? null;
}

export async function getRegions() {
  return (await loadData()).regions;
}

/** Titelbild eines Albums (Index aus "cover", Standard: erstes Bild). */
export function getCover(album) {
  return album.images[album.cover ?? 0] ?? album.images[0];
}

/**
 * URL eines Bildes in einer bestimmten Breite.
 * - Demo-Bild ("demo": picsum-ID): picsum liefert jede Größe direkt.
 * - Eigenes Bild: images/<album-id>/<datei>.webp (groß) bzw. <datei>-1200.webp (klein).
 */
export function imageUrl(album, image, width = image.width) {
  if (image.demo != null) {
    const height = Math.round(width * (image.height / image.width));
    return `https://picsum.photos/id/${image.demo}/${width}/${height}.webp`;
  }
  const file = width < image.width ? image.file.replace(/(\.\w+)$/, `-${SMALL_WIDTH}$1`) : image.file;
  return new URL(`${album.id}/${file}`, IMAGE_BASE).href;
}

/** src, srcset und Maße für ein <img>, damit keine Layout-Sprünge entstehen. */
export function imageAttrs(album, image) {
  const small = Math.min(SMALL_WIDTH, image.width);
  return {
    src: imageUrl(album, image, small),
    srcset: `${imageUrl(album, image, small)} ${small}w, ${imageUrl(album, image)} ${image.width}w`,
    width: image.width,
    height: image.height,
    alt: image.alt,
  };
}
