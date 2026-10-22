// Bilder-Werkzeug fürs Portfolio (lokal mit Node, kein Teil der Seite).
// Liest die Originale (JPEG, TIFF, Lightroom-Export …), wandelt sie ins Web-Format um, übernimmt die
// Aufnahmedaten nach data/albums.json und prüft das Ergebnis. Veröffentlichte Dateien enthalten KEINE
// Metadaten (auch kein GPS) – Kartenkoordinaten kommen nur aus albums.json.
//
// Aufruf aus dem Projektordner (einmalig vorher: cd tools && npm install):
//
//   node tools/images.mjs import [--entry <id>] [dateien…]
//        Für Nici im Terminal: geht die Bilder im Eingangsordner einzeln durch, schlägt den Eintrag vor
//        (GPS, Aufnahmedatum), fragt fehlende Aufnahmedaten, Titel, Alt-Text und Tags ab (Enter = leer
//        lassen bzw. Vorschlag übernehmen), wandelt um und trägt alles in albums.json ein.
//
//   node tools/images.mjs inspect [dateien…]               Bilder prüfen: Maße, Aufnahmedaten, GPS, Vorschläge
//   node tools/images.mjs convert --entry <id> <dateien…>   WebP groß + klein nach images/<id>/, gibt das Bild
//                                                         für albums.json aus (inkl. Aufnahmedaten)
//   node tools/images.mjs backfill --entry <id> [--prefix <p>] [--dates] [--force]
//        Aufnahmedaten vorhandener Bilder aus den Originalen in images/_eingang/erledigt/<p>__… nachtragen
//   node tools/images.mjs check                            albums.json gegen die Bilddateien prüfen
//
// inspect, convert, backfill und check geben JSON aus, damit Claude (Skill „bilder-einpflegen“) sie
// weiterverwenden kann.

import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ANALOG_FIELDS, EXIF_FIELDS, readExif } from './lib/exif.mjs';
import { readAlbumsFile, writeAlbumsFile } from './lib/albums-file.mjs';

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
const TECH_TAGS = ['analog'];   // Technik-Tags: nur Chip in der Lightbox, keine Collection
const NEAR_KM = 150;            // GPS-Vorschlag nur, wenn ein Eintrag so nah liegt

// ---------- Hilfsfunktionen ----------

const print = (data) => console.log(JSON.stringify(data, null, 2));

function fail(message) {
  print({ error: message });
  process.exit(1);
}

