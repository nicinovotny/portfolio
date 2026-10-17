// Startseite (Mockup A2), vier Abschnitte:
//   1. Hero: ein Bild pro veröffentlichter Collection (Landscape zuerst) aus ihren Hero-Favoriten.
//      Welcher Favorit gezeigt wird, wechselt jede Stunde – für alle Besucher gleich, nichts wird gespeichert.
//      Bildwechsel: langsame Überblendung + leichte „Kamerafahrt“ (Zoom 1.08 → 1); die Fortschrittslinie
//      ist zugleich der Taktgeber: ist sie voll, kommt die nächste Collection.
//   2. Persönliches Intro mit Zahlen aus albums.json
//   3. Collections als typografische Liste (Vorschaubild beim Überfahren, auf dem Handy Bildzeilen)
//   4. Die drei neuesten Einträge + Kartenstreifen

import {
  collectionUrl, entryUrl, getCollectionCover, getCollectionEntries, getCollectionFrames, getCollections, getCover,
  getEntries, getHeroCollections, getMapEntries, getNewestEntries, imageAttrs, imageUrl,
} from './data.js';
import { KIND_LABELS, formatCollectionCounts, nameWithYear, pad2 } from './format.js';
import { contourPath, seedOf } from './contours.js';
import { createProjection, graticulePath } from './map-projection.js';
import { applyScrim } from './scrim.js';
import { createTile } from './tiles.js';

const SLIDE_DURATION = 7;    // Sekunden pro Bild
const FADE_DURATION = 1.6;   // Sekunden für die Überblendung
const HOUR = 3_600_000;

const gsap = window.gsap;    // selbst gehostet – fehlt es, wechseln die Bilder ohne Animation
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowQuery = matchMedia('(max-width: 47.99rem)');   // Handy: focusMobile statt focus

const hero = document.querySelector('[data-hero]');
const el = {
  slides: hero.querySelector('[data-hero-slides]'),
  caption: hero.querySelector('[data-hero-caption]'),
  label: hero.querySelector('[data-hero-label]'),
  title: hero.querySelector('[data-hero-title]'),
  links: hero.querySelector('[data-hero-links]'),
  open: hero.querySelector('[data-hero-open]'),
  origin: hero.querySelector('[data-hero-origin]'),
  number: hero.querySelector('[data-hero-number]'),
  total: hero.querySelector('[data-hero-total]'),
  progress: hero.querySelector('[data-hero-progress]'),
  demo: hero.querySelector('[data-hero-demo]'),
  selection: hero.querySelector('[data-hero-selection]'),
  pause: hero.querySelector('[data-hero-pause]'),
};

let picks = [];           // je Collection: { collection, entry, image, focus, focusMobile, counts }
let slides = [];          // { root, img, attrs, loaded }
let dots = [];
let current = -1;
let changeId = 0;         // schützt vor überholten Wechseln bei schnellem Klicken
let progressTween = null;
let autoplay = Boolean(gsap) && !reducedMotion;   // ohne Bewegung keine automatische Diashow
const pausedBy = new Set(); // Gründe für eine Pause: 'user', 'focus', 'offscreen', 'hidden'

initHero();
setupReveal();
initIntro();
initCollections();
initRecent();

// =====================================================================
// 1. Hero
// =====================================================================

/** Kleiner, fester Zahlenwert aus einem Text – Versatz, damit nicht alle Collections gleichzeitig wechseln */
function hashString(text) {
  let hash = 5381;
  for (const ch of text) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  return hash;
}

/** Favorit dieser Stunde: jeder kommt der Reihe nach dran */
function pickFavorite(collection, favorites) {
  const hourIndex = Math.floor(Date.now() / HOUR);
  const offset = hashString(collection.id);
  return favorites[(hourIndex + offset) % favorites.length];
}

