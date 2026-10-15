// Weltkarte mit Zoom-Navigation (Mockup A).
// Die Karte ist ein SVG; „Kamerafahrten“ entstehen, indem GSAP die viewBox animiert.
// Marker, Beschriftungen und Readouts liegen als HTML darüber und werden bei jedem
// Kamerabild neu positioniert – so bleiben sie gestochen scharf und gleich groß.

import { getAlbums, getRegions, getCover, imageUrl } from './data.js';
import { formatCoordsShort, pad2 } from './format.js';
import { createProjection, graticulePath } from './map-projection.js';
import { createViews, sameView } from './map-views.js';

const gsap = window.gsap;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none)').matches;
const MAP_DATA = new URL('../data/map/', import.meta.url);

// Ab welcher Detailstufe Ebenen eingeblendet werden (von → bis voll sichtbar).
// Gemessen in „Detail“ = Pixel pro Grad geteilt durch den Wert der Desktop-Weltansicht,
// damit Handy und großer Bildschirm bei gleicher Bildschärfe gleich viel zeigen.
const PX_PER_DEGREE_WORLD = 3.5;
const DETAIL_FADE = [1.8, 2.8];
const BORDER_FADE = [2.5, 4];
const FINE_GRID_FADE = [2.5, 4];

const root = document.querySelector('[data-map]');
const svg = root.querySelector('[data-map-svg]');
const layer = (name) => svg.querySelector(`[data-layer="${name}"]`);
const ui = {
  labels: root.querySelector('[data-map-labels]'),
  edge: root.querySelector('[data-map-edge]'),
  markers: root.querySelector('[data-map-markers]'),
  card: root.querySelector('[data-map-card]'),
  cardImg: root.querySelector('[data-map-card-img]'),
  cardMeta: root.querySelector('[data-map-card-meta]'),
  cardName: root.querySelector('[data-map-card-name]'),
  cardLink: root.querySelector('[data-map-card-link]'),
  worldButton: root.querySelector('[data-map-world]'),
  trail: root.querySelector('[data-map-trail]'),
  camera: root.querySelector('[data-map-camera]'),
  zoom: root.querySelector('[data-map-zoom]'),
  overview: root.querySelector('[data-map-overview]'),
  overviewLand: root.querySelector('[data-overview-land]'),
  overviewFrame: root.querySelector('[data-overview-frame]'),
  hint: root.querySelector('[data-map-hint]'),
  status: root.querySelector('[data-map-status]'),
};

let world;            // Daten aus world.json
let projection;
let views;
let view = { level: 'world' };
let camera;           // aktuelle viewBox { x, y, w, h } in Kartenkoordinaten
let size = { width: 1, height: 1 };   // Größe der Karte in Pixeln
let markers = [];     // { data, el }
let labels = [];      // { data, el, point }
let edgePool = [];    // wiederverwendete Elemente für Gradangaben am Rand
let detailLoaded = false;
let flying = false;
let activeMarker = null;
let hideTimer = null;

init();

// ---------- Start ----------

async function init() {
  try {
    const [albums, regions, worldData] = await Promise.all([
      getAlbums(),
      getRegions(),
      fetch(new URL('world.json', MAP_DATA)).then((res) => res.json()),
    ]);
    world = worldData;
    projection = createProjection(world);
    views = createViews({ albums, regions, projection, world });
  } catch (error) {
    console.error(error);
    showError('Die Karte konnte nicht geladen werden. Läuft die Seite über einen lokalen Server (z. B. npx serve)?');
    return;
  }

  drawBaseLayers();
  measure();

  // Kommt man mit ?ort=… oder ?gebiet=…, startet die Kamera in der Weltansicht und fliegt hin
  const target = views.fromUrl(location.search);
  camera = cameraFor({ level: 'world' });
  setMarkers(views.markersFor(view, screenFor(camera)), { animate: false });
  updateChrome();
  render();

  bindEvents();
  loadDetail();

  if (target.level !== 'world') {
    setTimeout(() => goTo(target), reducedMotion ? 0 : 450);
  }
}

