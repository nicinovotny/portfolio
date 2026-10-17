// Zentrale Datenschicht: lädt data/albums.json und baut Bild-URLs.
// Alle Seiten (Startseite, Karte, Collections, Einträge) holen ihre Daten nur über dieses Modul.
//
// Aufbau von albums.json:
//   collections – Landscape, Automotive, … (Reihenfolge über "order", sichtbar über "published")
//   regions     – Gliederung der Karte (Europa → Mitteleuropa → Deutschland …)
//   entries     – Trips, Shoots und Frames ("kind"), jeweils mit Heimat-Collection und Bildern
// Bilder werden überall als "<entryId>/<imageId>" referenziert, z. B. "seoul-2026/01".

// Pfad relativ zu dieser Datei – funktioniert auch unter username.github.io/repo-name/
const DATA_URL = new URL('../data/albums.json', import.meta.url);
const IMAGE_BASE = new URL('../images/', import.meta.url);

// Breiten für srcset: kleine Variante + volle Größe (lange Kante ca. 2400 px)
const SMALL_WIDTH = 1200;

// Umbenannte Einträge: alte Links (live geteilt) führen weiter auf den neuen
const LEGACY_IDS = {
  'kleinarl': 'kleinarl-2025',
  'black-forest-2023': 'black-forest-summer-2023',
};

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

// ---------- Collections ----------

/** Veröffentlichte Collections in fester Reihenfolge (mit { all: true } auch unveröffentlichte). */
export async function getCollections({ all = false } = {}) {
  const { collections = [] } = await loadData();
  return collections
    .filter((collection) => all || collection.published)
    .sort((a, b) => a.order - b.order);
}

export async function getCollection(id) {
  return (await getCollections({ all: true })).find((collection) => collection.id === id) ?? null;
}

// ---------- Einträge ----------

/** Alle Einträge in der Reihenfolge von albums.json (neueste zuerst). */
export async function getEntries() {
  return (await loadData()).entries;
}

/** Neue id für eine alte (z. B. "kleinarl" → "kleinarl-2025"), sonst unverändert. */
export function canonicalId(id) {
  return LEGACY_IDS[id] ?? id;
}

export async function getEntry(id) {
  const wanted = canonicalId(id);
  return (await getEntries()).find((entry) => entry.id === wanted) ?? null;
}

/** Einträge, die auf der Karte erscheinen: alle mit Koordinaten (in der Regel Trips). */
export async function getMapEntries() {
  return (await getEntries()).filter((entry) => entry.coords);
}

export async function getRegions() {
  return (await loadData()).regions;
}

// ---------- Bilder ----------

/** "seoul-2026/01" → { entry, image } oder null, wenn es das Bild nicht gibt. */
export async function resolveImage(ref) {
  const [entryId, imageId] = String(ref).split('/');
  const entry = await getEntry(entryId);
  const image = entry?.images.find((img) => img.id === imageId);
  return image ? { entry, image } : null;
}

/** Referenz eines Bildes, z. B. "seoul-2026/01". */
export function imageRef(entry, image) {
  return `${entry.id}/${image.id}`;
}

/** Titelbild eines Eintrags (Index aus "cover", Standard: erstes Bild). */
export function getCover(entry) {
  return entry.images[entry.cover ?? 0] ?? entry.images[0];
}

/**
 * URL eines Bildes in einer bestimmten Breite.
 * - Demo-Bild ("demo": picsum-ID): picsum liefert jede Größe direkt.
 * - Eigenes Bild: images/<entry-id>/<datei>.webp (groß) bzw. <datei>-1200.webp (klein).
 */
export function imageUrl(entry, image, width = image.width) {
  if (image.demo != null) {
    const height = Math.round(width * (image.height / image.width));
    return `https://picsum.photos/id/${image.demo}/${width}/${height}.webp`;
  }
  const file = width < image.width ? image.file.replace(/(\.\w+)$/, `-${SMALL_WIDTH}$1`) : image.file;
  return new URL(`${entry.id}/${file}`, IMAGE_BASE).href;
}

/** src, srcset und Maße für ein <img>, damit keine Layout-Sprünge entstehen. */
export function imageAttrs(entry, image) {
  const small = Math.min(SMALL_WIDTH, image.width);
  return {
    src: imageUrl(entry, image, small),
    srcset: `${imageUrl(entry, image, small)} ${small}w, ${imageUrl(entry, image)} ${image.width}w`,
    width: image.width,
    height: image.height,
    alt: image.alt,
  };
}

// ---------- Regionen ----------

/** Kette der Regionen von außen nach innen, z. B. ["europe", "central-europe", "dolomites"] */
export function regionPath(regions, id) {
  const path = [];
  for (let current = id; current && regions[current] && !path.includes(current); current = regions[current].parent) {
    path.unshift(current);
  }
  return path;
}

// ---------- Übergang (bis die Seiten in den nächsten Schritten umgebaut sind) ----------

/** Alle Trips – die bisherigen „Alben“ (Albumseite, Übersicht, Über mich). */
export async function getAlbums() {
  return (await getEntries()).filter((entry) => entry.kind === 'trip');
}

/**
 * Bisherige Startseiten-Diashow: Einträge hinter den Hero-Favoriten von Landscape, in dieser Reihenfolge.
 * Jedes Ergebnis kennt seine Nummer aus der Trip-Liste. Ersetzt in Schritt 6 durch Slides pro Collection.
 */
export async function getFeatured() {
  const albums = await getAlbums();
  const landscape = await getCollection('landscape');
  const ids = (landscape?.heroFavorites ?? []).map((favorite) => canonicalId(favorite.image.split('/')[0]));
  const picked = [...new Set(ids)]
    .map((id) => albums.findIndex((album) => album.id === id))
    .filter((index) => index !== -1)
    .map((index) => ({ album: albums[index], number: index + 1 }));
  return picked.length ? picked : albums.slice(0, 5).map((album, index) => ({ album, number: index + 1 }));
}