async function initHero() {
  try {
    const heroCollections = await getHeroCollections();
    picks = await Promise.all(heroCollections.map(async ({ collection, favorites }) => {
      const [entries, frames] = await Promise.all([getCollectionEntries(collection.id), getCollectionFrames(collection.id)]);
      return { collection, ...pickFavorite(collection, favorites), counts: formatCollectionCounts(entries, frames) };
    }));
    // Ohne Favoriten: wenigstens das Titelbild der ersten Collection zeigen
    if (!picks.length) {
      const [first] = await getCollections();
      const cover = first && await getCollectionCover(first);
      if (cover) picks = [{ collection: first, ...cover, counts: [] }];
    }
  } catch (error) {
    console.error(error);
    el.title.textContent = 'Bilder konnten nicht geladen werden';
    return;
  }
  if (!picks.length) return;

  buildSlides();
  buildDots();
  el.total.textContent = `/ ${pad2(picks.length)}`;
  el.selection.textContent = `Auswahl ${pad2(new Date().getHours())}:00`;
  // Nur eine Collection mit Favoriten: keine Diashow, keine Fortschrittslinie
  if (picks.length < 2) {
    autoplay = false;
    el.progress.hidden = true;
    el.pause.hidden = true;
  } else if (!autoplay) {
    setPauseButton();
  }

  await show(0, { initial: true });
  bindControls();
  setupScrollEffects();
  narrowQuery.addEventListener('change', () => slides.forEach((slide, i) => applyFocus(slide.img, picks[i])));
}

/** Fokuspunkt als object-position, damit z. B. Hochformate an der richtigen Stelle beschnitten werden */
function applyFocus(img, { focus, focusMobile }) {
  const point = (narrowQuery.matches && focusMobile) || focus;
  img.style.objectPosition = point ? `${point[0]}% ${point[1]}%` : '';
}

function buildSlides() {
  slides = picks.map((pick, index) => {
    const root = document.createElement('div');
    root.className = 'hero__slide';
    const img = document.createElement('img');
    img.alt = '';                   // Beschreibung steht im Alt-Text, sobald das Bild aktiv ist
    img.decoding = 'async';
    img.sizes = '100vw';
    img.crossOrigin = 'anonymous';   // erlaubt das Messen der Helligkeit (auch bei den Demo-Bildern von picsum)
    if (index === 0) img.fetchPriority = 'high';
    applyFocus(img, pick);
    root.append(img);
    el.slides.append(root);
    return { root, img, attrs: imageAttrs(pick.entry, pick.image), loaded: false };
  });
}

function buildDots() {
  dots = picks.map(({ collection }, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero__dot';
    button.setAttribute('aria-label', `${pad2(index + 1)}: ${collection.name}`);
    const fill = document.createElement('span');
    fill.className = 'hero__dot-fill';
    button.append(fill);
    button.addEventListener('click', () => goTo(index, { byUser: true }));
    li.append(button);
    el.progress.append(li);
    return { button, fill };
  });
}

/** Bild erst laden, wenn es gebraucht wird (aktuelles + nächstes) – das erste sofort, die übrigen später */
function load(index) {
  const slide = slides[index];
  if (!slide || slide.loaded) return;
  slide.loaded = true;
  const { src, srcset, width, height } = slide.attrs;
  Object.assign(slide.img, { width, height });
  slide.img.srcset = srcset;
  slide.img.src = src;
}

/** Wartet, bis das Bild dekodiert ist – höchstens 1,5 s, damit nichts hängt. */
function ready(img) {
  const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  return Promise.race([decoded, new Promise((resolve) => setTimeout(resolve, 1500))]);
}

function goTo(index, { byUser = false } = {}) {
  const target = (index + picks.length) % picks.length;
  if (target === current) return;
  // Nach Bedienung durch Nutzer: Änderungen ansagen (bei Autoplay nicht, das wäre zu viel)
  el.caption.setAttribute('aria-live', byUser ? 'polite' : 'off');
  show(target);
}

