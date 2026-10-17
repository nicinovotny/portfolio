// data/albums.json lesen und im gewohnten, kompakten Stil schreiben:
// ein Bild pro Zeile, ausgerichtete Regionen, Einträge mit einem Feld pro Zeile.
// So bleiben Änderungen durch die Werkzeuge im Git-Verlauf gut lesbar.

import { readFileSync, writeFileSync } from 'node:fs';

/** Kurzform in einer Zeile: { "a": 1, "b": [1, 2] } */
function inline(value) {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value && typeof value === 'object') {
    const parts = Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${inline(item)}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

/** Objekt mit einem Feld pro Zeile; Felder in "multiline" werden als Liste mit einem Element pro Zeile geschrieben */
function block(object, indent, multiline = []) {
  const pad = ' '.repeat(indent);
  const lines = Object.entries(object).map(([key, value]) => {
    if (multiline.includes(key) && Array.isArray(value) && value.length) {
      return `${pad}  ${JSON.stringify(key)}: [\n${value.map((item) => `${pad}    ${inline(item)}`).join(',\n')}\n${pad}  ]`;
    }
    return `${pad}  ${JSON.stringify(key)}: ${inline(value)}`;
  });
  return `${pad}{\n${lines.join(',\n')}\n${pad}}`;
}

/** Regionen ausgerichtet wie bisher: "europe":          { "name": "Europa" }, */
function regionsBlock(regions) {
  const entries = Object.entries(regions);
  const keyWidth = Math.max(...entries.map(([id]) => JSON.stringify(id).length + 1));
  const nameWidth = Math.max(...entries.filter(([, r]) => r.parent).map(([, r]) => JSON.stringify(r.name).length + 1));
  const lines = entries.map(([id, region]) => {
    const key = `${JSON.stringify(id)}:`.padEnd(keyWidth);
    const rest = Object.entries(region).filter(([field]) => !['name', 'parent'].includes(field));
    let body = region.parent
      ? `"name": ${`${JSON.stringify(region.name)},`.padEnd(nameWidth)} "parent": ${JSON.stringify(region.parent)}`
      : `"name": ${JSON.stringify(region.name)}`;
    if (rest.length) body += `, ${rest.map(([field, value]) => `${JSON.stringify(field)}: ${inline(value)}`).join(', ')}`;
    return `    ${key} { ${body} }`;
  });
  return `{\n${lines.join(',\n')}\n  }`;
}

export function readAlbumsFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function formatAlbums(data) {
  const parts = [];
  if (data.collections) {
    parts.push(`  "collections": [\n${data.collections.map((c) => block(c, 4, ['heroFavorites'])).join(',\n')}\n  ]`);
  }
  if (data.regions) parts.push(`  "regions": ${regionsBlock(data.regions)}`);
  if (data.entries) {
    parts.push(`  "entries": [\n${data.entries.map((e) => block(e, 4, ['images'])).join(',\n')}\n  ]`);
  }
  // unbekannte Felder oben in der Datei nicht verlieren
  for (const [key, value] of Object.entries(data)) {
    if (!['collections', 'regions', 'entries'].includes(key)) parts.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')}`);
  }
  return `{\n${parts.join(',\n\n')}\n}\n`;
}

export function writeAlbumsFile(path, data) {
  const text = formatAlbums(data);
  JSON.parse(text);   // Sicherheitsnetz: nur gültiges JSON schreiben
  writeFileSync(path, text);
}
