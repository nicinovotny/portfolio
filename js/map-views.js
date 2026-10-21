// Zoomstufen der Karte: Welt → Reisegebiete → Gebiete (beliebig verschachtelt, z. B. Europa → Mitteleuropa
// → Schweiz) → Album. Alle Ausschnitte und Cluster werden aus albums.json berechnet: Jedes Album nennt seine
// innerste Region ("region"), jede Region ihre übergeordnete ("parent"). Neue Orte funktionieren automatisch.
//
// Ansichtszustände:
//   { level: 'globe' }                 ganze Welt (ganz herausgezoomt)
//   { level: 'world' }                 Startansicht: alle Reisegebiete
//   { level: 'area', id: '<region>' }  ein Gebiet
//   { level: 'album', id: '<album>' }  ein Album mit Umgebung
//
// Cluster teilen sich von selbst in ihre Unterregionen bzw. Alben auf, solange sich dabei auf dem
// Bildschirm nichts überschneidet. So bleibt es aufgeräumt, und große Bildschirme brauchen weniger Klicks.

import { canonicalId, regionPath } from './data.js';

// Mindestgröße eines Ausschnitts in Grad Länge, nach Tiefe des Gebiets (Kontinent, Region, Land …)
// – damit immer Umgebung zur Orientierung sichtbar ist
const MIN_SPAN_AREA = [55, 25, 8];
const MIN_SPAN_ALBUM = 36;
// Rand um die Orte eines Ausschnitts (Anteil der Ausschnittgröße); Startansicht knapper
const PADDING = 0.35;
const PADDING_WORLD = 0.08;
// Alben an (fast) gleicher Stelle, z. B. zwei Reisen nach Seoul: Abstand der aufgefächerten Marker in px
const STACK_RADIUS = 18;
// Geschätzte Platzbedarfe für die Überschneidungsprüfung (px), passend zu css/map.css
const MARKER = {
  album: { radius: 14, textOffset: 18 },
  cluster: { radius: 28, textOffset: 35 },
  nameCharWidth: 8.2,      // Geist Mono 11 px, gesperrt
  subCharWidth: 6.6,       // Geist Mono 10 px
  margin: 8,
};

