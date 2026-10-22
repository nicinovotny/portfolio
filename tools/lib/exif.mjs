// Aufnahmedaten aus den Originaldateien lesen (nie aus den fertigen WebP – die haben keine mehr)
// und für data/albums.json aufbereiten ("exif" am Bild, siehe docs/Umbau-Spezifikation.md, Abschnitt 12).
// Fehlende Werte werden NICHT geschätzt, sie bleiben null.

import exifReader from 'exif-reader';

// Kameras schreiben interne Modellcodes in die Datei – hier die Namen, unter denen man sie kennt.
// Neue Kamera? Code aus `node tools/images.mjs inspect` (Feld cameraRaw) hier ergänzen.
const CAMERA_NAMES = {
  'ILCE-7RM3': 'Sony α7R III',
  'ILCE-7RM3A': 'Sony α7R III',
  'ILCE-7M5': 'Sony α7 V',
  'ILCE-7M4': 'Sony α7 IV',
  'NIKON D750': 'Nikon D750',
  'NIKON D3300': 'Nikon D3300',
  'X100VI': 'Fujifilm X100VI',
  'FC3170': 'DJI Mavic Air 2',
};

// Herstellernamen in normaler Schreibweise
const MAKERS = { SONY: 'Sony', NIKON: 'Nikon', 'NIKON CORPORATION': 'Nikon', FUJIFILM: 'Fujifilm', CANON: 'Canon', 'OLYMPUS CORPORATION': 'Olympus' };

/** Grad/Minuten/Sekunden + Himmelsrichtung → Dezimalgrad */
function toDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const value = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ['S', 'W'].includes(ref) ? -value : value;
}

/** "SONY" + "ILCE-7RM3" → "Sony α7R III"; Unbekanntes: Hersteller + Modell (ohne doppelten Hersteller) */
export function cameraName(make, model) {
  const cleanModel = String(model ?? '').trim();
  if (!cleanModel && !make) return null;
  if (CAMERA_NAMES[cleanModel]) return CAMERA_NAMES[cleanModel];
  const maker = MAKERS[String(make ?? '').trim().toUpperCase()] ?? String(make ?? '').trim();
  const withoutMaker = cleanModel.replace(new RegExp(`^${maker}\\s*`, 'i'), '');
  return [maker, withoutMaker].filter(Boolean).join(' ') || null;
}

/** Objektivname aufräumen: "24-70mm F2.8 DG DN | Art 019" → "24-70mm F2.8 DG DN Art 019" */
function lensName(lens) {
  const clean = String(lens ?? '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return clean && !/^-+$/.test(clean) ? clean : null;
}

/** 0.00625 → "1/160", 0.3333 → "1/3", 5 → "5", 2.5 → "2.5" */
export function shutterText(seconds) {
  if (!(seconds > 0)) return null;
  if (seconds >= 1) return String(+seconds.toFixed(1));
  return `1/${Math.round(1 / seconds)}`;
}

/** Zahl mit höchstens einer Nachkommastelle (14.6 mm, ƒ/5.6) */
const round1 = (value) => (typeof value === 'number' && value > 0 ? +value.toFixed(1) : null);

/**
 * Liest die Metadaten aus dem EXIF-Block einer Datei (sharp: metadata().exif).
 * @returns { date, gps, cameraRaw, exif } – exif im Format von albums.json (alle Felder, fehlende null)
 */
export function readExif(buffer) {
  const empty = { date: null, gps: null, cameraRaw: null, exif: null };
  if (!buffer) return empty;
  let raw;
  try {
    raw = exifReader(buffer);
  } catch {
    return empty;
  }
  const image = raw.Image ?? {};
  const photo = raw.Photo ?? {};
  const lat = toDecimal(raw.GPSInfo?.GPSLatitude, raw.GPSInfo?.GPSLatitudeRef);
  const lon = toDecimal(raw.GPSInfo?.GPSLongitude, raw.GPSInfo?.GPSLongitudeRef);
  const taken = photo.DateTimeOriginal ?? image.DateTime;
  const iso = photo.ISOSpeedRatings ?? photo.PhotographicSensitivity;

  const exif = {
    camera: cameraName(image.Make, image.Model),
    lens: lensName(photo.LensModel),
    focal: round1(photo.FocalLength),
    aperture: round1(photo.FNumber),
    shutter: shutterText(photo.ExposureTime),
    iso: Number.isFinite(Array.isArray(iso) ? iso[0] : iso) ? Number(Array.isArray(iso) ? iso[0] : iso) : null,
    film: null,
    source: 'file',
  };
  const hasAny = ['camera', 'lens', 'focal', 'aperture', 'shutter', 'iso'].some((key) => exif[key] != null);

  return {
    // exif-reader liest die Ortszeit der Kamera als UTC – das Datum stimmt so
    date: taken instanceof Date && !Number.isNaN(taken.valueOf()) ? taken.toISOString().slice(0, 10) : null,
    gps: lat != null && lon != null ? { lat: +lat.toFixed(4), lon: +lon.toFixed(4) } : null,
    cameraRaw: [image.Make, image.Model].filter(Boolean).join(' ').trim() || null,
    exif: hasAny ? exif : null,
  };
}

/** Felder, die beim Import abgefragt werden, wenn sie in der Datei fehlen (Reihenfolge = Abfrage) */
export const EXIF_FIELDS = [
  { key: 'camera', label: 'Kamera', example: 'Sony α7R III' },
  { key: 'lens', label: 'Objektiv', example: 'FE 24-70mm F2.8 GM' },
  { key: 'focal', label: 'Brennweite in mm', example: '35', number: true },
  { key: 'aperture', label: 'Blende (Zahl hinter ƒ/)', example: '8', number: true },
  { key: 'shutter', label: 'Belichtungszeit in s', example: '1/250' },
  { key: 'iso', label: 'ISO', example: '100', number: true },
];

/** Felder für analoge Bilder (Kamera, Objektiv, Film statt Belichtungswerten) */
export const ANALOG_FIELDS = [
  { key: 'camera', label: 'Kamera', example: 'Canon AE-1' },
  { key: 'lens', label: 'Objektiv', example: 'FD 50mm f/1.8' },
  { key: 'film', label: 'Film', example: 'Kodak Portra 400' },
];
