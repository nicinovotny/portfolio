// Startseite (Mockup A2), vier Abschnitte:
//   1. Hero: ein Bild pro veröffentlichter Collection (Landscape zuerst) aus ihren Hero-Favoriten.
//      Welcher Favorit gezeigt wird, wechselt jede Stunde – für alle Besucher gleich, nichts wird gespeichert.
//      Bildwechsel: langsame Überblendung + leichte „Kamerafahrt“ (Zoom 1.08 → 1); die Fortschrittslinie
//      ist zugleich der Taktgeber: ist sie voll, kommt die nächste Collection.
//   2. Persönliches Intro mit Zahlen aus albums.json
//   3. Collections als Index: Liste links, Bildfenster rechts (Handy: Bild je Zeile)
//   4. Die drei neuesten Einträge + Kartenstreifen

import {
  collectionUrl, entryUrl, getCollectionCover, getCollectionEntries, getCollectionFrames, getCollections, getCover,
  getEntries, getHeroCollections, getMapEntries, getNewestEntries, hasOwnPage, imageAttrs,
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
  if (id !== changeId) return;   // inzwischen wurde schon ein anderes Bild gewählt
  applyScrim(hero, slide.img);   // Verläufe an die Bildhelligkeit anpassen
  slides.forEach((s, i) => s.root.toggleAttribute('data-current', i === index));   // Quelle für den Übergang
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

  // „Aus: Trip · Seoul · 2026 →“ – bei Frames „Aus: Frame · 2025“; ohne eigene Seite (Frames, Bildwand)
  // öffnet der Link die Collection mit diesem Bild in der Großansicht
  const isFrame = entry.kind === 'frame';
  el.origin.textContent = `Aus: ${[KIND_LABELS[entry.kind], isFrame ? null : entry.name, entry.year].filter(Boolean).join(' · ')}${isFrame ? '' : ' →'}`;
  el.origin.href = entryUrl(entry, image);
  // Ist das Bild das Titelbild des Eintrags, fliegt es beim Klick in dessen Bühne (js/transitions.js)
  if (hasOwnPage(entry) && getCover(entry) === image) {
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
// 3. Collections als Index mit Bildfenster
// =====================================================================

// Bildfenster rechts nur auf breiten Bildschirmen – darunter hat jede Zeile ihr eigenes Bild (css/home.css)
const indexQuery = matchMedia('(min-width: 64rem)');

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

async function initCollections() {
  const list = document.querySelector('[data-home-collections]');
  try {
    const collections = await getCollections();
    const data = await Promise.all(collections.map(async (collection) => {
      const [entries, frames, cover] = await Promise.all([
        getCollectionEntries(collection.id),
        getCollectionFrames(collection.id),
        getCollectionCover(collection),
      ]);
      return { collection, counts: formatCollectionCounts(entries, frames), cover };
    }));
    list.replaceChildren(...data.map((item, index) => collectionRow(item, index)));
    setupIndex(list, data);
  } catch (error) {
    console.error(error);
  }
}

/** Zeile: Nummer · Name (darunter Zähler und Text, klappen bei aktiver Zeile auf) · Pfeil; Handy: Bild darunter */
function collectionRow({ collection, counts, cover }, index) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'home-collection';
  link.href = collectionUrl(collection.id);
  link.dataset.index = index;
  if (index === 0) link.classList.add('is-active');

  const main = document.createElement('span');
  main.className = 'home-collection__main';
  main.append(Object.assign(document.createElement('span'), { className: 'home-collection__name', textContent: collection.name }));
  const detail = document.createElement('span');
  detail.className = 'home-collection__detail';
  detail.append(Object.assign(document.createElement('span'), { className: 'label', textContent: counts.join(' · ') || 'Noch leer' }));
  if (collection.text) detail.append(Object.assign(document.createElement('span'), { className: 'home-collection__text', textContent: collection.text }));
  main.append(detail);

  const arrow = document.createElement('span');
  arrow.className = 'home-collection__arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = ARROW;

  // eigenes Bild je Zeile – nur unter 64rem sichtbar
  const media = document.createElement('span');
  media.className = 'home-collection__media';
  media.setAttribute('aria-hidden', 'true');
  if (cover) {
    const img = Object.assign(document.createElement('img'), imageAttrs(cover.entry, cover.image));
    img.alt = '';
    img.sizes = '(min-width: 64rem) 1px, 100vw';
    img.loading = 'lazy';
    img.decoding = 'async';
    media.append(img);
  }

  link.append(
    Object.assign(document.createElement('span'), { className: 'home-collection__number label', textContent: pad2(index + 1) }),
    main,
    arrow,
    media,
  );
  item.append(link);
  return item;
}

/**
 * Bildfenster: ein Bild pro Collection übereinander, das der aktiven Zeile blendet mit leichtem Zoom ein.
 * Aktiv wird eine Zeile beim Überfahren oder per Tastatur (Fokus); ohne JavaScript bleibt Zeile 01 aktiv.
 */
function setupIndex(list, data) {
  const preview = document.querySelector('[data-home-preview]');
  const number = preview.querySelector('[data-home-preview-number]');
  const name = preview.querySelector('[data-home-preview-name]');
  preview.querySelector('[data-home-preview-total]').textContent = pad2(data.length);

  const images = data.map(({ cover }, index) => {
    if (!cover) return null;
    const img = Object.assign(document.createElement('img'), imageAttrs(cover.entry, cover.image));
    img.alt = '';
    img.className = 'home-index__img';
    img.sizes = '(min-width: 64rem) 40vw, 1px';
    // die übrigen lädt der Browser erst, wenn sie gebraucht werden; unter 64rem ist das Fenster ausgeblendet
    img.loading = index === 0 && indexQuery.matches ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (index === 0) img.classList.add('is-on');
    preview.prepend(img);
    return img;
  });

  const rows = [...list.querySelectorAll('.home-collection')];
  const activate = (index) => {
    rows.forEach((row, i) => row.classList.toggle('is-active', i === index));
    images.forEach((img, i) => img?.classList.toggle('is-on', i === index));
    if (images[index] && indexQuery.matches) images[index].loading = 'eager';
    number.textContent = pad2(index + 1);
    name.textContent = data[index].collection.name;
  };
  activate(0);
  rows.forEach((row, index) => {
    row.addEventListener('mouseenter', () => { if (indexQuery.matches) activate(index); });
    row.addEventListener('focus', () => activate(index));
  });
  // Alle Bilder des Fensters vorladen, sobald die Liste in die Nähe kommt – dann wechselt es ohne Wartezeit
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting || !indexQuery.matches) return;
    observer.disconnect();
    images.forEach((img) => { if (img) img.loading = 'eager'; });
  }, { rootMargin: '300px' }).observe(list);
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
