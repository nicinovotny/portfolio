// Bilder-Werkzeug fürs Portfolio: prüft neue Bilder, wandelt sie ins Web-Format um
// und gleicht data/albums.json mit dem Bilderordner ab.
//
// Aufruf (aus dem Projektordner, einmalig vorher: cd tools && npm install):
//   node tools/images.mjs inspect [dateien…]               Eingangsordner prüfen (Maße, Aufnahmedaten, GPS, Vorschau)
//   node tools/images.mjs convert --entry <id> <dateien…>   WebP groß + klein nach images/<id>/ (--album geht auch)
//   node tools/images.mjs check                            albums.json (Collections, Einträge) gegen die Bilddateien prüfen
//
// Ausgabe ist JSON, damit Claude (der Skill „bilder-einpflegen“) sie direkt weiterverwenden kann.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import exifReader from 'exif-reader';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const IMAGES = join(ROOT, 'images');
const INBOX = join(IMAGES, '_eingang');
const DONE = join(INBOX, 'erledigt');
const ALBUMS = join(ROOT, 'data', 'albums.json');
const PREVIEWS = join(tmpdir(), 'portfolio-vorschau');

// Exportgrößen – müssen zu js/data.js passen (SMALL_WIDTH)
const LARGE_EDGE = 2400;
const SMALL_WIDTH = 1200;
const QUALITY_LARGE = 82;
const QUALITY_SMALL = 75;

const INPUT_TYPES = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.avif', '.heic', '.heif']);

// ---------- Hilfsfunktionen ----------

const print = (data) => console.log(JSON.stringify(data, null, 2));

function fail(message) {
  print({ error: message });
  process.exit(1);
}

function readAlbums() {
  try {
    return JSON.parse(readFileSync(ALBUMS, 'utf8'));
  } catch (error) {
    fail(`data/albums.json lässt sich nicht lesen: ${error.message}`);
  }
}

/** Datei aus Argument finden: relativ zum aktuellen Ordner, zum Projekt oder im Eingangsordner */
function findFile(arg) {
  for (const candidate of [resolve(arg), join(ROOT, arg), join(INBOX, arg)]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  fail(`Datei nicht gefunden: ${arg}`);
}

function inboxFiles() {
  if (!existsSync(INBOX)) return [];
  return readdirSync(INBOX)
    .filter((name) => !name.startsWith('.') && INPUT_TYPES.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))
    .map((name) => join(INBOX, name));
}

/**
 * Liefert eine Quelle, die sharp lesen kann. HEIC kann sharp nicht –
 * am Mac wird es dann mit dem Systemwerkzeug „sips“ in ein JPEG umgewandelt.
 */
async function openImage(file) {
  if (['.heic', '.heif'].includes(extname(file).toLowerCase())) {
    // sharp liest bei HEIC nur den Dateikopf, nicht das Bild selbst
    if (process.platform !== 'darwin') throw new Error(`${basename(file)}: HEIC geht nur am Mac. Bitte als JPEG oder TIFF exportieren.`);
    mkdirSync(PREVIEWS, { recursive: true });
    const jpeg = join(PREVIEWS, `${basename(file, extname(file))}-heic.jpg`);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', file, '--out', jpeg], { stdio: 'ignore' });
    return jpeg;
  }
  try {
    await sharp(file).metadata();
    return file;
  } catch (error) {
    throw new Error(`${basename(file)}: Format wird nicht unterstützt (${error.message}). Bitte als JPEG oder TIFF exportieren.`);
  }
}

/** Grad/Minuten/Sekunden + Himmelsrichtung → Dezimalgrad */
function toDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const value = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ['S', 'W'].includes(ref) ? -value : value;
}

function readExif(buffer) {
  if (!buffer) return {};
  try {
    const exif = exifReader(buffer);
    const lat = toDecimal(exif.GPSInfo?.GPSLatitude, exif.GPSInfo?.GPSLatitudeRef);
    const lon = toDecimal(exif.GPSInfo?.GPSLongitude, exif.GPSInfo?.GPSLongitudeRef);
    const date = exif.Photo?.DateTimeOriginal ?? exif.Image?.DateTime;
    return {
      date: date instanceof Date && !Number.isNaN(date.valueOf()) ? date.toISOString().slice(0, 10) : null,
      camera: [exif.Image?.Make, exif.Image?.Model].filter(Boolean).join(' ').trim() || null,
      lens: exif.Photo?.LensModel ?? null,
      gps: lat != null && lon != null ? { lat: +lat.toFixed(4), lon: +lon.toFixed(4) } : null,
    };
  } catch {
    return {};
  }
}