async function show(index, { initial = false } = {}) {
  const id = ++changeId;
  const previous = current;
  current = index;

  load(index);
  load((index + 1) % picks.length);

  const pick = picks[index];
  const slide = slides[index];
  slide.img.alt = pick.image.alt;

  // Alte Bildunterschrift ausblenden, während das neue Bild lädt
  const captionOut = !initial && gsap && !reducedMotion
    ? gsap.to([el.label, el.title, el.links], { autoAlpha: 0, y: -10, duration: 0.35, ease: 'power2.in', stagger: 0.04 })
    : null;

  await Promise.all([ready(slide.img), captionOut]);
  applyScrim(hero, slide.img);   // Verläufe an die Bildhelligkeit anpassen
  slides.forEach((s, i) => s.root.toggleAttribute('data-current', i === index));   // Quelle für den Übergang
  if (id !== changeId) return;   // inzwischen wurde schon ein anderes Bild gewählt
  updateMeta(index);

  // Neues Bild über das alte legen
  slides.forEach((s, i) => {
    s.root.style.zIndex = i === index ? 2 : i === previous ? 1 : 0;
  });

  if (gsap && !reducedMotion) {
    gsap.killTweensOf([slide.root, slide.img]);
    slide.root.classList.add('is-active');
    // Erstes Bild weich einblenden statt plötzlich erscheinen, sobald es geladen ist
    gsap.fromTo(slide.root, { autoAlpha: 0 }, {
      autoAlpha: 1,
      duration: initial ? 0.8 : FADE_DURATION,
      ease: 'power2.inOut',
      onComplete: () => hideOthers(index),
    });
    // Langsame Kamerafahrt über die ganze Standzeit
    gsap.fromTo(slide.img, { scale: 1.08 }, { scale: 1, duration: SLIDE_DURATION + FADE_DURATION, ease: 'power1.out' });
  } else {
    slide.root.classList.add('is-active');
    hideOthers(index);
  }

  updateCaption(pick, initial);
  startProgress();
}

function hideOthers(index) {
  if (index !== current) return;   // eine ältere Überblendung darf das neue Bild nicht ausblenden
  slides.forEach((s, i) => {
    if (i === index) return;
    s.root.classList.remove('is-active');
    if (gsap) gsap.set(s.root, { clearProps: 'opacity,visibility' });
  });
}

