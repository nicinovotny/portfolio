// Zoomstufen der Karte: Welt → Gebiete (beliebig verschachtelt, z. B. Europa → Alpen → Dolomiten) → Album.
// Alle Ausschnitte und Cluster werden aus albums.json berechnet: Jedes Album nennt seine innerste
// Region ("region"), jede Region ihre übergeordnete ("parent"). Neue Orte funktionieren automatisch.
//
// Ansichtszustände: { level: 'world' } · { level: 'area', id: '<region>' } · { level: 'album', id: '<album>' }

import { regionPath } from './data.js';

// Mindestgröße eines Ausschnitts in Grad Länge, nach Tiefe des Gebiets (Kontinent, Region, Unterregion …)
// – damit immer Umgebung zur Orientierung sichtbar ist
const MIN_SPAN_AREA = [55, 15, 6];
const MIN_SPAN_ALBUM = 36;
// Rand um die Orte eines Ausschnitts (Anteil der Ausschnittgröße)
const PADDING = 0.35;
// Alben an (fast) gleicher Stelle, z. B. zwei Reisen nach Seoul: Abstand der aufgefächerten Marker in px
const STACK_RADIUS = 18;

export function createViews({ albums, regions, projection, world }) {
  // Kartenposition und Regionskette jedes Albums einmal berechnen
  const points = new Map(albums.map((album) => [album.id, projection.project(album.coords.lon, album.coords.lat)]));
  const paths = new Map(albums.map((album) => [album.id, regionPath(regions, album.region)]));
  const albumIndex = new Map(albums.map((album, index) => [album.id, index]));
  const byId = new Map(albums.map((album) => [album.id, album]));

  const pathOfArea = (id) => regionPath(regions, id);
  const under = (areaId) => albums.filter((album) => paths.get(album.id).includes(areaId));
  const sameSet = (a, b) => a.length === b.length && a.every((album) => b.includes(album));

  /** Rechteck um Kartenpunkte, mit Rand und Mindestgröße */
  function frameAround(members, minSpanDeg, center) {
    const pts = members.map((album) => points.get(album.id));
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    const minSpan = minSpanDeg * projection.unitsPerDegree;
    const width = Math.max((Math.max(...xs) - Math.min(...xs)) * (1 + 2 * PADDING), minSpan);
    const height = Math.max((Math.max(...ys) - Math.min(...ys)) * (1 + 2 * PADDING), minSpan * 0.55);
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
    return { cx: world.width / 2, cy: world.height / 2, width: world.width, height: world.height };
  }

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

  function cluster(areaId, list) {
    const target = descend(areaId);
    const pts = list.map((album) => points.get(album.id));
    const names = list.map((album) => [album.shortName ?? album.name, album.year].filter(Boolean).join(' '));
    return {
      type: 'cluster',
      key: `area:${target}`,
      target: { level: 'area', id: target },
      name: regions[target]?.name ?? target,
      count: list.length,
      subtitle: list.length <= 3 ? names.join(' · ') : `${list.length} Alben`,
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

  /**
   * Marker einer Ansicht. Für jedes Album zählt die erste Region, in der sich sein Weg vom
   * gerade gezeigten Gebiet trennt: innerhalb des Gebiets die nächste Unterregion, außerhalb
   * der abzweigende Ast (z. B. von den Alpen aus „Skandinavien“). Mehrere Alben mit gleicher
   * Region → Cluster, eines → einzelner Marker.
   */
  function markersFor(view) {
    if (view.level === 'album') return markersFor(parentOf(view));
    const base = view.level === 'area' ? pathOfArea(view.id) : [];

    const groups = new Map();
    const singles = [];
    for (const album of albums) {
      const path = paths.get(album.id);
      let i = 0;
      while (i < base.length && path[i] === base[i]) i++;
      const key = path[i];
      if (key === undefined) { singles.push(album); continue; }   // Album liegt direkt in diesem Gebiet
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(album);
    }

    const markers = [
      ...singles.map(albumMarker),
      ...[...groups].map(([key, list]) => (list.length > 1 ? cluster(key, list) : albumMarker(list[0]))),
    ];
    spreadStacks(markers);
    return markers;
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

  /** Übergeordnete Ansicht (für „Rauszoomen“) – Ebenen ohne Unterschied werden übersprungen */
  function parentOf(view) {
    if (view.level === 'album') {
      // innerstes Gebiet, in dem das Album nicht allein ist
      const path = paths.get(view.id);
      for (let i = path.length - 1; i >= 0; i--) {
        if (under(path[i]).length > 1) return { level: 'area', id: path[i] };
      }
      return { level: 'world' };
    }
    if (view.level === 'area') {
      const members = under(view.id);
      const path = pathOfArea(view.id);
      for (let i = path.length - 2; i >= 0; i--) {
        if (!sameSet(under(path[i]), members)) return { level: 'area', id: path[i] };
      }
    }
    return { level: 'world' };
  }

  /** Brotkrumen-Pfad: Welt / Europa / Alpen / Dolomiten / Seiser Alm */
  function trailOf(view) {
    const trail = [];
    for (let v = view; v; v = v.level === 'world' ? null : parentOf(v)) trail.unshift(v);
    return trail.map((v) => ({ view: v, name: nameOf(v) }));
  }

  function nameOf(view) {
    if (view.level === 'world') return 'Welt';
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

  /** Ansichtszustand aus der URL lesen (?ort=faroe-2024 oder ?gebiet=alps) */
  function fromUrl(search) {
    const params = new URLSearchParams(search);
    const place = params.get('ort');
    if (place && byId.has(place)) return { level: 'album', id: place };
    const area = params.get('gebiet');
    if (area && regions[area] && under(area).length) return { level: 'area', id: descend(area) };
    return { level: 'world' };
  }

  function toUrl(view) {
    if (view.level === 'album') return `?ort=${encodeURIComponent(view.id)}`;
    if (view.level === 'world') return location.pathname;
    return `?gebiet=${encodeURIComponent(view.id)}`;
  }

  return { frameFor, markersFor, parentOf, trailOf, nameOf, countOf, fromUrl, toUrl, points };
}

/** Zwei Ansichtszustände gleich? */
export function sameView(a, b) {
  return a.level === b.level && a.id === b.id;
}