function readAlbums() {
  try {
    return readAlbumsFile(ALBUMS);
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

/** Argumente: --name wert, --schalter, Rest = Dateien */
function parseArgs(args, flags = []) {
  const options = { files: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) { options.files.push(arg); continue; }
    const name = arg.slice(2);
    if (flags.includes(name)) options[name] = true;
    else options[name] = args[++i];
  }
  if (options.album && !options.entry) options.entry = options.album;   // alter Name
  return options;
}

const isValidId = (id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);

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

/** Metadaten einer Datei: Maße (nach EXIF-Drehung) + Aufnahmedaten. EXIF aus dem Original, HEIC aus der Datei selbst. */
async function describe(file) {
  const source = await openImage(file);
  const meta = await sharp(source).metadata();
  // bei HEIC stecken die Aufnahmedaten in der Originaldatei, nicht im umgewandelten JPEG
  const exifBuffer = source === file ? meta.exif : (await sharp(file).metadata().catch(() => ({}))).exif ?? meta.exif;
  const rotated = (meta.orientation ?? 1) >= 5;
  return {
    source,
    format: source === file ? meta.format : extname(file).slice(1).toLowerCase(),
    width: rotated ? meta.height : meta.width,
    height: rotated ? meta.width : meta.height,
    ...readExif(exifBuffer),
  };
}

/** Entfernung in km zwischen zwei Koordinaten */
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Passt das Aufnahmedatum zum Eintrag? Zeitraum > Datum > Jahr */
function dateMatch(entry, date) {
  if (!date) return null;
  if (entry.dateStart && entry.dateEnd && date >= entry.dateStart && date <= entry.dateEnd) return 'Zeitraum';
  if (entry.date && date.startsWith(entry.date)) return 'Datum';
  if (entry.year && date.startsWith(String(entry.year))) return 'Jahr';
  return null;
}

/**
 * Vorschläge, zu welchem Eintrag ein Bild gehört – nach GPS (unter 150 km) und Aufnahmedatum.
 * Beste zuerst: Ort + Zeitraum vor Ort + Jahr vor nur Zeitraum vor nur Ort.
 */
function suggestEntries(entries, { gps, date }) {
  const RANK = { Zeitraum: 3, Datum: 3, Jahr: 1 };
  return entries
    .filter((entry) => entry.kind !== 'frame')
    .map((entry) => {
      const km = gps && entry.coords ? Math.round(distanceKm(gps, entry.coords)) : null;
      const near = km != null && km < NEAR_KM;
      const when = dateMatch(entry, date);
      const score = (near ? 2 : 0) + (RANK[when] ?? 0);
      const reasons = [near && `${km} km entfernt`, when && `${when} passt`].filter(Boolean);
      return { id: entry.id, name: entry.name, score, km, reason: reasons.join(', ') };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.km ?? 1e9) - (b.km ?? 1e9))
    .slice(0, 3)
    .map(({ score, ...rest }) => rest);
}

/** Nächste freie Nummer <entry>-NN in Ordner und albums.json */
function nextNumber(entryId, entry) {
  const pattern = new RegExp(`^${entryId}-(\\d+)(?:-${SMALL_WIDTH})?\\.\\w+$`);
  const names = [
    ...(existsSync(join(IMAGES, entryId)) ? readdirSync(join(IMAGES, entryId)) : []),
    ...(entry?.images ?? []).map((image) => image.file),
  ];
  const fromFiles = names.map((name) => Number(name.match(pattern)?.[1] ?? 0));
  const fromIds = (entry?.images ?? []).map((image) => Number(image.id) || 0);
  return Math.max(0, ...fromFiles, ...fromIds) + 1;
}

/** Original nach _eingang/erledigt/ verschieben (nur wenn es im Eingangsordner oder einem Unterordner lag); Präfix = Eintrag */
function archive(file, entryId) {
  const folder = resolve(file, '..');
  const inInbox = folder === resolve(INBOX) || (folder.startsWith(resolve(INBOX) + sep) && !folder.startsWith(resolve(DONE)));
  if (!inInbox) return null;
  mkdirSync(DONE, { recursive: true });
  const name = basename(file).startsWith(`${entryId}__`) ? basename(file) : `${entryId}__${basename(file)}`;
  let target = join(DONE, name);
  if (existsSync(target)) target = join(DONE, `${basename(name, extname(name))}-${Date.now()}${extname(name)}`);
  renameSync(file, target);
  return target;
}

/**
 * Wandelt ein Bild um: images/<entry>/<entry>-NN.webp (lange Kante 2400) + -1200.webp (1200 breit).
 * .rotate() dreht nach EXIF-Ausrichtung; sharp wandelt nach sRGB und schreibt KEINE Metadaten (auch kein GPS).
 */
async function writeWebp(source, entryId, entry) {
  const folder = join(IMAGES, entryId);
  mkdirSync(folder, { recursive: true });
  let number = nextNumber(entryId, entry);
  let imageId;
  let name;
  do {
    imageId = String(number).padStart(2, '0');
    name = `${entryId}-${imageId}`;
    number++;
  } while (existsSync(join(folder, `${name}.webp`)) || entry?.images.some((image) => image.id === imageId));

  const large = await sharp(source).rotate()
    .resize({ width: LARGE_EDGE, height: LARGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY_LARGE, effort: 5 })
    .toFile(join(folder, `${name}.webp`));
  const small = await sharp(source).rotate()
    .resize({ width: SMALL_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY_SMALL, effort: 5 })
    .toFile(join(folder, `${name}-${SMALL_WIDTH}.webp`));

  return {
    imageId,
    file: `${name}.webp`,
    width: large.width,
    height: large.height,
    files: [`images/${entryId}/${name}.webp`, `images/${entryId}/${name}-${SMALL_WIDTH}.webp`],
    sizeKb: { large: Math.round(large.size / 1024), small: Math.round(small.size / 1024) },
  };
}

/** Bild-Objekt für albums.json in fester Feldreihenfolge; leere optionale Felder entfallen */
function imageRecord({ id, file, width, height, title, alt, tags, exif }) {
  const record = { id, file, width, height };
  if (title) record.title = title;
  record.alt = alt ?? '';
  if (tags?.length) record.tags = tags;
  if (exif) record.exif = exif;
  return record;
}

/**
 * Fragen im Terminal stellen. Antworten werden zeilenweise gepuffert – so funktioniert es auch, wenn die
 * Antworten aus einer Datei kommen (node tools/images.mjs import < antworten.txt). Endet die Eingabe vorzeitig,
 * bricht der Import mit einer Meldung ab (bereits eingetragene Bilder bleiben erhalten).
 */
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];
  const waiting = [];
  let closed = false;
  rl.on('line', (line) => (waiting.length ? waiting.shift().resolve(line) : lines.push(line)));
  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift().reject(new Error('Eingabe beendet'));
  });
  const next = () => {
    if (lines.length) return Promise.resolve(lines.shift());
    if (closed) return Promise.reject(new Error('Eingabe beendet'));
    return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
  };
  return {
    async question(text) {
      rl.setPrompt(text);
      rl.prompt();
      const answer = await next();
      if (!process.stdin.isTTY) process.stdout.write(`${answer}\n`);   // umgeleitete Antworten sichtbar machen
      return answer;
    },
    close: () => rl.close(),
  };
}