function updateCaption({ collection, entry, image, counts }, initial) {
  // „Collection — 21 Trips“, darunter der Name, dann „Collection öffnen“ und die Herkunft des Bildes
  el.label.replaceChildren('Collection');
  if (counts.length) {
    el.label.append(' ', Object.assign(document.createElement('span'), { className: 'label__dash', textContent: '—' }), ` ${counts.join(' · ')}`);
  }
  el.title.textContent = collection.name;
  el.open.href = collectionUrl(collection.id);

  // „Aus: Trip · Seoul · 2026 →“ – bei Frames ohne eigene Seite nur „Aus: Frame · 2025“ ohne Link
  const isFrame = entry.kind === 'frame';
  el.origin.textContent = `Aus: ${[KIND_LABELS[entry.kind], isFrame ? null : entry.name, entry.year].filter(Boolean).join(' · ')}${isFrame ? '' : ' →'}`;
  el.origin.href = isFrame ? collectionUrl(collection.id) : entryUrl(entry);
  // Ist das Bild das Titelbild des Eintrags, fliegt es beim Klick in dessen Bühne (js/transitions.js)
  if (!isFrame && getCover(entry) === image) {
    el.origin.dataset.coverFrom = '.hero__slide[data-current] img';
    el.origin.dataset.entryName = entry.name;
  } else {
    delete el.origin.dataset.coverFrom;
    delete el.origin.dataset.entryName;
  }

  if (!gsap || reducedMotion) return;
  // Titel wächst aus der Maske, Label und Links folgen
  gsap.set([el.label, el.title, el.links], { autoAlpha: 1, y: 0 });
  gsap.fromTo(el.title, { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', delay: initial ? 0.2 : 0.3 });
  gsap.fromTo([el.label, el.links], { autoAlpha: 0, y: 10 }, {
    autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.1, delay: initial ? 0.4 : 0.5,
  });
}

function updateMeta(index) {
  el.number.textContent = pad2(index + 1);
  dots.forEach(({ button, fill }, i) => {
    button.setAttribute('aria-current', String(i === index));
    if (gsap) gsap.set(fill, { scaleX: i === index && !autoplay ? 1 : 0 });
  });
  el.demo.hidden = picks[index].image.demo == null;
}

// ---------- Autoplay ----------

function startProgress() {
  progressTween?.kill();
  if (!autoplay) return;
  const { fill } = dots[current];
  progressTween = gsap.fromTo(fill, { scaleX: 0 }, {
    scaleX: 1,
    duration: SLIDE_DURATION,
    ease: 'none',
    onComplete: () => goTo(current + 1),
  });
  if (pausedBy.size) progressTween.pause();
}

function setPaused(reason, paused) {
  if (paused) pausedBy.add(reason); else pausedBy.delete(reason);
  if (!progressTween) return;
  if (pausedBy.size) progressTween.pause(); else progressTween.resume();
}

function setPauseButton() {
  const userPaused = !autoplay || pausedBy.has('user');
  el.pause.textContent = userPaused ? 'Abspielen' : 'Pause';
  el.pause.setAttribute('aria-label', userPaused ? 'Diashow abspielen' : 'Diashow anhalten');
  el.pause.hidden = !gsap || picks.length < 2;
}

// ---------- Bedienung ----------

function bindControls() {
  if (picks.length < 2) return;
  el.pause.addEventListener('click', () => {
    if (!autoplay) {
      // z. B. bei reduzierter Bewegung: Diashow erst auf Wunsch starten
      autoplay = true;
      pausedBy.delete('user');
      startProgress();
    } else {
      setPaused('user', !pausedBy.has('user'));
    }
    setPauseButton();
  });
  setPauseButton();

  // Tastatur: Pfeiltasten wechseln das Bild, solange der Hero sichtbar ist
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.body.classList.contains('menu-open')) return;
    if (pausedBy.has('offscreen')) return;
    if (event.key === 'ArrowRight') goTo(current + 1, { byUser: true });
    if (event.key === 'ArrowLeft') goTo(current - 1, { byUser: true });
  });

  // Wischen auf dem Handy (und mit der Maus ziehen)
  let start = null;
  hero.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button')) return;
    start = { x: event.clientX, y: event.clientY };
  });
  hero.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goTo(current + (dx < 0 ? 1 : -1), { byUser: true });
  });
  hero.addEventListener('pointercancel', () => { start = null; });

  // Pausieren, solange per Tastatur im Hero navigiert wird
  hero.addEventListener('focusin', () => setPaused('focus', true));
  hero.addEventListener('focusout', (event) => {
    if (!hero.contains(event.relatedTarget)) setPaused('focus', false);
  });

  // Pausieren, wenn der Hero aus dem Bild gescrollt oder der Tab im Hintergrund ist
  new IntersectionObserver(([entry]) => setPaused('offscreen', !entry.isIntersecting), { threshold: 0.25 })
    .observe(hero);
  document.addEventListener('visibilitychange', () => setPaused('hidden', document.hidden));
}

// ---------- Scroll-Effekte ----------

function setupScrollEffects() {
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || reducedMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  // Parallax: das Bild bleibt beim Rausscrollen etwas zurück, der Text blendet aus
  gsap.to(el.slides, {
    yPercent: 18,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to([el.caption, hero.querySelector('.hero__meta')], {
    autoAlpha: 0,
    y: -40,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: '45% top', scrub: true },
  });
}

/** Abschnitte unter dem Hero: Elemente nacheinander einblenden, sobald sie ins Bild kommen */
function setupReveal() {
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || reducedMotion) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.set('[data-reveal]', { autoAlpha: 0, y: 24 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out', stagger: 0.1 }),
  });
}

// =====================================================================
// 2. Persönliches Intro
// =====================================================================

/** Readout: „· Seit 2019 · 13 Länder · 30 Einträge“ (Ort steht von Hand im HTML) */
async function initIntro() {
  const target = document.querySelector('[data-intro-stats]');
  try {
    const entries = (await getEntries()).filter((entry) => entry.kind !== 'frame');
    const years = entries.map((entry) => entry.year).filter(Number.isInteger);
    // Land ohne Zusatz in Klammern zählen, z. B. „Färöer (Dänemark)“ → „Färöer“
    const countries = new Set(entries.filter((entry) => entry.country).map((entry) => entry.country.replace(/\s*\(.*\)$/, '')));
    const parts = [
      years.length && `Seit ${Math.min(...years)}`,
      countries.size && `${countries.size} ${countries.size === 1 ? 'Land' : 'Länder'}`,
      `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}`,
    ].filter(Boolean);
    target.textContent = ` · ${parts.join(' · ')}`;
  } catch (error) {
    console.error(error);
  }
}