export function createViews({ albums, regions, projection, world }) {
  // Kartenposition und Regionskette jedes Albums einmal berechnen
  const points = new Map(albums.map((album) => [album.id, projection.project(album.coords.lon, album.coords.lat)]));
  const paths = new Map(albums.map((album) => [album.id, regionPath(regions, album.region)]));
  const albumIndex = new Map(albums.map((album, index) => [album.id, index]));
  const byId = new Map(albums.map((album) => [album.id, album]));

  const pathOfArea = (id) => regionPath(regions, id);
  const under = (areaId) => albums.filter((album) => paths.get(album.id).includes(areaId));
  const sameSet = (a, b) => a.length === b.length && a.every((album) => b.includes(album));
  const isTop = (view) => view.level === 'world' || view.level === 'globe';

  // ---------- Ausschnitte ----------

  /** Rechteck um Kartenpunkte, mit Rand und Mindestgröße */
  function frameAround(members, minSpanDeg, center, padding = PADDING) {
    const pts = members.map((album) => points.get(album.id));
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    const minSpan = minSpanDeg * projection.unitsPerDegree;
    const width = Math.max((Math.max(...xs) - Math.min(...xs)) * (1 + 2 * padding), minSpan);
    const height = Math.max((Math.max(...ys) - Math.min(...ys)) * (1 + 2 * padding), minSpan * 0.55);
    const [cx, cy] = center ?? [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
    return { cx, cy, width, height };
  }

  /** Ausschnitt (Mitte + Mindestbreite/-höhe) für einen Ansichtszustand */
  function frameFor(view) {
    if (view.level === 'area') {
      const depth = pathOfArea(view.id).length - 1;
      return frameAround(under(view.id), MIN_SPAN_AREA[Math.min(depth, MIN_SPAN_AREA.length - 1)]);
    }
    if (view.level === 'album') return frameAround([byId.get(view.id)], MIN_SPAN_ALBUM, points.get(view.id));
    if (view.level === 'world') return frameAround(albums, MIN_SPAN_AREA[0], null, PADDING_WORLD);
    return { cx: world.width / 2, cy: world.height / 2, width: world.width, height: world.height };
  }

  // ---------- Gruppen ----------

  /**
   * Zielgebiet eines Clusters: so tief wie möglich, solange sich nichts ändert.
   * Beispiel: Asien enthält nur Südkorea → ein Klick auf „Asien“ fliegt direkt nach Südkorea.
   */
  function descend(areaId) {
    let id = areaId;
    for (;;) {
      const members = under(id);
      const depth = pathOfArea(id).length;
      const children = new Set(members.map((album) => paths.get(album.id)[depth]));
      const [only] = children;
      if (children.size !== 1 || only === undefined) return id;
      id = only;
    }
  }

  /**
   * Teilt Alben nach der ersten Region, in der sich ihr Weg von „base“ (Regionskette des
   * gezeigten Gebiets) trennt: innerhalb des Gebiets die nächste Unterregion, außerhalb der
   * abzweigende Ast. Alben direkt in „base“ werden einzeln gezeigt.
   */
  function groupItems(list, base) {
    const groups = new Map();
    const singles = [];
    for (const album of list) {
      const path = paths.get(album.id);
      let i = 0;
      while (i < base.length && path[i] === base[i]) i++;
      const key = path[i];
      if (key === undefined) { singles.push(album); continue; }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(album);
    }
    return [
      ...singles.map(albumMarker),
      ...[...groups].map(([key, members]) => (members.length > 1 ? cluster(key, members) : albumMarker(members[0]))),
    ];
  }

  function cluster(areaId, list) {
    const target = descend(areaId);
    const pts = list.map((album) => points.get(album.id));
    const years = list.map((album) => album.year).filter(Boolean);
    const span = years.length ? [Math.min(...years), Math.max(...years)] : null;
    const names = list.map((album) => [album.shortName ?? album.name, album.year].filter(Boolean).join(' '));
    return {
      type: 'cluster',
      key: `area:${target}`,
      target: { level: 'area', id: target },
      albums: list,
      name: regions[target]?.name ?? target,
      count: list.length,
      subtitle: list.length <= 3
        ? names.join(' · ')
        : [`${list.length} Trips`, span && (span[0] === span[1] ? span[0] : `${span[0]}–${span[1]}`)].filter(Boolean).join(' · '),
      point: [pts.reduce((s, [x]) => s + x, 0) / pts.length, pts.reduce((s, [, y]) => s + y, 0) / pts.length],
    };
  }

  function albumMarker(album) {
    return {
      type: 'album',
      key: `album:${album.id}`,
      album,
      number: albumIndex.get(album.id) + 1,
      point: points.get(album.id),
      offset: [0, 0],
    };
  }

  // ---------- Überschneidungen ----------

  /** Geschätzte Breite der Beschriftung in px (compact: Handy, dort ohne Unterzeile) */
  function textWidthOf(item, compact = false) {
    const name = item.type === 'album' ? (item.album.shortName ?? item.album.name) : item.name;
    const sub = item.type === 'album' ? `${item.album.year ?? ''} 00.0°N 00.0°W` : item.subtitle;
    return Math.max(name.length * MARKER.nameCharWidth, compact ? 0 : sub.length * MARKER.subCharWidth);
  }

  /** Ungefähre Fläche eines Markers samt Beschriftung auf dem Bildschirm */
  function boxOf(item, screen) {
    const [x, y] = screen.project(item.point);
    const spec = MARKER[item.type];
    const textWidth = textWidthOf(item);
    const m = MARKER.margin;
    return {
      x0: x - spec.radius - m,
      x1: x + spec.textOffset + textWidth + m,
      y0: y - Math.max(spec.radius, 16) - m,
      y1: y + Math.max(spec.radius, 18) + m,
    };
  }

  const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  /** Cluster aufteilen, solange die neuen Marker niemanden überdecken */
  function splitWhileRoom(items, screen) {
    let current = items;
    for (let changed = true; changed;) {
      changed = false;
      const clusters = current.filter((item) => item.type === 'cluster').sort((a, b) => b.count - a.count);
      for (const item of clusters) {
        const children = groupItems(item.albums, pathOfArea(item.target.id));
        const others = current.filter((other) => other !== item);
        const boxes = new Map([...others, ...children].map((other) => [other, boxOf(other, screen)]));
        const blocked = children.some((child) => [...others, ...children].some((other) => (
          other !== child && overlap(boxes.get(child), boxes.get(other))
        )));
        if (!blocked) {
          current = [...others, ...children];
          changed = true;
          break;
        }
      }
    }
    return current;
  }

  /** Alben an fast derselben Stelle im Kreis auffächern, damit beide anklickbar bleiben */
  function spreadStacks(markers) {
    const singles = markers.filter((m) => m.type === 'album');
    const done = new Set();
    for (const marker of singles) {
      if (done.has(marker)) continue;
      const stack = singles.filter((other) => Math.hypot(other.point[0] - marker.point[0], other.point[1] - marker.point[1]) < 0.3);
      if (stack.length < 2) continue;
      stack.forEach((m, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / stack.length;
        m.offset = [Math.round(Math.cos(angle) * STACK_RADIUS), Math.round(Math.sin(angle) * STACK_RADIUS)];
        done.add(m);
      });
    }
  }

  /** Fläche der Beschriftung (Name + Koordinaten rechts neben dem Ring, siehe .map-marker__text) */
  function textBoxOf(item, screen) {
    const [x, y] = screen.project(item.point);
    const [dx, dy] = item.offset ?? [0, 0];
    const left = x + dx + MARKER[item.type].textOffset;
    return { x0: left, x1: left + textWidthOf(item, screen.compact), y0: y + dy - 14, y1: y + dy + (screen.compact ? 4 : 22) };
  }

  /**
   * Einzelne Alben, die nicht aufgeteilt werden können (z. B. Glencoe und Edinburgh in Nordeuropa am Handy),
   * dürfen sich nicht gegenseitig überschreiben: Überdeckt eine Beschriftung eine andere, bleibt die des
   * neueren Albums stehen, die ältere erscheint erst beim Überfahren bzw. Fokus („quiet“, css/map.css).
   */
  function quietOverlaps(markers, screen) {
    const kept = [];
    const ordered = [
      ...markers.filter((m) => m.type === 'cluster'),
      ...markers.filter((m) => m.type === 'album').sort((a, b) => a.number - b.number),
    ];
    for (const marker of ordered) {
      const box = textBoxOf(marker, screen);
      marker.quiet = marker.type === 'album' && kept.some((other) => overlap(box, other));
      if (!marker.quiet) kept.push(box);
    }
  }

  /**
   * Marker einer Ansicht. „screen“ ({ project(point) → [x, y] }) beschreibt den Ausschnitt,
   * in dem sie erscheinen – damit wird geprüft, ob ein Cluster sich aufteilen darf.
   */
  function markersFor(view, screen) {
    if (view.level === 'album') return markersFor(parentOf(view), screen);
    const base = view.level === 'area' ? pathOfArea(view.id) : [];
    let markers = groupItems(albums, base);
    if (screen) markers = splitWhileRoom(markers, screen);
    spreadStacks(markers);
    if (screen) quietOverlaps(markers, screen);
    return markers;
  }

  // ---------- Navigation ----------

  /**
   * Übergeordnete Ansicht (für „Rauszoomen“). Übersprungen werden Ebenen ohne Unterschied und
   * Kontinente – die Startansicht zeigt sie ohnehin schon aufgeteilt (z. B. Nordeuropa → Welt).
   */
  function parentOf(view) {
    if (view.level === 'album') {
      // innerstes Gebiet, in dem das Album nicht allein ist
      const path = paths.get(view.id);
      for (let i = path.length - 1; i >= 1; i--) {
        if (under(path[i]).length > 1) return { level: 'area', id: path[i] };
      }
      return { level: 'world' };
    }
    if (view.level === 'area') {
      const members = under(view.id);
      const path = pathOfArea(view.id);
      for (let i = path.length - 2; i >= 1; i--) {
        if (!sameSet(under(path[i]), members)) return { level: 'area', id: path[i] };
      }
      return { level: 'world' };
    }
    return { level: 'globe' };
  }

  /** Brotkrumen-Pfad: Welt / Europa / Mitteleuropa / Schweiz / Zermatt 2025 */
  function trailOf(view) {
    const trail = [];
    for (let v = view; v; v = isTop(v) ? null : parentOf(v)) trail.unshift(v);
    return trail.map((v) => ({ view: v, name: nameOf(v) }));
  }

  function nameOf(view) {
    if (isTop(view)) return 'Welt';
    if (view.level === 'album') {
      const album = byId.get(view.id);
      return [album.shortName ?? album.name, album.year].filter(Boolean).join(' ');
    }
    return regions[view.id]?.name ?? view.id;
  }

  /** Anzahl Alben in einem Ansichtszustand */
  function countOf(view) {
    if (view.level === 'area') return under(view.id).length;
    if (view.level === 'album') return 1;
    return albums.length;
  }

  /** Ansichtszustand aus der URL lesen (?ort=faroe-2024, ?gebiet=alps oder ?gebiet=welt) */
  function fromUrl(search) {
    const params = new URLSearchParams(search);
    const place = canonicalId(params.get('ort'));   // alte ids führen weiter
    if (place && byId.has(place)) return { level: 'album', id: place };
    const area = params.get('gebiet');
    if (area === 'welt') return { level: 'globe' };
    if (area && regions[area] && under(area).length) return { level: 'area', id: descend(area) };
    return { level: 'world' };
  }

  function toUrl(view) {
    if (view.level === 'album') return `?ort=${encodeURIComponent(view.id)}`;
    if (view.level === 'world') return location.pathname;
    if (view.level === 'globe') return '?gebiet=welt';
    return `?gebiet=${encodeURIComponent(view.id)}`;
  }

  return { frameFor, markersFor, parentOf, trailOf, nameOf, countOf, fromUrl, toUrl, points };
}

/** Zwei Ansichtszustände gleich? */
export function sameView(a, b) {
  return a.level === b.level && a.id === b.id;
}
