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