// =====================================================================
// 3. Collections als typografische Liste
// =====================================================================

// Vorschau neben dem Mauszeiger nur mit echter Maus auf breiten Bildschirmen; sonst Bildzeilen (css/home.css)
const previewQuery = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 48rem)');

async function initCollections() {
  const list = document.querySelector('[data-home-collections]');
  try {
    const collections = await getCollections();
    const rows = await Promise.all(collections.map(async (collection, index) => {
      const [entries, frames, cover] = await Promise.all([
        getCollectionEntries(collection.id),
        getCollectionFrames(collection.id),
        getCollectionCover(collection),
      ]);
      return collectionRow(collection, index, formatCollectionCounts(entries, frames), cover);
    }));
    list.replaceChildren(...rows);
    setupPreview(list);
  } catch (error) {
    console.error(error);
  }
}

/** Zeile: „01  Landscape ……………… 21 Trips“ – auf dem Handy mit Titelbild darüber */
function collectionRow(collection, index, counts, cover) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'home-collection';
  link.href = collectionUrl(collection.id);
  if (cover) link.dataset.preview = imageUrl(cover.entry, cover.image, 1200);

  const media = document.createElement('span');
  media.className = 'home-collection__media';
  if (cover) {
    const img = Object.assign(document.createElement('img'), imageAttrs(cover.entry, cover.image));
    img.alt = '';   // dekorativ: der Name beschreibt den Link
    img.sizes = '100vw';
    img.loading = 'lazy';
    img.decoding = 'async';
    media.append(img);
  }

  link.append(
    media,
    Object.assign(document.createElement('span'), { className: 'home-collection__number label', textContent: pad2(index + 1) }),
    Object.assign(document.createElement('span'), { className: 'home-collection__name', textContent: collection.name }),
    Object.assign(document.createElement('span'), { className: 'home-collection__leader' }),
    Object.assign(document.createElement('span'), { className: 'home-collection__count label', textContent: counts.join(' · ') || 'Noch leer' }),
  );
  link.querySelector('.home-collection__leader').setAttribute('aria-hidden', 'true');
  item.append(link);
  return item;
}

/**
 * Vorschaubild: folgt beim Überfahren dem Mauszeiger (weich nachgezogen), bei Tastaturfokus steht es
 * rechts neben der Zeile. Nur ein Bild-Element für alle Zeilen; Bilder werden erst beim ersten Zeigen geladen.
 */
function setupPreview(list) {
  const preview = document.querySelector('[data-home-preview]');
  const img = preview.querySelector('img');
  const follow = gsap && !reducedMotion
    ? { x: gsap.quickTo(preview, 'x', { duration: 0.5, ease: 'power3' }), y: gsap.quickTo(preview, 'y', { duration: 0.5, ease: 'power3' }) }
    : null;

  const place = (x, y, instant) => {
    // Bild rechts vom Zeiger, mindestens rechts der Mitte (die Namen links bleiben frei), im Fenster halten
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;
    const left = Math.min(Math.max(x + 32, innerWidth * 0.5), innerWidth - width - 16);
    const top = Math.min(Math.max(y - height / 2, 16), innerHeight - height - 16);
    if (follow && !instant) { follow.x(left); follow.y(top); }
    else if (gsap) gsap.set(preview, { x: left, y: top });
    else preview.style.transform = `translate(${left}px, ${top}px)`;
  };

  const showFor = (link) => {
    if (!previewQuery.matches || !link.dataset.preview) return hide();
    if (img.getAttribute('src') !== link.dataset.preview) img.src = link.dataset.preview;
    preview.classList.add('is-visible');
  };
  const hide = () => preview.classList.remove('is-visible');

  list.addEventListener('pointerover', (event) => {
    const link = event.target.closest('.home-collection');
    if (!link) return;
    const entering = !preview.classList.contains('is-visible');
    place(event.clientX, event.clientY, entering);
    showFor(link);
  });
  list.addEventListener('pointermove', (event) => {
    if (preview.classList.contains('is-visible')) place(event.clientX, event.clientY);
  });
  list.addEventListener('pointerleave', hide);

  // Tastatur: Vorschau rechts neben der fokussierten Zeile
  list.addEventListener('focusin', (event) => {
    const link = event.target.closest('.home-collection');
    if (!link || !link.matches(':focus-visible')) return;
    const rect = link.getBoundingClientRect();
    place(rect.right - preview.offsetWidth - 48, rect.top + rect.height / 2, true);
    showFor(link);
  });
  list.addEventListener('focusout', hide);
  addEventListener('scroll', hide, { passive: true });
}