function drawBaseLayers() {
  layer('sphere').setAttribute('d', world.sphere);
  layer('land-world').setAttribute('d', world.land);
  layer('grat-coarse').setAttribute('d', graticulePath(projection, 20, 80));
  layer('grat-fine').setAttribute('d', graticulePath(projection, 5, 80));

  ui.overview.setAttribute('viewBox', `0 0 ${world.width} ${world.height}`);
  ui.overviewLand.setAttribute('d', world.land);
}

/** Detaildaten (50m-Küsten, Grenzen, Beschriftungen) im Hintergrund nachladen */
async function loadDetail() {
  try {
    const detail = await fetch(new URL('detail.json', MAP_DATA)).then((res) => res.json());
    layer('land-detail').setAttribute('d', detail.land);
    layer('borders').setAttribute('d', detail.borders);
    labels = detail.labels.map((data) => {
      const el = document.createElement('span');
      el.className = `map-label map-label--${data.type}`;
      el.textContent = data.name;
      ui.labels.append(el);
      return { data, el, point: projection.project(data.lon, data.lat) };
    });
    detailLoaded = true;
    render();
  } catch (error) {
    console.warn('Detaildaten der Karte fehlen – es bleibt bei der Übersicht.', error);
  }
}

function showError(message) {
  ui.status.textContent = message;
  ui.status.classList.add('is-error');
}

// ---------- Kamera ----------

function measure() {
  const rect = root.getBoundingClientRect();
  size = { width: rect.width || 1, height: rect.height || 1 };
}

/** viewBox für einen Ansichtszustand, passend zum Seitenverhältnis der Karte */
function cameraFor(target) {
  const frame = views.frameFor(target);
  return fitAspect(frame.cx, frame.cy, frame.width, frame.height);
}

