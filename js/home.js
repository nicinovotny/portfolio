// Startseite: Hero-Diashow mit den Titelbildern der Favoriten ("featured" in albums.json, Mockup A2).
// Bildwechsel: langsame Überblendung + leichte „Kamerafahrt“ (Zoom 1.08 → 1).
// Die Fortschrittslinie ist zugleich der Taktgeber: ist sie voll, kommt das nächste Bild.

import { getFeatured, getCover, imageAttrs } from './data.js';
import { formatCoords, pad2 } from './format.js';

const SLIDE_DURATION = 7;    // Sekunden pro Bild
const FADE_DURATION = 1.6;   // Sekunden für die Überblendung

const gsap = window.gsap;    // per CDN geladen – fehlt es, wechseln die Bilder ohne Animation
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const hero = document.querySelector('[data-hero]');
const el = {
  slides: hero.querySelector('[data-hero-slides]'),
  caption: hero.querySelector('[data-hero-caption]'),
  label: hero.querySelector('[data-hero-label]'),
  title: hero.querySelector('[data-hero-title]'),
  links: hero.querySelector('[data-hero-links]'),
  open: hero.querySelector('[data-hero-open]'),
  map: hero.querySelector('[data-hero-map]'),
  number: hero.querySelector('[data-hero-number]'),
  total: hero.querySelector('[data-hero-total]'),
  progress: hero.querySelector('[data-hero-progress]'),
  demo: hero.querySelector('[data-hero-demo]'),
  pause: hero.querySelector('[data-hero-pause]'),
};

let albums = [];          // Favoriten in Diashow-Reihenfolge
let numbers = [];         // ihre Album-Nummern in der Gesamtliste
let slides = [];          // { root, img, attrs, loaded }
let dots = [];
let current = -1;
let changeId = 0;         // schützt vor überholten Wechseln bei schnellem Klicken
let progressTween = null;
let autoplay = Boolean(gsap) && !reducedMotion;   // ohne Bewegung keine automatische Diashow
let pausedBy = new Set(); // Gründe für eine Pause: 'user', 'focus', 'offscreen', 'hidden'

init();

async function init() {
  try {
    const featured = await getFeatured();
    albums = featured.map(({ album }) => album);
    numbers = featured.map(({ number }) => number);
  } catch (error) {
    console.error(error);
    el.title.textContent = 'Bilder konnten nicht geladen werden';
    return;
  }

  buildSlides();
  buildDots();
  el.total.textContent = `/ ${pad2(albums.length)}`;
  if (!autoplay) setPauseButton();

  await show(0, { initial: true });
  bindControls();
  setupScrollEffects();
}

// ---------- Aufbau ----------

function buildSlides() {
  slides = albums.map((album, index) => {
    const root = document.createElement('div');
    root.className = 'hero__slide';
    const img = document.createElement('img');
    img.alt = '';                   // Beschreibung steht im Alt-Text, sobald das Bild aktiv ist
    img.decoding = 'async';
    img.sizes = '100vw';
    if (index === 0) img.fetchPriority = 'high';
    root.append(img);
    el.slides.append(root);
    return { root, img, attrs: imageAttrs(album, getCover(album)), loaded: false };
  });
}

function buildDots() {
  dots = albums.map((album, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero__dot';
    button.setAttribute('aria-label', `${pad2(index + 1)}: ${[album.name, album.year].filter(Boolean).join(' ')}`);
    const fill = document.createElement('span');
    fill.className = 'hero__dot-fill';
    button.append(fill);
    button.addEventListener('click', () => goTo(index, { byUser: true }));
    li.append(button);
    el.progress.append(li);
    return { button, fill };
  });
}

/** Bild erst laden, wenn es gebraucht wird (aktuelles + nächstes). */
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

// ---------- Bildwechsel ----------

function goTo(index, { byUser = false } = {}) {
  const target = (index + albums.length) % albums.length;
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
  load((index + 1) % albums.length);

  const album = albums[index];
  const slide = slides[index];
  slide.img.alt = getCover(album).alt;

  // Alte Bildunterschrift ausblenden, während das neue Bild lädt
  const captionOut = !initial && gsap && !reducedMotion
    ? gsap.to([el.label, el.title, el.links], { autoAlpha: 0, y: -10, duration: 0.35, ease: 'power2.in', stagger: 0.04 })
    : null;

  await Promise.all([ready(slide.img), captionOut]);
  if (id !== changeId) return;   // inzwischen wurde schon ein anderes Bild gewählt
  updateMeta(index);

  // Neues Bild über das alte legen
  slides.forEach((s, i) => {
    s.root.style.zIndex = i === index ? 2 : i === previous ? 1 : 0;
  });

  if (gsap && !reducedMotion) {
    gsap.killTweensOf([slide.root, slide.img]);
    slide.root.classList.add('is-active');
    gsap.fromTo(slide.root, { autoAlpha: initial ? 1 : 0 }, {
      autoAlpha: 1,
      duration: initial ? 0 : FADE_DURATION,
      ease: 'power2.inOut',
      onComplete: () => hideOthers(index),
    });
    // Langsame Kamerafahrt über die ganze Standzeit
    gsap.fromTo(slide.img, { scale: 1.08 }, { scale: 1, duration: SLIDE_DURATION + FADE_DURATION, ease: 'power1.out' });
  } else {
    slide.root.classList.add('is-active');
    hideOthers(index);
  }

  updateCaption(album, index, initial);
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

function updateCaption(album, index, initial) {
  // „Album 03 — 2024 — 62°00′N 006°54′W“: Nummer aus der Gesamtliste, Jahr der Reise
  el.label.innerHTML = `Album ${pad2(numbers[index])} <span class="label__dash">—</span> `;
  if (album.year) el.label.append(`${album.year} `, Object.assign(document.createElement('span'), { className: 'label__dash', textContent: '—' }), ' ');
  el.label.append(formatCoords(album.coords));
  el.title.textContent = album.name;
  el.open.href = `album.html?ort=${encodeURIComponent(album.id)}`;
  el.map.href = `karte.html?ort=${encodeURIComponent(album.id)}`;

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
  el.demo.hidden = getCover(albums[index]).demo == null;
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
  el.pause.hidden = !gsap;
}

// ---------- Bedienung ----------

function bindControls() {
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

  // Einstieg darunter: Elemente nacheinander einblenden
  gsap.from('[data-reveal]', {
    autoAlpha: 0,
    y: 24,
    duration: 1,
    ease: 'power2.out',
    stagger: 0.12,
    scrollTrigger: { trigger: '.intro', start: 'top 80%', once: true },
  });
}