/** Entfernung in km zwischen zwei Koordinaten */
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Nächste freie Nummer <entry>-NN in Ordner und albums.json */
function nextNumber(albumId, album) {
  const pattern = new RegExp(`^${albumId}-(\\d+)(?:-${SMALL_WIDTH})?\\.\\w+$`);
  const names = [
    ...(existsSync(join(IMAGES, albumId)) ? readdirSync(join(IMAGES, albumId)) : []),
    ...(album?.images ?? []).map((image) => image.file),
  ];
  const numbers = names.map((name) => Number(name.match(pattern)?.[1] ?? 0));
  return Math.max(0, ...numbers) + 1;
}

// ---------- inspect ----------

async function inspect(args) {
  const files = args.length ? args.map(findFile) : inboxFiles();
  if (!files.length) {
    print({ files: [], hint: 'Keine Bilder gefunden. Exporte nach images/_eingang/ legen (JPEG, TIFF, PNG, HEIC, WebP).' });
    return;
  }
  const albums = (readAlbums().entries ?? []).filter((entry) => entry.coords);   // nur Einträge mit Ort
  mkdirSync(PREVIEWS, { recursive: true });

  const results = [];
  for (const file of files) {
    try {
      const source = await openImage(file);
      const meta = await sharp(source).metadata();
      const rotated = (meta.orientation ?? 1) >= 5;
      const width = rotated ? meta.height : meta.width;
      const height = rotated ? meta.width : meta.height;
      const exif = readExif(meta.exif);

      // Vorschau zum Ansehen (kleines JPEG, richtig gedreht)
      const preview = join(PREVIEWS, `${basename(file, extname(file))}.jpg`);
      await sharp(source).rotate().resize({ width: 1024, height: 1024, fit: 'inside' }).jpeg({ quality: 78 }).toFile(preview);

      const nearest = exif.gps
        ? albums
          .map((album) => ({ id: album.id, name: album.name, km: Math.round(distanceKm(exif.gps, album.coords)) }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 2)
        : null;

      const warnings = [];
      const longEdge = Math.max(width, height);
      if (longEdge < SMALL_WIDTH) warnings.push(`Sehr klein (${longEdge} px) – wirkt auf großen Bildschirmen unscharf.`);
      else if (longEdge < LARGE_EDGE) warnings.push(`Lange Kante ${longEdge} px (< ${LARGE_EDGE}) – wird nicht vergrößert.`);

      results.push({
        file,
        name: basename(file),
        width,
        height,
        orientation: width >= height ? 'quer' : 'hoch',
        format: source === file ? meta.format : extname(file).slice(1).toLowerCase(),
        ...exif,
        nearestAlbums: nearest,
        preview,
        warnings,
      });
    } catch (error) {
      results.push({ file, name: basename(file), error: error.message });
    }
  }
  print({ files: results });
}

// ---------- convert ----------

function parseConvertArgs(args) {
  const files = [];
  let album = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--entry' || args[i] === '--album') album = args[++i];
    else files.push(args[i]);
  }
  if (!album) fail('Bitte Eintrag angeben: --entry <id>');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(album)) fail(`Ungültige Eintrags-ID „${album}“ (nur Kleinbuchstaben, Ziffern, Bindestriche).`);
  if (!files.length) fail('Keine Dateien angegeben.');
  return { album, files: files.map(findFile) };
}

/** Original nach _eingang/erledigt/ verschieben (nur wenn es im Eingangsordner lag) */
function archive(file) {
  if (resolve(file, '..') !== resolve(INBOX)) return null;
  mkdirSync(DONE, { recursive: true });
  let target = join(DONE, basename(file));
  if (existsSync(target)) target = join(DONE, `${basename(file, extname(file))}-${Date.now()}${extname(file)}`);
  renameSync(file, target);
  return target;
}