function fitAspect(cx, cy, width, height) {
  const aspect = size.width / size.height;
  let w = width;
  let h = height;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Vergrößerung im Verhältnis zur ganzen Welt */
function zoomFactor() {
  return cameraFor({ level: 'globe' }).w / camera.w;
}

/** Bildschirm-Umrechnung für einen Ausschnitt – damit prüft die Kartenlogik, ob Marker sich überdecken */
function screenFor(cam) {
  const s = size.width / cam.w;
  return { project: ([mx, my]) => [(mx - cam.x) * s, (my - cam.y) * s] };
}

/** Bildschirmposition eines Markers (inkl. Auffächerung bei Alben an gleicher Stelle) */
function markerScreen(marker) {
  const [x, y] = toScreen(marker.data.point);
  const [dx, dy] = marker.data.offset ?? [0, 0];
  return [x + dx, y + dy];
}

function toScreen([mx, my]) {
  const s = size.width / camera.w;
  return [(mx - camera.x) * s, (my - camera.y) * s];
}

/**
 * Kamerafahrt von der aktuellen viewBox zu „to“.
 * Zoom läuft logarithmisch (gleichmäßig empfundene Geschwindigkeit), die Mitte folgt der
 * Größenänderung – dadurch bleibt das Ziel beim Hineinzoomen ruhig im Blick.
 */
function fly(to, { duration, ease = 'power2.inOut' }) {
  const from = { ...camera };
  const c0 = [from.x + from.w / 2, from.y + from.h / 2];
  const c1 = [to.x + to.w / 2, to.y + to.h / 2];
  const state = { p: 0 };

  return new Promise((resolve) => {
    gsap.to(state, {
      p: 1,
      duration,
      ease,
      onUpdate() {
        const w = Math.exp(Math.log(from.w) + (Math.log(to.w) - Math.log(from.w)) * state.p);
        const q = Math.abs(to.w - from.w) > 1e-6 ? (w - from.w) / (to.w - from.w) : state.p;
        const cx = c0[0] + (c1[0] - c0[0]) * q;
        const cy = c0[1] + (c1[1] - c0[1]) * q;
        const h = w * (from.h / from.w);
        camera = { x: cx - w / 2, y: cy - h / 2, w, h };
        render();
      },
      onComplete: resolve,
    });
  });
}

/** Weite Wege (z. B. Alpen → Korea): erst herauszoomen, dann hinein – wie ein Flug */
async function flyTo(to) {
  const from = camera;
  const distance = Math.hypot((to.x + to.w / 2) - (from.x + from.w / 2), (to.y + to.h / 2) - (from.y + from.h / 2));
  const ratio = Math.max(from.w, to.w) / Math.min(from.w, to.w);
  const duration = Math.min(2.2, Math.max(1.2, 0.9 + 0.35 * Math.log2(ratio)));

  if (distance > (from.w + to.w) * 0.6) {
    const x0 = Math.min(from.x, to.x);
    const y0 = Math.min(from.y, to.y);
    const x1 = Math.max(from.x + from.w, to.x + to.w);
    const y1 = Math.max(from.y + from.h, to.y + to.h);
    const via = fitAspect((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) * 1.1, (y1 - y0) * 1.1);
    await fly(via, { duration: 1.1, ease: 'power2.in' });
    await fly(to, { duration: 1.3, ease: 'power2.out' });
  } else {
    await fly(to, { duration });
  }
}

/** Ohne Bewegung: kurz ausblenden, Ausschnitt wechseln, einblenden */
async function crossfadeTo(to) {
  const fade = (opacity) => new Promise((resolve) => {
    root.style.transition = 'opacity 150ms ease';
    root.style.opacity = opacity;
    setTimeout(resolve, 160);
  });
  await fade(0.15);
  camera = to;
  render();
  await fade(1);
}

// ---------- Navigation zwischen Ebenen ----------

async function goTo(target) {
  if (flying || sameView(target, view)) return;
  const focusWasInMap = root.contains(document.activeElement);
  flying = true;
  view = target;
  history.replaceState(null, '', views.toUrl(view));
  setActive(null);
  updateChrome();

  const to = cameraFor(view);
  const nextMarkers = views.markersFor(view, screenFor(to));
  setMarkers(nextMarkers, { phase: 'out' });

  if (gsap && !reducedMotion) await flyTo(to); else await crossfadeTo(to);

  setMarkers(nextMarkers, { phase: 'in' });
  flying = false;
  render();

  // Ziel-Album hervorheben, Fokus nicht verlieren
  if (view.level === 'album') setActive(markers.find((m) => m.data.album?.id === view.id) ?? null);
  if (focusWasInMap && !root.contains(document.activeElement)) {
    (markers.find((m) => m.data.album?.id === view.id) ?? markers[0])?.el.focus({ preventScroll: true });
  }
  announce();
}

function zoomOut() {
  if (view.level === 'globe') return;
  goTo(views.parentOf(view));
}

/** Nächstgelegener Cluster zu einem Bildschirmpunkt (für Mausrad und Pinch) */
function clusterNear(x, y, maxDistance = 160) {
  let best = null;
  let bestDistance = maxDistance;
  for (const marker of markers) {
    if (marker.data.type !== 'cluster') continue;
    const [mx, my] = markerScreen(marker);
    const distance = Math.hypot(mx - x, my - y);
    if (distance < bestDistance) { best = marker; bestDistance = distance; }
  }
  return best;
}

// ---------- Marker ----------

/**
 * Gleicht die angezeigten Marker mit der neuen Liste ab.
 * phase 'out': nicht mehr benötigte ausblenden · phase 'in': neue einblenden
 */
function setMarkers(list, { phase = 'in', animate = true } = {}) {
  const keys = new Set(list.map((data) => data.key));
  const fadeOut = phase === 'out' && gsap && !reducedMotion && animate;

  if (phase === 'out') {
    for (const marker of markers) {
      if (keys.has(marker.data.key)) continue;
      marker.removing = true;
      marker.el.setAttribute('tabindex', '-1');
      if (fadeOut) gsap.to(marker.el, { autoAlpha: 0, duration: 0.25, onComplete: () => marker.el.remove() });
      else marker.el.remove();
    }
    markers = markers.filter((m) => !m.removing || fadeOut);
    return;
  }

  markers = markers.filter((m) => !m.removing);
  // bleibende Marker übernehmen die neuen Daten (z. B. Auffächerung)
  const byKey = new Map(list.map((data) => [data.key, data]));
  markers.forEach((m) => { m.data = byKey.get(m.data.key) ?? m.data; });
  const existing = new Set(markers.map((m) => m.data.key));
  const added = list.filter((data) => !existing.has(data.key)).map((data) => ({ data, el: createMarker(data) }));
  // Reihenfolge im DOM = Tab-Reihenfolge: von West nach Ost
  markers = [...markers, ...added].sort((a, b) => a.data.point[0] - b.data.point[0]);
  markers.forEach((m) => ui.markers.append(m.el));
  render();

  if (added.length && gsap && !reducedMotion && animate) {
    gsap.fromTo(added.map((m) => m.el), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, stagger: 0.06, ease: 'power1.out' });
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Eine „Höhenlinie“: geschlossene, leicht wellige Kurve um den Nullpunkt.
 * Gleicher Startwert (seed) → gleiche Form; so bekommt jeder Ort seine eigene, aber feste Kontur.
 */
function contourPath(radius, seed, wobble = 0.09) {
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

/** Fester Startwert aus einem Text (z. B. Album-ID) */
function seedOf(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h / 997) * Math.PI * 2;
}

function createMarker(data) {
  const el = document.createElement(data.type === 'album' ? 'a' : 'button');
  el.className = `map-marker map-marker--${data.type}`;
  const hit = document.createElement('span');
  hit.className = 'map-marker__hit';
  const icon = document.createElementNS(SVG_NS, 'svg');
  icon.setAttribute('viewBox', '-80 -80 160 160');
  icon.setAttribute('aria-hidden', 'true');
  hit.append(icon);

  const text = document.createElement('span');
  text.className = 'map-marker__text';
  text.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'map-marker__name';
  const sub = document.createElement('span');
  sub.className = 'map-marker__sub';
  text.append(name, sub);

  if (data.type === 'album') {
    const { album } = data;
    el.href = `album.html?ort=${encodeURIComponent(album.id)}`;
    el.dataset.coverFrom = '[data-map-card-img]';   // Übergang: Bild aus der Vorschau fliegt ins Album
    el.dataset.albumName = album.name;
    el.setAttribute('aria-label', `${[album.name, album.year].filter(Boolean).join(' ')}, Album ${pad2(data.number)} – öffnen`);
    const seed = seedOf(album.id);
    icon.innerHTML = `
      <circle class="map-marker__ripple" r="6"/>
      <path class="map-contour map-contour--3" d="${contourPath(17, seed + 0.6)}"/>
      <path class="map-contour map-contour--2" d="${contourPath(12.5, seed + 0.3)}"/>
      <path class="map-contour map-contour--1" d="${contourPath(8, seed)}"/>
      <path class="map-marker__leader" d="M30,0H54L66,-12"/>
      <circle class="map-marker__dot" r="3.5"/>`;
    name.textContent = album.shortName ?? album.name;
    sub.textContent = [album.year, formatCoordsShort(album.coords).replace(' · ', ' ')].filter(Boolean).join(' · ');
    bindAlbumMarker(el, data);
  } else {
    el.type = 'button';
    el.setAttribute('aria-label', `${data.name}: ${data.count} Alben – hineinzoomen`);
    // Gipfel: äußere Fläche + innere Linien, je mehr Alben, desto mehr Linien (max. 3)
    const seed = seedOf(data.key);
    const inner = [20, 14, 9].slice(0, Math.min(3, data.count - 1));
    icon.innerHTML = `<path class="map-contour map-contour--base" d="${contourPath(26, seed, 0.07)}"/>`
      + inner.map((r, i) => `<path class="map-contour map-contour--inner" d="${contourPath(r, seed + 0.4 * (i + 1), 0.08)}"/>`).join('')
      + `<text class="cluster-count">${data.count}</text>`;
    name.textContent = data.name;
    sub.textContent = data.subtitle;
    el.addEventListener('click', () => goTo(data.target));
  }

  el.append(hit, text);
  return el;
}

function bindAlbumMarker(el, data) {
  const marker = () => markers.find((m) => m.el === el);
  let lastPointer = 'mouse';
  el.addEventListener('pointerdown', (event) => { lastPointer = event.pointerType; });
  el.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') setActive(marker()); });
  el.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') scheduleHide(); });
  el.addEventListener('focus', () => setActive(marker()));
  el.addEventListener('blur', () => scheduleHide());
  el.addEventListener('click', (event) => {
    // Touch: erster Tipp zeigt die Vorschau, zweiter öffnet das Album
    if (lastPointer !== 'mouse' && activeMarker?.el !== el) {
      event.preventDefault();
      setActive(marker());
    }
  });
  // sanfter Seitenwechsel (View Transitions, falls vom Browser unterstützt)
  el.dataset.albumId = data.album.id;
}

// ---------- Vorschau-Karte ----------

function setActive(marker) {
  clearTimeout(hideTimer);
  if (activeMarker === marker) return;
  activeMarker?.el.classList.remove('is-active');
  activeMarker = marker;
  if (!marker) {
    ui.card.hidden = true;
    return;
  }
  marker.el.classList.add('is-active');
  const { album } = marker.data;
  const cover = getCover(album);
  ui.cardImg.src = imageUrl(album, cover, 600);
  ui.cardImg.alt = '';
  ui.cardMeta.textContent = [album.year, formatCoordsShort(album.coords)].filter(Boolean).join(' · ');
  ui.cardName.textContent = album.name;
  ui.cardLink.href = `album.html?ort=${encodeURIComponent(album.id)}`;
  ui.cardLink.dataset.albumName = album.name;
  ui.card.hidden = false;
  positionCard();
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (ui.card.matches(':hover') || activeMarker?.el.matches(':hover, :focus')) return;
    if (view.level === 'album' && activeMarker?.data.album?.id === view.id) return;   // Ziel-Album bleibt markiert
    setActive(null);
  }, 250);
}

