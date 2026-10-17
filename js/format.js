// Kleine Formatierungshelfer für Labels und Readouts.

/** 62.0, -6.9 → "62°00′N 006°54′W" (wie im Mockup A2) */
export function formatCoords({ lat, lon }) {
  return `${toDms(lat, 2, 'N', 'S')} ${toDms(lon, 3, 'O', 'W')}`;
}

/** 62.0, -6.9 → "62.0°N · 6.9°W" (kurze Form für Karten-Labels) */
export function formatCoordsShort({ lat, lon }) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'O' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lon).toFixed(1)}°${ew}`;
}

/** 1 → "01" */
export function pad2(number) {
  return String(number).padStart(2, '0');
}

function toDms(value, degreeDigits, positive, negative) {
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutes = Math.round((abs - degrees) * 60);
  if (minutes === 60) { degrees += 1; minutes = 0; }
  const hemisphere = value >= 0 ? positive : negative;
  return `${String(degrees).padStart(degreeDigits, '0')}°${pad2(minutes)}′${hemisphere}`;
}

// ---------- Einträge (Trip, Shoot, Frame) ----------

/** Art eines Eintrags als UI-Label (englisch, siehe docs/Umbau-Spezifikation.md) */
export const KIND_LABELS = { trip: 'Trip', shoot: 'Shoot', frame: 'Frame', series: 'Series' };

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** "2024-08-02" → { year: 2024, month: 8, day: 2 }; "2023-03" → { year: 2023, month: 3, day: null } */
function parseDate(value) {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(value ?? ''));
  if (!match) return null;
  return { year: Number(match[1]), month: match[2] ? Number(match[2]) : null, day: match[3] ? Number(match[3]) : null };
}

/**
 * Zeitangabe eines Eintrags – nur, was in albums.json steht:
 *   dateStart + dateEnd → "Aug 2024 · 12 Tage" (bzw. "Jul–Aug 2024", über den Jahreswechsel "Dez 2024–Jan 2025")
 *   date                → "31. Okt 2023" oder "Mär 2023"
 *   sonst               → "2024" (oder leer)
 */
export function formatWhen(entry) {
  const start = parseDate(entry.dateStart);
  const end = parseDate(entry.dateEnd);
  if (start?.month && end?.month) {
    const sameYear = start.year === end.year;
    const months = start.month === end.month && sameYear
      ? `${MONTHS[start.month - 1]} ${start.year}`
      : sameYear
        ? `${MONTHS[start.month - 1]}–${MONTHS[end.month - 1]} ${end.year}`
        : `${MONTHS[start.month - 1]} ${start.year}–${MONTHS[end.month - 1]} ${end.year}`;
    if (!start.day || !end.day) return months;
    const days = Math.round((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86_400_000) + 1;
    return days > 1 ? `${months} · ${days} Tage` : `${start.day}. ${months}`;
  }
  const date = parseDate(entry.date) ?? start;
  if (date?.month) return `${date.day ? `${date.day}. ` : ''}${MONTHS[date.month - 1]} ${date.year}`;
  return entry.year ? String(entry.year) : '';
}

/** "Seoul · 2026" – Name mit Jahr für Navigation und Listen */
export function nameWithYear(entry, name = entry.name) {
  return [name, entry.year].filter(Boolean).join(' · ');
}

// ---------- Aufnahmedaten (Lightbox) ----------

/** Technik-Tags erzeugen keine Collection, nur einen Chip in der Lightbox */
export const TECH_TAGS = { analog: 'Analog' };

/** Versalien für Mono-Labels – α (Sony α7) und ƒ (Blende) bleiben klein, wie auf Kameras gedruckt */
export function monoUpper(text) {
  return String(text).replace(/[^αƒµ]+/g, (part) => part.toLocaleUpperCase('de-DE'));
}

/** 5.6 → "5.6", 8 → "8", 35.0 → "35" */
function trimNumber(value) {
  return String(Number(value));
}

/**
 * Aufnahmedaten eines Bildes ("exif" in albums.json) für die Anzeige – nur vorhandene Werte:
 *   gear:     ["Sony α7 V", "FE 24–70 mm"] bzw. analog ["Canon AE-1", "50 mm", "Kodak Portra 400"]
 *   settings: ["35 mm", "ƒ/8", "1/250 s", "ISO 100"]
 */
export function formatExif(exif) {
  if (!exif) return { gear: [], settings: [] };
  const filled = (value) => value != null && value !== '';
  const gear = [exif.camera, exif.lens, exif.film].filter(filled);
  const settings = [
    filled(exif.focal) && `${trimNumber(exif.focal)} mm`,
    filled(exif.aperture) && `ƒ/${trimNumber(exif.aperture)}`,
    filled(exif.shutter) && `${exif.shutter} s`,
    filled(exif.iso) && `ISO ${exif.iso}`,
  ].filter(Boolean);
  return { gear, settings };
}

// ---------- Collections ----------

/** Mehrzahl der Eintragsarten (Abschnittsüberschriften, Zähler) */
export const KIND_PLURALS = { trip: 'Trips', shoot: 'Shoots', frame: 'Frames', series: 'Series' };

/** Reihenfolge der Eintragsarten auf Collection-Seiten und in Zählern */
export const KIND_ORDER = ['trip', 'shoot', 'series'];

const countOf = (count, kind) => `${count} ${count === 1 ? KIND_LABELS[kind] : KIND_PLURALS[kind]}`;

/**
 * Zähler einer Collection, z. B. ["21 Trips"], ["8 Shoots"], ["21 Trips", "4 Frames"]
 * oder – nur Einzelbilder – ["23 Bilder", "aus 6 Einträgen"].
 * @param entries  Trips/Shoots der Collection (getCollectionEntries)
 * @param frames   Einzelbilder der Collection (getCollectionFrames)
 */
export function formatCollectionCounts(entries, frames) {
  const parts = KIND_ORDER
    .map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length])
    .filter(([, count]) => count)
    .map(([kind, count]) => countOf(count, kind));
  if (frames.length) {
    if (entries.length) {
      parts.push(countOf(frames.length, 'frame'));
    } else {
      const sources = new Set(frames.map(({ entry }) => entry.id)).size;
      parts.push(`${frames.length} ${frames.length === 1 ? 'Bild' : 'Bilder'}`);
      if (sources > 1) parts.push(`aus ${sources} Einträgen`);
    }
  }
  return parts;
}