async function convert(args) {
  const { album: albumId, files } = parseConvertArgs(args);
  const album = (readAlbums().entries ?? []).find((a) => a.id === albumId);
  const folder = join(IMAGES, albumId);
  mkdirSync(folder, { recursive: true });

  let number = nextNumber(albumId, album);
  const results = [];
  for (const file of files) {
    try {
      const source = await openImage(file);
      let name;
      let imageId;
      do {
        imageId = String(number).padStart(2, '0');
        name = `${albumId}-${imageId}`;
        number++;
      } while (existsSync(join(folder, `${name}.webp`)) || album?.images.some((image) => image.id === imageId));

      // .rotate() dreht nach EXIF-Ausrichtung; sharp wandelt nach sRGB und entfernt Metadaten (auch GPS)
      const large = await sharp(source).rotate()
        .resize({ width: LARGE_EDGE, height: LARGE_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY_LARGE, effort: 5 })
        .toFile(join(folder, `${name}.webp`));
      const small = await sharp(source).rotate()
        .resize({ width: SMALL_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY_SMALL, effort: 5 })
        .toFile(join(folder, `${name}-${SMALL_WIDTH}.webp`));

      results.push({
        source: basename(file),
        archivedTo: archive(file),
        files: [`images/${albumId}/${name}.webp`, `images/${albumId}/${name}-${SMALL_WIDTH}.webp`],
        sizeKb: { large: Math.round(large.size / 1024), small: Math.round(small.size / 1024) },
        entry: { id: imageId, file: `${name}.webp`, width: large.width, height: large.height },
      });
    } catch (error) {
      results.push({ source: basename(file), error: error.message });
    }
  }
  print({ entry: albumId, entryInJson: Boolean(album), results });
}

// ---------- check ----------