function positionCard() {
  if (!activeMarker || ui.card.hidden) return;
  const [x, y] = markerScreen(activeMarker);
  const cardWidth = ui.card.offsetWidth;
  const cardHeight = ui.card.offsetHeight;

  // Schmale Bildschirme: Vorschau unten, damit sie den Ort nicht verdeckt
  if (size.width < 600) {
    const top = y > size.height / 2 ? 140 : size.height - cardHeight - 56;
    ui.card.style.transform = `translate(${(size.width - cardWidth) / 2}px, ${top}px)`;
    activeMarker.el.classList.add('is-flipped');
    return;
  }

  const fitsRight = x + 66 + cardWidth < size.width - 16;
  const left = fitsRight ? x + 66 : Math.max(16, x - 30 - cardWidth);
  const top = Math.min(Math.max(16, y - 123), size.height - cardHeight - 16);
  ui.card.style.transform = `translate(${left}px, ${top}px)`;
  activeMarker.el.classList.toggle('is-flipped', !fitsRight);
}

// ---------- Zeichnen (bei jedem Kamerabild) ----------

function smooth(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function render() {
  if (!camera) return;
  svg.setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
  const k = zoomFactor();
  const detailLevel = (projection.unitsPerDegree * size.width / camera.w) / PX_PER_DEGREE_WORLD;

  // Detailstufen überblenden
  const detail = detailLoaded ? smooth(...DETAIL_FADE, detailLevel) : 0;
  layer('land-detail').style.opacity = detail;
  layer('land-world').style.opacity = 1 - detail;
  layer('borders').style.opacity = detailLoaded ? smooth(...BORDER_FADE, detailLevel) : 0;
  const fine = smooth(...FINE_GRID_FADE, detailLevel);
  layer('grat-fine').style.opacity = fine;
  layer('grat-coarse').style.opacity = 1 - fine;

  for (const marker of markers) {
    const [x, y] = markerScreen(marker);
    marker.el.style.transform = `translate(${x}px, ${y}px)`;
    // Text links vom Ring, wenn er rechts aus dem Bild laufen würde
    marker.textWidth ??= marker.el.querySelector('.map-marker__text').offsetWidth;
    marker.el.classList.toggle('is-left', x + marker.textWidth + 48 > size.width);
  }

  for (const label of labels) {
    const [x, y] = toScreen(label.point);
    const { minZoom } = label.data;
    const opacity = minZoom === 0 ? 0.9 * (1 - smooth(1.6, 2.4, detailLevel)) : smooth(minZoom, minZoom * 1.3, detailLevel);
    const visible = opacity > 0.01 && x > -100 && x < size.width + 100 && y > -20 && y < size.height + 20;
    label.el.style.opacity = visible ? opacity : 0;
    if (visible) label.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  renderEdgeLabels(fine > 0.5 ? 5 : 20);
  renderReadout(k);
  positionCard();
}

/** Gradangaben am linken und oberen Rand (60°N, 10°O …) */
function renderEdgeLabels(step) {
  const items = [];
  const s = size.width / camera.w;
  const desktop = size.width >= 768;
  const topY = desktop ? 168 : 150;               // Zeile für Längengrade, unter der Steuerung
  let lastX = -Infinity;
  let lastY = -Infinity;
  const bottomLimit = size.height - (desktop ? 200 : 60);

  for (let lat = -80; lat <= 80; lat += step) {
    const y = (projection.project(0, lat)[1] - camera.y) * s;
    if (y > topY + 24 && y < bottomLimit && Math.abs(y - lastY) > 22) lastY = y, items.push({ text: `${Math.abs(lat)}°${lat > 0 ? 'N' : lat < 0 ? 'S' : ''}`, x: 16, y });
  }

  // Längengrade nur, wenn die Karte oben angeschnitten ist – sonst ragen sie in die Weltkarte hinein
  const sphereTop = (projection.project(0, 90)[1] - camera.y) * s;
  const [, latTop] = projection.invert(camera.x + camera.w / 2, camera.y + topY / s);
  if (sphereTop < topY - 40 && Number.isFinite(latTop) && Math.abs(latTop) < 85) {
    for (let lon = -180; lon <= 180; lon += step) {
      const x = (projection.project(lon, latTop)[0] - camera.x) * s;
      if (x > 64 && x < size.width - 40 && x - lastX > 52) lastX = x, items.push({ text: `${Math.abs(lon)}°${lon > 0 ? 'O' : lon < 0 ? 'W' : ''}`, x, y: topY, center: true });
    }
  }

  while (edgePool.length < items.length) {
    const el = document.createElement('span');
    el.className = 'map-edge-label';
    ui.edge.append(el);
    edgePool.push(el);
  }
  edgePool.forEach((el, i) => {
    const item = items[i];
    el.hidden = !item;
    if (!item) return;
    if (el.textContent !== item.text) el.textContent = item.text;
    el.style.transform = `translate(${item.x}px, ${item.y}px) translate(${item.center ? '-50%' : '0'}, -50%)`;
  });
}

function renderReadout(k) {
  const [lon, lat] = projection.invert(camera.x + camera.w / 2, camera.y + camera.h / 2);
  ui.camera.textContent = Number.isFinite(lat) && Math.abs(lon) <= 180
    ? formatCoordsShort({ lat, lon }).toUpperCase()
    : '—';
  ui.zoom.textContent = `${k.toFixed(1)}×`;

  // Rahmen in der Weltübersicht (auf die Weltgrenzen beschränkt)
  const x0 = Math.max(0, camera.x);
  const y0 = Math.max(0, camera.y);
  const x1 = Math.min(world.width, camera.x + camera.w);
  const y1 = Math.min(world.height, camera.y + camera.h);
  ui.overviewFrame.setAttribute('x', x0);
  ui.overviewFrame.setAttribute('y', y0);
  ui.overviewFrame.setAttribute('width', Math.max(0, x1 - x0));
  ui.overviewFrame.setAttribute('height', Math.max(0, y1 - y0));
}

// ---------- Steuerung oben links, Hinweise ----------

function updateChrome() {
  // Knopf führt zurück zur Startansicht (Reisegebiete); dort selbst ausgeblendet
  ui.worldButton.disabled = view.level === 'world';
  ui.worldButton.lastChild.textContent = view.level === 'globe' ? ' Reisegebiete' : ' Weltansicht';

  ui.trail.replaceChildren();
  const trail = views.trailOf(view);
  trail.forEach((item, index) => {
    if (index > 0) ui.trail.append(Object.assign(document.createElement('span'), { className: 'map__trail-sep', textContent: '/' }));
    const last = index === trail.length - 1;
    const el = document.createElement(last ? 'span' : 'button');
    el.textContent = item.name;
    if (last) el.setAttribute('aria-current', 'location');
    else {
      el.type = 'button';
      el.addEventListener('click', () => goTo(item.view));
    }
    ui.trail.append(el);
  });
  if (view.level !== 'album') {
    const count = views.countOf(view);
    ui.trail.append(Object.assign(document.createElement('span'), {
      className: 'map__trail-count',
      textContent: `· ${count} ${count === 1 ? 'Album' : 'Alben'}`,
    }));
  }

  ui.hint.textContent = view.level === 'world' || view.level === 'globe'
    ? (isTouch ? 'Tippen zum Hineinzoomen' : 'Ort wählen zum Hineinzoomen')
    : (isTouch ? 'Zwei Finger zusammen zum Rauszoomen' : 'Esc · Scrollen zum Rauszoomen');
}

/** Ansage für Screenreader nach jedem Ebenenwechsel */
function announce() {
  if (ui.status.classList.contains('is-error')) return;
  const count = views.countOf(view);
  ui.status.textContent = `${views.nameOf(view)}${view.level === 'album' ? '' : `, ${count} ${count === 1 ? 'Album' : 'Alben'}`}`;
}

// ---------- Eingaben ----------

function bindEvents() {
  ui.worldButton.addEventListener('click', () => goTo({ level: 'world' }));

  ui.card.addEventListener('pointerleave', () => scheduleHide());
  ui.card.addEventListener('pointerenter', () => clearTimeout(hideTimer));

  // Escape: erst Vorschau schließen, dann eine Ebene heraus
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.body.classList.contains('menu-open')) return;
    if (activeMarker && !(view.level === 'album' && activeMarker.data.album?.id === view.id)) setActive(null);
    else zoomOut();
  });

  // Klick/Tipp auf freie Fläche: Vorschau schließen bzw. herauszoomen
  let down = null;
  root.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.map-marker, .map-card, .map__bar, button, a')) { down = null; return; }
    down = { x: event.clientX, y: event.clientY };
  });
  root.addEventListener('pointerup', (event) => {
    if (!down || pointers.size > 0) { down = null; return; }
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (moved > 8 || pinched) return;
    if (activeMarker) setActive(null);
    else zoomOut();
  });

  // Mausrad: nach unten = herauszoomen, nach oben = in den nächsten Cluster
  let lastWheel = 0;
  root.addEventListener('wheel', (event) => {
    if (root.getBoundingClientRect().top < -2) return;   // Seite ist gescrollt → normal weiterscrollen
    const zoomingOut = event.deltaY > 0;
    if (zoomingOut && view.level === 'globe') return;     // ganz draußen: Seite darf scrollen
    event.preventDefault();
    const now = performance.now();
    if (flying || now - lastWheel < 700 || Math.abs(event.deltaY) < 4) return;
    lastWheel = now;
    if (zoomingOut) zoomOut();
    else {
      const rect = root.getBoundingClientRect();
      const near = clusterNear(event.clientX - rect.left, event.clientY - rect.top);
      if (near) goTo(near.data.target);
    }
  }, { passive: false });

  // Pinch mit zwei Fingern
  const pointers = new Map();
  let pinchStart = null;
  let pinched = false;
  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) { pinchStart = pinchInfo(pointers); pinched = false; }
  });
  root.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size !== 2 || !pinchStart || pinched || flying) return;
    const now = pinchInfo(pointers);
    const ratio = now.distance / pinchStart.distance;
    if (ratio < 0.7) { pinched = true; zoomOut(); }
    if (ratio > 1.4) {
      pinched = true;
      const rect = root.getBoundingClientRect();
      const near = clusterNear(now.x - rect.left, now.y - rect.top, 220);
      if (near) goTo(near.data.target);
    }
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) setTimeout(() => { pinched = false; }, 0);
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  // Größenänderung: Ausschnitt neu einpassen
  new ResizeObserver(() => {
    measure();
    if (!flying) {
      camera = cameraFor(view);
      // bei anderer Größe passt evtl. mehr oder weniger nebeneinander
      const list = views.markersFor(view, screenFor(camera));
      setMarkers(list, { phase: 'out', animate: false });
      setMarkers(list, { animate: false });
    }
    render();
  }).observe(root);
}

function pinchInfo(pointers) {
  const [a, b] = [...pointers.values()];
  return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
