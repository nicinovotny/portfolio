// Zoomstufen der Karte: Welt → Kontinent → Region → einzelnes Album.
// Alle Ausschnitte und Cluster werden aus den Koordinaten in albums.json berechnet,
// neue Orte funktionieren also automatisch (sie brauchen nur "continent" und "region").

// Mindestgröße eines Ausschnitts in Grad Länge – damit immer Umgebung zur Orientierung sichtbar ist
const MIN_SPAN = { continent: 55, region: 15, album: 36 };
// Rand um die Orte eines Ausschnitts (Anteil der Ausschnittgröße)
const PADDING = 0.35;

/**
 * Baut aus Alben, Regionen und Projektion das Modell für die Karte.
 * Ergebnis: Funktionen, die für einen Ansichtszustand Ausschnitt und Marker liefern.
 */
export function createViews({ albums, regions, projection, world }) {
  // Kartenposition jedes Albums einmal berechnen
  const points = new Map(albums.map((album) => [album.id, projection.project(album.coords.lon, album.coords.lat)]));
  const albumIndex = new Map(albums.map((album, index) => [album.id, index]));

  const inContinent = (id) => albums.filter((album) => album.continent === id);
  const inRegion = (id) => albums.filter((album) => album.region === id);

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
    switch (view.level) {
      case 'continent': return frameAround(inContinent(view.id), MIN_SPAN.continent);
      case 'region': return frameAround(inRegion(view.id), MIN_SPAN.region);
      case 'album': {
        const album = albums.find((a) => a.id === view.id);
        return frameAround([album], MIN_SPAN.album, points.get(album.id));
      }
      default: return { cx: world.width / 2, cy: world.height / 2, width: world.width, height: world.height };
    }
  }

  /** Gruppiert Alben: mehrere → Cluster (Klick zoomt hinein), eines → Album-Marker */
  function group(members, key, level) {
    const groups = new Map();
    for (const album of members) {
      const id = album[key];
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(album);
    }
    return [...groups].map(([id, list]) => (list.length > 1 ? cluster(id, list, level) : albumMarker(list[0])));
  }

  function cluster(id, list, level) {
    const pts = list.map((album) => points.get(album.id));
    return {
      type: 'cluster',
      key: `${level}:${id}`,
      target: { level, id },
      name: regions[id]?.name ?? id,
      count: list.length,
      subtitle: level === 'continent'
        ? `${list.length} Alben`
        : list.map((album) => album.shortName ?? album.name).join(' · '),
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
    };
  }

  /** Marker, die in einem Ansichtszustand sichtbar sind */
  function markersFor(view) {
    if (view.level === 'world') return group(albums, 'continent', 'continent');
    if (view.level === 'continent') {
      // im gewählten Kontinent nach Regionen gruppieren, andere Kontinente bleiben Cluster
      const here = group(inContinent(view.id), 'region', 'region');
      const elsewhere = group(albums.filter((a) => a.continent !== view.id), 'continent', 'continent');
      return [...here, ...elsewhere];
    }
    // Album: wie die übergeordnete Ebene – dort ist das Album immer einzeln sichtbar,
    // entfernte Gruppen (z. B. die Alpen von den Färöer aus) bleiben Cluster
    if (view.level === 'album') return markersFor(parentOf(view));
    return albums.map(albumMarker);   // Region: alle Orte einzeln
  }

  /** Übergeordnete Ansicht (für „Rauszoomen“) */
  function parentOf(view) {
    if (view.level === 'album') {
      const album = albums.find((a) => a.id === view.id);
      return inRegion(album.region).length > 1
        ? { level: 'region', id: album.region }
        : { level: 'continent', id: album.continent };
    }
    if (view.level === 'region') return { level: 'continent', id: regions[view.id]?.continent ?? inRegion(view.id)[0].continent };
    return { level: 'world' };
  }

  /** Brotkrumen-Pfad: Welt / Europa / Alpen / Schweiz */
  function trailOf(view) {
    const trail = [];
    for (let v = view; v; v = v.level === 'world' ? null : parentOf(v)) trail.unshift(v);
    return trail.map((v) => ({ view: v, name: nameOf(v) }));
  }

  function nameOf(view) {
    if (view.level === 'world') return 'Welt';
    if (view.level === 'album') {
      const album = albums.find((a) => a.id === view.id);
      return album.shortName ?? album.name;
    }
    return regions[view.id]?.name ?? view.id;
  }

  /** Anzahl Alben in einem Ansichtszustand */
  function countOf(view) {
    if (view.level === 'continent') return inContinent(view.id).length;
    if (view.level === 'region') return inRegion(view.id).length;
    if (view.level === 'album') return 1;
    return albums.length;
  }

  /** Ansichtszustand aus der URL lesen (?ort=faroe oder ?gebiet=alps) */
  function fromUrl(search) {
    const params = new URLSearchParams(search);
    const place = params.get('ort');
    if (place && albums.some((a) => a.id === place)) return { level: 'album', id: place };
    const area = params.get('gebiet');
    if (area && regions[area]) return { level: regions[area].level === 'continent' ? 'continent' : 'region', id: area };
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