async function check() {
  const data = readAlbums();
  const errors = [];
  const warnings = [];
  if (!data.entries) fail('albums.json hat kein "entries" – noch das alte Format mit "albums"?');

  const collectionIds = new Set((data.collections ?? []).map((c) => c.id));
  const KINDS = ['trip', 'shoot', 'frame', 'series'];
  const TECH_TAGS = ['analog'];   // Technik-Tags: nur Chip in der Lightbox, keine Collection
  const ids = new Set();

  for (const entry of data.entries) {
    const where = `Eintrag „${entry.id}“`;
    if (ids.has(entry.id)) errors.push(`${where}: ID doppelt vergeben.`);
    ids.add(entry.id);
    if (!KINDS.includes(entry.kind)) errors.push(`${where}: kind „${entry.kind}“ unbekannt (${KINDS.join(', ')}).`);
    if (!entry.name) errors.push(`${where}: name fehlt.`);
    if (!collectionIds.has(entry.collection)) errors.push(`${where}: collection „${entry.collection}“ gibt es nicht.`);
    for (const other of entry.alsoIn ?? []) {
      if (!collectionIds.has(other)) errors.push(`${where}: alsoIn „${other}“ gibt es nicht.`);
    }
    if (entry.region != null && !data.regions?.[entry.region]) errors.push(`${where}: region „${entry.region}“ fehlt unter "regions".`);
    if (entry.year != null && !Number.isInteger(entry.year)) errors.push(`${where}: year muss eine Jahreszahl sein (z. B. 2024) oder null.`);
    if (entry.year == null) warnings.push(`${where}: kein Jahr eingetragen.`);
    if (entry.coords != null && (typeof entry.coords.lat !== 'number' || typeof entry.coords.lon !== 'number')) {
      errors.push(`${where}: coords.lat/lon fehlen oder sind keine Zahlen.`);
    }
    if (entry.coords && !entry.region) errors.push(`${where}: hat coords, aber keine region (braucht die Karte).`);
    if (entry.kind === 'trip' && !entry.coords) warnings.push(`${where}: Trip ohne coords – erscheint nicht auf der Karte.`);
    if (!entry.images?.length) { errors.push(`${where}: keine Bilder.`); continue; }
    if (entry.cover != null && !entry.images[entry.cover]) errors.push(`${where}: cover ${entry.cover} zeigt auf kein Bild (Zählung ab 0).`);

    const referenced = new Set();
    const imageIds = new Set();
    for (const image of entry.images) {
      const label = `${where}, ${image.file}`;
      if (!image.id) errors.push(`${label}: id fehlt (z. B. "01").`);
      else if (imageIds.has(image.id)) errors.push(`${label}: Bild-id „${image.id}“ doppelt.`);
      imageIds.add(image.id);
      if (!image.alt) warnings.push(`${label}: Alt-Text fehlt.`);
      for (const tag of image.tags ?? []) {
        if (!collectionIds.has(tag) && !TECH_TAGS.includes(tag)) warnings.push(`${label}: Tag „${tag}“ ist weder Collection noch Technik-Tag.`);
      }
      if (image.demo != null) continue;
      const large = join(IMAGES, entry.id, image.file);
      const small = large.replace(/(\.\w+)$/, `-${SMALL_WIDTH}$1`);
      referenced.add(basename(large)).add(basename(small));
      if (!existsSync(large)) { errors.push(`${label}: Datei fehlt (images/${entry.id}/${image.file}).`); continue; }
      if (image.width > SMALL_WIDTH && !existsSync(small)) errors.push(`${label}: kleine Fassung -${SMALL_WIDTH} fehlt.`);
      const meta = await sharp(large).metadata();
      if (meta.width !== image.width || meta.height !== image.height) {
        errors.push(`${label}: Maße in albums.json ${image.width}×${image.height}, Datei hat ${meta.width}×${meta.height}.`);
      }
    }

    // Dateien im Ordner, die nirgends eingetragen sind
    const folder = join(IMAGES, entry.id);
    if (existsSync(folder)) {
      for (const name of readdirSync(folder)) {
        if (!name.startsWith('.') && !referenced.has(name)) warnings.push(`${where}: images/${entry.id}/${name} ist nicht in albums.json eingetragen.`);
      }
    }
    const demos = entry.images.filter((image) => image.demo != null).length;
    if (demos && demos < entry.images.length) warnings.push(`${where}: noch ${demos} Demo-Bild(er) neben eigenen Bildern.`);
  }

  // Regionen: jede "parent"-Angabe muss existieren, ohne Kreis
  for (const [id, region] of Object.entries(data.regions ?? {})) {
    const seen = new Set([id]);
    for (let parent = region.parent; parent; parent = data.regions[parent]?.parent) {
      if (!data.regions[parent]) { errors.push(`Region „${id}“: parent „${parent}“ fehlt unter "regions".`); break; }
      if (seen.has(parent)) { errors.push(`Region „${id}“: Kreis in den parent-Angaben.`); break; }
      seen.add(parent);
    }
  }

  // Collections: Titelbild und Hero-Favoriten müssen auf vorhandene Bilder zeigen ("<entryId>/<imageId>")
  const imageExists = (ref) => {
    const [entryId, imageId] = String(ref).split('/');
    return data.entries.some((e) => e.id === entryId && e.images?.some((i) => i.id === imageId));
  };
  const seenCollections = new Set();
  for (const collection of data.collections ?? []) {
    const where = `Collection „${collection.id}“`;
    if (seenCollections.has(collection.id)) errors.push(`${where}: ID doppelt vergeben.`);
    seenCollections.add(collection.id);
    if (collection.cover && !imageExists(collection.cover)) errors.push(`${where}: cover „${collection.cover}“ gibt es nicht.`);
    for (const favorite of collection.heroFavorites ?? []) {
      if (!imageExists(favorite.image)) errors.push(`${where}: Hero-Favorit „${favorite.image}“ gibt es nicht.`);
    }
    if (collection.published && !collection.heroFavorites?.length) warnings.push(`${where}: keine Hero-Favoriten – erscheint nicht im Hero der Startseite.`);
  }

  const totals = {
    collections: data.collections?.length ?? 0,
    entries: data.entries.length,
    images: data.entries.reduce((sum, e) => sum + (e.images?.length ?? 0), 0),
    demoImages: data.entries.reduce((sum, e) => sum + (e.images ?? []).filter((i) => i.demo != null).length, 0),
  };
  print({ ok: errors.length === 0, totals, errors, warnings });
  if (errors.length) process.exitCode = 1;
}

// ---------- Start ----------

const [command, ...args] = process.argv.slice(2);
const commands = { inspect, convert, check };
if (!commands[command]) fail('Befehl: inspect | convert --entry <id> <dateien…> | check');
await commands[command](args);
