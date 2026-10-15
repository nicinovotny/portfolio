// Natural-Earth-1-Projektion (wie d3.geoNaturalEarth1), ohne Bibliothek.
// Rechnet Längen-/Breitengrad in Kartenkoordinaten um und zurück.
// scale/translate kommen aus data/map/world.json (vom Generator in tools/ erzeugt).

const RAD = Math.PI / 180;

// Formel der Natural-Earth-1-Projektion (Werte in Radiant)
function raw(lambda, phi) {
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;
  return [
    lambda * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))),
    phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))),
  ];
}

// Umkehrung: Breitengrad per Newton-Verfahren, dann Längengrad direkt
function rawInvert(x, y) {
  let phi = y;
  let delta;
  let i = 25;
  do {
    const phi2 = phi * phi;
    const phi4 = phi2 * phi2;
    delta = (phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))) - y)
      / (1.007226 + phi2 * (0.015085 * 3 + phi4 * (-0.044475 * 7 + 0.028874 * 9 * phi2 - 0.005916 * 11 * phi4)));
    phi -= delta;
  } while (Math.abs(delta) > 1e-6 && --i > 0);
  const phi2 = phi * phi;
  return [
    x / (0.8707 + phi2 * (-0.131979 + phi2 * (-0.013791 + phi2 * phi2 * phi2 * (0.003971 - 0.001529 * phi2)))),
    phi,
  ];
}

/** Erzeugt project(lon, lat) → [x, y] und invert(x, y) → [lon, lat]. */
export function createProjection({ scale, translate: [tx, ty] }) {
  return {
    project(lon, lat) {
      const [x, y] = raw(lon * RAD, lat * RAD);
      return [tx + scale * x, ty - scale * y];
    },
    invert(px, py) {
      const [lambda, phi] = rawInvert((px - tx) / scale, (ty - py) / scale);
      return [lambda / RAD, phi / RAD];
    },
    /** Kartenkoordinaten pro Grad am Äquator – zum Umrechnen von Mindestausschnitten */
    unitsPerDegree: scale * RAD * 0.8707,
  };
}

/**
 * Gradnetz als SVG-Pfad. Breitenkreise sind in dieser Projektion gerade Linien,
 * Längenkreise leicht gebogen – sie werden alle 2° abgetastet.
 */
export function graticulePath(projection, step, maxLat = 80) {
  const parts = [];
  const fmt = (n) => n.toFixed(1);
  for (let lat = -maxLat; lat <= maxLat; lat += step) {
    const [x0, y] = projection.project(-180, lat);
    const [x1] = projection.project(180, lat);
    parts.push(`M${fmt(x0)},${fmt(y)}H${fmt(x1)}`);
  }
  for (let lon = -180; lon <= 180; lon += step) {
    let d = '';
    for (let lat = -maxLat; lat <= maxLat; lat += 2) {
      const [x, y] = projection.project(lon, lat);
      d += `${d ? 'L' : 'M'}${fmt(x)},${fmt(y)}`;
    }
    parts.push(d);
  }
  return parts.join('');
}
