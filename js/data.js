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
  // 22.10.2026: Schwarzwald (Sommer, Herbst) und Neuschwanstein 2023 → ein Album „Süddeutschland im Herbst“
  'black-forest-2023': 'southern-germany-autumn-2023',
  'black-forest-summer-2023': 'southern-germany-autumn-2023',
  'black-forest-autumn-2023': 'southern-germany-autumn-2023',
  'neuschwanstein-2023': 'southern-germany-autumn-2023',
};

let cache = null;

// Einträge ohne eigene Seite: Frames und alle Einträge aus Collections mit "layout": "wall"
// (ihre Bilder stehen gemeinsam in der Bildwand der Collection). Wird beim Laden gefüllt.
const loose = new Set();

/** Lädt albums.json einmal und merkt sich das Ergebnis. */
export async function loadData() {
  if (!cache) {
    cache = fetch(DATA_URL).then((res) => {
      if (!res.ok) throw new Error(`albums.json konnte nicht geladen werden (${res.status})`);
      return res.json();
    }).then((data) => {
      const walls = new Set((data.collections ?? []).filter((c) => c.layout === 'wall').map((c) => c.id));
      for (const entry of data.entries) {
        if (entry.kind === 'frame' || walls.has(entry.collection)) loose.add(entry.id);
      }
      return data;
    });
  }
  return cache;
}

/** Hat der Eintrag eine eigene Seite (entry.html)? Nein bei Frames und Einträgen aus Bildwand-Collections. */
export function hasOwnPage(entry) {
  return !loose.has(entry.id);
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

/** Gehört der Eintrag (als Kachel) zu dieser Collection? Heimat-Collection oder "alsoIn". */
export function belongsTo(entry, collectionId) {
  return entry.collection === collectionId || (entry.alsoIn ?? []).includes(collectionId);
}

/** Trips und Shoots einer Collection mit eigener Seite, in der Reihenfolge von albums.json (neueste zuerst). */
export async function getCollectionEntries(collectionId) {
  return (await getEntries()).filter((entry) => hasOwnPage(entry) && belongsTo(entry, collectionId));
}

/**
 * Einzelbilder einer Collection, neueste zuerst (Reihenfolge der Einträge in albums.json):
 *   - alle Bilder ihrer eigenen Einträge ohne eigene Seite (Frames; in Bildwand-Collections alle Shoots)
 *   - Bilder aus anderen Einträgen, die per "tags" dazugehören (z. B. der Papageientaucher aus Island
 *     in Wildlife). Gehört der ganze Eintrag schon als Kachel zur Collection, erscheinen sie nicht doppelt.
 * Ergebnis: [{ entry, image, tagged }] – tagged = stammt aus einem anderen Eintrag (Herkunftszeile).
 */
export async function getCollectionFrames(collectionId) {
  const frames = [];
  for (const entry of await getEntries()) {
    const own = belongsTo(entry, collectionId);
    if (!hasOwnPage(entry) && own) {
      entry.images.forEach((image) => frames.push({ entry, image, tagged: false }));
    } else if (!own) {
      entry.images
        .filter((image) => (image.tags ?? []).includes(collectionId))
        .forEach((image) => frames.push({ entry, image, tagged: true }));
    }
  }
  return frames;
}

/**
 * Titelbild einer Collection als { entry, image } oder null:
 * "cover" aus albums.json, sonst der erste Hero-Favorit, sonst das Titelbild des neuesten Eintrags,
 * sonst das erste Einzelbild.
 */
export async function getCollectionCover(collection) {
  for (const ref of [collection.cover, collection.heroFavorites?.[0]?.image]) {
    const found = ref && await resolveImage(ref);
    if (found) return found;
  }
  const [first] = await getCollectionEntries(collection.id);
  if (first) return { entry: first, image: getCover(first) };
  const [frame] = await getCollectionFrames(collection.id);
  return frame ? { entry: frame.entry, image: frame.image } : null;
}

/** Sortierschlüssel „JJJJ-MM-TT“ aus dem spätesten bekannten Datum (dateEnd, dateStart, date, year) */
function dateKey(entry) {
  const value = entry.dateEnd ?? entry.dateStart ?? entry.date ?? (entry.year ? String(entry.year) : '');
  return String(value).padEnd(10, '-');   // "2023" → "2023------": steht vor allen Daten aus 2023
}

/** Die neuesten Trips und Shoots (ohne Frames), neueste zuerst; gleiche Daten in der Reihenfolge der Datei */
export async function getNewestEntries(count = 3) {
  return (await getEntries())
    .filter((entry) => entry.kind !== 'frame')
    .map((entry, index) => ({ entry, index, key: dateKey(entry) }))
    .sort((a, b) => b.key.localeCompare(a.key) || a.index - b.index)
    .slice(0, count)
    .map(({ entry }) => entry);
}

/**
 * Hero-Favoriten der veröffentlichten Collections, in deren Reihenfolge – nur Collections mit Favoriten.
 * Ergebnis: [{ collection, favorites: [{ entry, image, focus, focusMobile }] }]
 */
export async function getHeroCollections() {
  const result = [];
  for (const collection of await getCollections()) {
    const favorites = [];
    for (const favorite of collection.heroFavorites ?? []) {
      const found = await resolveImage(favorite.image);
      if (found) favorites.push({ ...found, focus: favorite.focus, focusMobile: favorite.focusMobile });
    }
    if (favorites.length) result.push({ collection, favorites });
  }
  return result;
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

/**
 * src, srcset und Maße für ein <img>, damit keine Layout-Sprünge entstehen.
 * crossOrigin steht vorn (wird vor src gesetzt): Alle Bilder laden im selben Modus wie Bühne und Hero
 * (die ihre Helligkeit messen) – sonst lädt der Browser dieselbe Datei ein zweites Mal.
 */
export function imageAttrs(entry, image) {
  const small = Math.min(SMALL_WIDTH, image.width);
  return {
    crossOrigin: 'anonymous',
    src: imageUrl(entry, image, small),
    srcset: `${imageUrl(entry, image, small)} ${small}w, ${imageUrl(entry, image)} ${image.width}w`,
    width: image.width,
    height: image.height,
    alt: image.alt,
  };
}

// ---------- Adressen ----------

/**
 * Seite eines Eintrags (Trip, Shoot). Einträge ohne eigene Seite (Frames, Bildwand) öffnen ihre Collection,
 * dort zeigt die Großansicht das Bild (Standard: Titelbild des Eintrags).
 */
export function entryUrl(entry, image = getCover(entry)) {
  if (hasOwnPage(entry)) return `entry.html?id=${encodeURIComponent(entry.id)}`;
  return `${collectionUrl(entry.collection)}&bild=${encodeURIComponent(imageRef(entry, image))}`;
}

/** Seite einer Collection */
export function collectionUrl(collectionId) {
  return `collection.html?id=${encodeURIComponent(collectionId)}`;
}

/** Übersicht aller Collections */
export const OVERVIEW_URL = 'collections.html';

// ---------- Regionen ----------

/** Kette der Regionen von außen nach innen, z. B. ["europe", "central-europe", "dolomites"] */
export function regionPath(regions, id) {
  const path = [];
  for (let current = id; current && regions[current] && !path.includes(current); current = regions[current].parent) {
    path.unshift(current);
  }
  return path;
}
