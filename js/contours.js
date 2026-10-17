// Höhenlinien-Marker (Karte, Kartenstreifen der Startseite): leicht wellige, geschlossene Kurven,
// deren Form fest aus der ID eines Eintrags folgt.

/**
 * Eine „Höhenlinie“: geschlossene, leicht wellige Kurve um den Nullpunkt.
 * Gleicher Startwert (seed) → gleiche Form; so bekommt jeder Ort seine eigene, aber feste Kontur.
 */
export function contourPath(radius, seed, wobble = 0.09) {
  const steps = 24;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = radius * (1 + wobble * (0.6 * Math.sin(2 * t + seed) + 0.4 * Math.sin(3 * t + seed * 1.7)));
    pts.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  // weich verbinden (Catmull-Rom → Bézier)
  const p = (i) => pts[(i + steps) % steps];
  let d = `M${p(0)[0].toFixed(2)},${p(0)[1].toFixed(2)}`;
  for (let i = 0; i < steps; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Fester Startwert aus einem Text (z. B. Eintrags-ID) */
export function seedOf(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h / 997) * Math.PI * 2;
}