// =====================================================================
// 4. Zuletzt + Kartenstreifen
// =====================================================================

async function initRecent() {
  const list = document.querySelector('[data-home-recent]');
  try {
    const newest = await getNewestEntries(3);
    list.replaceChildren(...newest.map((entry, index) => createTile(entry, index + 3)));
  } catch (error) {
    console.error(error);
  }

  // Kartenstreifen erst zeichnen, wenn er in die Nähe kommt (Kartendaten ca. 60 KB)
  const strip = document.querySelector('[data-map-strip]');
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    drawMapStrip(strip);
  }, { rootMargin: '400px' }).observe(strip);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Schmaler Kartenausschnitt mit allen Einträgen mit Ort (Projektion und Landflächen wie auf der Karte).
 * Der Ausschnitt umfasst alle Marker und passt sich dem Seitenverhältnis des Streifens an.
 */
async function drawMapStrip(strip) {
  const svg = strip.querySelector('[data-map-strip-svg]');
  const readout = strip.querySelector('[data-map-strip-readout]');
  try {
    const [world, entries] = await Promise.all([
      fetch(new URL('../data/map/world.json', import.meta.url)).then((res) => res.json()),
      getMapEntries(),
    ]);
    const projection = createProjection(world);
    const points = entries.map((entry) => ({ entry, point: projection.project(entry.coords.lon, entry.coords.lat) }));
    const trips = entries.filter((entry) => entry.kind === 'trip').length;
    readout.textContent = `Karte — ${trips} ${trips === 1 ? 'Trip' : 'Trips'}`;
    strip.setAttribute('aria-label', `Karte öffnen – ${trips} Trips auf der Weltkarte`);

    const path = (className, d) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('class', className);
      p.setAttribute('d', d);
      return p;
    };
    const markers = document.createElementNS(SVG_NS, 'g');
    svg.replaceChildren(
      path('map-strip__grid', graticulePath(projection, 10, 80)),
      path('map-strip__land', world.land),
      markers,
    );

    // Ausschnitt: alle Marker plus Rand, auf das Seitenverhältnis des Streifens erweitert
    const frame = () => {
      const xs = points.map(({ point }) => point[0]);
      const ys = points.map(({ point }) => point[1]);
      const pad = 40;
      let [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
      const aspect = svg.clientWidth / svg.clientHeight || 4;
      const width = Math.max(x1 - x0, (y1 - y0) * aspect);
      const height = width / aspect;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      [x0, y0] = [cx - width / 2, cy - height / 2];
      svg.setAttribute('viewBox', `${x0} ${y0} ${width} ${height}`);

      // Marker in Bildschirm-Pixeln gleich groß halten: Kartenkoordinaten pro Pixel
      const unit = width / (svg.clientWidth || 1);
      markers.replaceChildren(...points.map(({ entry, point }) => {
        const seed = seedOf(entry.id);
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'map-strip__marker');
        g.setAttribute('transform', `translate(${point[0]} ${point[1]}) scale(${unit})`);
        g.append(
          path('map-strip__contour', contourPath(9, seed + 0.3)),
          path('map-strip__contour', contourPath(5.5, seed)),
        );
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('class', 'map-strip__dot');
        dot.setAttribute('r', '2.2');
        g.append(dot);
        return g;
      }));
    };
    frame();
    new ResizeObserver(frame).observe(svg);
  } catch (error) {
    console.error(error);
  }
}