/** Felder nach einem bestimmten Feld einfügen (z. B. dateStart/dateEnd hinter year) */
function insertAfter(object, afterKey, fields) {
  const result = {};
  let inserted = false;
  for (const [key, value] of Object.entries(object)) {
    if (key in fields) continue;
    result[key] = value;
    if (key === afterKey) { Object.assign(result, fields); inserted = true; }
  }
  if (!inserted) Object.assign(result, fields);
  return result;
}

/** Zeitraum aus Aufnahmedaten: ein Tag → { date }, mehrere → { dateStart, dateEnd } */
function dateFields(dates) {
  const sorted = dates.filter(Boolean).sort();
  if (!sorted.length) return null;
  const [first, last] = [sorted[0], sorted.at(-1)];
  return first === last ? { date: first } : { dateStart: first, dateEnd: last };
}

// ---------- inspect ----------

async function inspect(args) {
  const files = args.length ? args.map(findFile) : inboxFiles();
  if (!files.length) {
    print({ files: [], hint: 'Keine Bilder gefunden. Exporte nach images/_eingang/ legen (JPEG, TIFF, PNG, HEIC, WebP).' });
    return;
  }
  const { entries = [] } = readAlbums();
  mkdirSync(PREVIEWS, { recursive: true });

  const results = [];
  for (const file of files) {
    try {
      const info = await describe(file);
      // Vorschau zum Ansehen (kleines JPEG, richtig gedreht)
      const preview = join(PREVIEWS, `${basename(file, extname(file))}.jpg`);
      await sharp(info.source).rotate().resize({ width: 1024, height: 1024, fit: 'inside' }).jpeg({ quality: 78 }).toFile(preview);

      const warnings = [];
      const longEdge = Math.max(info.width, info.height);
      if (longEdge < SMALL_WIDTH) warnings.push(`Sehr klein (${longEdge} px) – wirkt auf großen Bildschirmen unscharf.`);
      else if (longEdge < LARGE_EDGE) warnings.push(`Lange Kante ${longEdge} px (< ${LARGE_EDGE}) – wird nicht vergrößert.`);
      if (!info.exif) warnings.push('Keine Aufnahmedaten in der Datei – analog/Scan? Werte bei Nici erfragen, nicht schätzen.');

      results.push({
        file,
        name: basename(file),
        width: info.width,
        height: info.height,
        orientation: info.width >= info.height ? 'quer' : 'hoch',
        format: info.format,
        date: info.date,
        gps: info.gps,
        cameraRaw: info.cameraRaw,
        exif: info.exif,
        suggestions: suggestEntries(entries, info),
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

async function convert(args) {
  const options = parseArgs(args);
  if (!options.entry) fail('Bitte Eintrag angeben: --entry <id>');
  if (!isValidId(options.entry)) fail(`Ungültige Eintrags-ID „${options.entry}“ (nur Kleinbuchstaben, Ziffern, Bindestriche).`);
  if (!options.files.length) fail('Keine Dateien angegeben.');
  const entryId = options.entry;
  const entry = (readAlbums().entries ?? []).find((e) => e.id === entryId);

  const results = [];
  for (const file of options.files.map(findFile)) {
    try {
      const info = await describe(file);
      const out = await writeWebp(info.source, entryId, entry);
      entry?.images.push({ id: out.imageId, file: out.file });   // damit die nächste Nummer stimmt
      results.push({
        source: basename(file),
        archivedTo: archive(file, entryId),
        files: out.files,
        sizeKb: out.sizeKb,
        date: info.date,
        // fertig für albums.json – Titel, Alt-Text und Tags ergänzt Claude nach Rückfrage
        image: imageRecord({ id: out.imageId, file: out.file, width: out.width, height: out.height, exif: info.exif }),
        missingExif: info.exif ? EXIF_FIELDS.filter(({ key }) => info.exif[key] == null).map(({ key }) => key) : 'alle',
      });
    } catch (error) {
      results.push({ source: basename(file), error: error.message });
    }
  }
  print({ entry: entryId, entryInJson: Boolean(entry), results });
}

// ---------- import (interaktiv) ----------

async function importImages(args) {
  const options = parseArgs(args);
  const files = options.files.length ? options.files.map(findFile) : inboxFiles();
  if (!files.length) {
    console.log('Keine Bilder im Eingangsordner. Exporte nach images/_eingang/ legen und erneut starten.');
    return;
  }

  const data = readAlbums();
  const entries = data.entries ?? [];
  const collectionIds = new Set((data.collections ?? []).map((c) => c.id));
  const rl = createPrompter();
  const ask = async (question, fallback = '') => {
    const answer = (await rl.question(fallback ? `  ${question} [${fallback}]: ` : `  ${question}: `)).trim();
    return answer || fallback;
  };
  const yes = async (question, fallback = 'n') => (await ask(`${question} (j/n)`, fallback)).toLowerCase().startsWith('j');

  console.log(`\n${files.length} Bild(er). Enter übernimmt den Vorschlag in [Klammern], leer lassen = unbekannt. „x“ überspringt ein Bild.\n`);
  const touched = new Map();      // entryId → Aufnahmedaten der neuen Bilder
  const demoAsked = new Set();

  try {
    for (const [index, file] of files.entries()) {
      let info;
      try {
        info = await describe(file);
      } catch (error) {
        console.log(`✗ ${basename(file)}: ${error.message}\n`);
        continue;
      }
      console.log(`── ${index + 1}/${files.length}  ${basename(file)}  (${info.width}×${info.height}, ${info.width >= info.height ? 'quer' : 'hoch'}${info.date ? `, ${info.date}` : ''}${info.exif?.camera ? `, ${info.exif.camera}` : ''})`);

      // 1. Eintrag
      const suggestions = suggestEntries(entries, info);
      suggestions.forEach((s) => console.log(`  Vorschlag: ${s.id} (${s.name}) – ${s.reason}`));
      let entry = null;
      while (!entry) {
        const answer = await ask('Eintrag (id)', options.entry ?? suggestions[0]?.id ?? '');
        if (answer === 'x') break;
        entry = entries.find((e) => e.id === answer) ?? null;
        if (!entry) console.log(`  „${answer}“ gibt es nicht. Neue Einträge legt Claude an (Skill „bilder-einpflegen“), oder id prüfen.`);
      }
      if (!entry) { console.log('  übersprungen\n'); continue; }
      if (info.date && entry.year && !info.date.startsWith(String(entry.year))) {
        console.log(`  ⚠ Aufgenommen ${info.date}, der Eintrag ist aber von ${entry.year} – vielleicht eine andere Reise?`);
      }

      // 2. Aufnahmedaten: aus der Datei, Fehlendes erfragen – nie schätzen
      let exif;
      if (!info.exif && await yes('Keine Aufnahmedaten in der Datei. Analoges Bild?')) {
        exif = { camera: null, lens: null, focal: null, aperture: null, shutter: null, iso: null, film: null, source: 'manual' };
        for (const field of ANALOG_FIELDS) exif[field.key] = (await ask(`${field.label} (z. B. ${field.example})`)) || null;
      } else {
        exif = info.exif ? { ...info.exif } : { camera: null, lens: null, focal: null, aperture: null, shutter: null, iso: null, film: null, source: 'manual' };
        const fromFile = Boolean(info.exif);
        let manual = 0;
        for (const field of EXIF_FIELDS) {
          if (exif[field.key] != null) continue;
          const answer = await ask(`${field.label} fehlt (z. B. ${field.example})`);
          if (!answer) continue;
          exif[field.key] = field.number && Number.isFinite(Number(answer.replace(',', '.'))) ? Number(answer.replace(',', '.')) : answer;
          manual++;
        }
        exif.source = fromFile ? (manual ? 'mixed' : 'file') : 'manual';
      }
      if (['camera', 'lens', 'focal', 'aperture', 'shutter', 'iso', 'film'].every((key) => exif[key] == null)) exif = null;
      if (exif) console.log(`  Aufnahmedaten: ${[exif.camera, exif.lens, exif.film, exif.focal && `${exif.focal} mm`, exif.aperture && `ƒ/${exif.aperture}`, exif.shutter && `${exif.shutter} s`, exif.iso && `ISO ${exif.iso}`].filter(Boolean).join(' · ')}`);

      // 3. Titel, Alt-Text, Tags
      const title = await ask('Titel (optional)');
      let alt = '';
      while (!alt) {
        alt = await ask('Alt-Text – was ist zu sehen? (für Screenreader)');
        if (!alt && await yes('Ohne Alt-Text weiter? Er fehlt dann auf der Seite')) break;
      }
      const tags = (await ask('Tags mit Komma, z. B. wildlife, analog (optional)'))
        .split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean)
        .filter((tag) => {
          const known = collectionIds.has(tag) || TECH_TAGS.includes(tag);
          if (!known) console.log(`  ⚠ Tag „${tag}“ ist weder Collection noch Technik-Tag – weggelassen.`);
          return known;
        });

      // 4. Demo-Bilder des Eintrags ersetzen? (einmal pro Eintrag fragen)
      const demos = entry.images.filter((image) => image.demo != null).length;
      if (demos && !demoAsked.has(entry.id)) {
        demoAsked.add(entry.id);
        if (await yes(`${entry.id} hat noch ${demos} Demo-Bild(er). Entfernen?`, 'j')) {
          entry.images = entry.images.filter((image) => image.demo == null);
          entry.cover = 0;
        }
      }

      // 5. Umwandeln, eintragen, Original ablegen
      const out = await writeWebp(info.source, entry.id, entry);
      entry.images.push(imageRecord({ id: out.imageId, file: out.file, width: out.width, height: out.height, title, alt, tags, exif }));
      if (entry.cover != null && !entry.images[entry.cover]) entry.cover = 0;
      writeAlbumsFile(ALBUMS, data);   // nach jedem Bild speichern – ein Abbruch verliert nichts
      archive(file, entry.id);
      if (!touched.has(entry.id)) touched.set(entry.id, []);
      touched.get(entry.id).push(info.date);
      console.log(`  ✓ ${out.files[0]} (${out.width}×${out.height}, ${out.sizeKb.large} KB) – in albums.json als ${entry.id}/${out.imageId}\n`);
    }

    // 6. Zeitraum aus den Aufnahmedaten übernehmen (nur wenn der Eintrag noch keinen hat)
    for (const [entryId, dates] of touched) {
      const entry = entries.find((e) => e.id === entryId);
      const fields = dateFields(dates);
      if (!fields || entry.date || entry.dateStart) continue;
      const text = fields.date ?? `${fields.dateStart} bis ${fields.dateEnd}`;
      if (await yes(`${entryId}: Zeitraum aus den Aufnahmedaten eintragen (${text})?`)) {
        entries[entries.indexOf(entry)] = insertAfter(entry, 'year', fields);
        writeAlbumsFile(ALBUMS, data);
      }
    }
  } catch (error) {
    if (error.message !== 'Eingabe beendet') throw error;
    console.log('\nEingabe beendet – Import abgebrochen. Bereits eingetragene Bilder bleiben erhalten.');
  } finally {
    rl.close();
  }

  console.log(touched.size
    ? `Fertig: ${[...touched].map(([id, dates]) => `${dates.length} Bild(er) in ${id}`).join(', ')}.\nPrüfen: node tools/images.mjs check · Ansehen: npx serve . → http://localhost:3000/entry.html?id=${[...touched.keys()][0]}`
    : 'Nichts eingetragen.');
}

// ---------- backfill ----------

/** Kleiner Graustufen-Fingerabdruck (16×16) zum Wiedererkennen eines Bildes in seiner WebP-Fassung */
async function fingerprint(file) {
  return sharp(file).rotate().resize(16, 16, { fit: 'fill' }).greyscale().raw().toBuffer();
}

function difference(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;   // mittlere Abweichung 0–255
}

/**
 * Aufnahmedaten für schon eingepflegte Bilder nachtragen: Die Originale in _eingang/erledigt/<präfix>__…
 * werden ihren WebP-Fassungen per Bildvergleich zugeordnet (Dateinamen verraten die Reihenfolge nicht).
 */
async function backfill(args) {
  const options = parseArgs(args, ['dates', 'force', 'dry']);
  if (!options.entry) fail('Bitte Eintrag angeben: --entry <id>');
  const data = readAlbums();
  const entry = (data.entries ?? []).find((e) => e.id === options.entry);
  if (!entry) fail(`Eintrag „${options.entry}“ gibt es nicht.`);

  const prefixes = options.prefix ? [options.prefix] : [entry.id, entry.id.replace(/-\d{4}$/, '')];
  const originals = existsSync(DONE)
    ? readdirSync(DONE).filter((name) => prefixes.some((p) => name.startsWith(`${p}__`)) && INPUT_TYPES.has(extname(name).toLowerCase()))
    : [];
  if (!originals.length) fail(`Keine Originale in images/_eingang/erledigt/ mit Präfix ${prefixes.map((p) => `„${p}__“`).join(' oder ')}.`);

  const own = entry.images.filter((image) => image.demo == null);
  const webps = await Promise.all(own.map((image) => fingerprint(join(IMAGES, entry.id, image.file))));
  const infos = [];
  for (const name of originals) {
    const file = join(DONE, name);
    infos.push({ name, ...(await describe(file)), print: await fingerprint(file) });
  }

  // Paare nach kleinster Abweichung vergeben (jedes Original höchstens einmal)
  const pairs = [];
  own.forEach((image, i) => infos.forEach((info, j) => pairs.push({ i, j, diff: difference(webps[i], info.print) })));
  pairs.sort((a, b) => a.diff - b.diff);
  const usedImages = new Set();
  const usedOriginals = new Set();
  const matches = [];
  for (const pair of pairs) {
    if (usedImages.has(pair.i) || usedOriginals.has(pair.j)) continue;
    usedImages.add(pair.i);
    usedOriginals.add(pair.j);
    matches.push(pair);
  }

  const report = [];
  for (const { i, j, diff } of matches.sort((a, b) => a.i - b.i)) {
    const image = own[i];
    const info = infos[j];
    const sure = diff < 12;   // Erfahrungswert: gleiches Bild ≈ 1–4, anderes Bild > 25
    const action = !sure ? 'unsicher – nicht eingetragen'
      : image.exif && !options.force ? 'hat schon Aufnahmedaten – übersprungen (--force überschreibt)'
        : !info.exif ? 'Original ohne Aufnahmedaten'
          : 'eingetragen';
    if (action === 'eingetragen') {
      const { exif, ...rest } = image;
      Object.keys(image).forEach((key) => delete image[key]);
      Object.assign(image, rest, { exif: info.exif });
    }
    report.push({ image: `${entry.id}/${image.id}`, title: image.title, original: info.name, date: info.date, diff: +diff.toFixed(1), action, exif: info.exif });
  }

  // Zeitraum vorschlagen (eintragen nur mit --dates und wenn noch keiner da ist)
  const fields = dateFields(infos.map((info) => info.date));
  let dates = fields ? { suggestion: fields, written: false } : null;
  if (fields && options.dates && !entry.date && !entry.dateStart) {
    data.entries[data.entries.indexOf(entry)] = insertAfter(entry, 'year', fields);
    dates.written = true;
  }

  if (!options.dry) writeAlbumsFile(ALBUMS, data);
  print({ entry: entry.id, dry: Boolean(options.dry), originals: originals.length, ownImages: own.length, report, dates });
}

// ---------- check ----------

async function check() {
  const data = readAlbums();
  const errors = [];
  const warnings = [];
  if (!data.entries) fail('albums.json hat kein "entries" – noch das alte Format mit "albums"?');

  const collectionIds = new Set((data.collections ?? []).map((c) => c.id));
  const KINDS = ['trip', 'shoot', 'frame', 'series'];
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
    for (const key of ['date', 'dateStart', 'dateEnd']) {
      if (entry[key] != null && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(entry[key])) errors.push(`${where}: ${key} „${entry[key]}“ – Format JJJJ-MM-TT oder JJJJ-MM.`);
    }
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
      if (!image.exif) warnings.push(`${label}: keine Aufnahmedaten (backfill oder von Hand ergänzen).`);
      const large = join(IMAGES, entry.id, image.file);
      const small = large.replace(/(\.\w+)$/, `-${SMALL_WIDTH}$1`);
      referenced.add(basename(large)).add(basename(small));
      if (!existsSync(large)) { errors.push(`${label}: Datei fehlt (images/${entry.id}/${image.file}).`); continue; }
      if (image.width > SMALL_WIDTH && !existsSync(small)) errors.push(`${label}: kleine Fassung -${SMALL_WIDTH} fehlt.`);
      const meta = await sharp(large).metadata();
      if (meta.width !== image.width || meta.height !== image.height) {
        errors.push(`${label}: Maße in albums.json ${image.width}×${image.height}, Datei hat ${meta.width}×${meta.height}.`);
      }
      // Veröffentlichte Dateien dürfen keine Metadaten tragen (Datenschutz: GPS, Seriennummern)
      for (const file of [large, small].filter(existsSync)) {
        const { exif, xmp, iptc } = await sharp(file).metadata();
        if (exif || xmp || iptc) errors.push(`${label}: ${basename(file)} enthält noch Metadaten (EXIF/XMP/IPTC, evtl. GPS) – neu umwandeln.`);
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
    withExif: data.entries.reduce((sum, e) => sum + (e.images ?? []).filter((i) => i.exif).length, 0),
  };
  print({ ok: errors.length === 0, totals, errors, warnings });
  if (errors.length) process.exitCode = 1;
}

// ---------- Start ----------

const [command, ...args] = process.argv.slice(2);
const commands = { import: importImages, inspect, convert, backfill, check };
if (!commands[command]) fail('Befehl: import | inspect | convert --entry <id> <dateien…> | backfill --entry <id> | check');
await commands[command](args);
