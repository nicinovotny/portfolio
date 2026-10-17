// Eintragsseite (entry.html?id=<id>): Bühne mit Titelbild, darüber schiebt sich der Inhalt.
// Zwei Layouts je nach Art des Eintrags ("kind" in albums.json):
//   trip  – Galerie in Bildzeilen gleicher Höhe (viele Bilder, Ort im Mittelpunkt)
//   shoot – großzügige Bildstrecke: Querformate einzeln groß, zwei Hochformate nebeneinander
// Frames haben keine eigene Seite und werden zur Collection weitergeleitet.
// Voriger/nächster Eintrag bleibt innerhalb der Collection. Die Großansicht steckt in js/lightbox.js.

import {
  canonicalId, collectionUrl, entryUrl, getCollection, getCollectionEntries, getCollections, getCover, getEntry, getRegions,
  imageAttrs, imageRef, imageUrl, regionPath,
} from './data.js';
import { KIND_LABELS, formatCoords, formatWhen, nameWithYear, pad2 } from './format.js';
import { createLightbox } from './lightbox.js';
import { applyScrim } from './scrim.js';

const gsap = window.gsap;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animated = Boolean(gsap) && !reducedMotion;

const root = document.querySelector('[data-entry]');
const el = {
  stage: root.querySelector('[data-entry-stage]'),
  cover: root.querySelector('[data-entry-cover]'),
  caption: root.querySelector('[data-entry-caption]'),
  count: root.querySelector('[data-entry-count]'),
  label: root.querySelector('[data-entry-label]'),
  title: root.querySelector('[data-entry-title]'),
  text: root.querySelector('[data-entry-text]'),
  facts: root.querySelector('[data-entry-facts]'),
  map: root.querySelector('[data-entry-map]'),
  back: root.querySelectorAll('[data-entry-back]'),
  gallery: root.querySelector('[data-gallery]'),
  pager: root.querySelector('[data-entry-pager]'),
  stageNav: root.querySelector('[data-stage-nav]'),
};

let items = [];       // { figure, button, img, ratio, attrs }
let lastWidth = 0;

init();

async function init() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('id');
  const id = canonicalId(requested);

  let entry;
  let regions;
  try {
    [entry, regions] = await Promise.all([getEntry(id), getRegions()]);
  } catch (error) {
    console.error(error);
    showMissing('Seite konnte nicht geladen werden', 'Läuft die Seite über einen lokalen Server (z. B. npx serve)?');
    return;
  }

  if (!entry) {
    showMissing('Nicht gefunden', id ? `Zu „${id}“ gibt es keinen Eintrag.` : 'Es wurde kein Eintrag angegeben.');
    return;
  }

  // Frames haben keine eigene Seite: Collection öffnen, dort zeigt die Lightbox das Bild
  if (entry.kind === 'frame') {
    const target = new URL(collectionUrl(entry.collection), location.href);
    target.searchParams.set('bild', imageRef(entry, entry.images[0]));
    location.replace(target);
    return;
  }

  // Alte id in der Adresse (z. B. "kleinarl") stillschweigend durch die neue ersetzen
  if (requested !== entry.id) {
    params.set('id', entry.id);
    history.replaceState(history.state, '', `?${params}`);
  }

  const [collection, siblings, collections] = await Promise.all([
    getCollection(entry.collection),
    getCollectionEntries(entry.collection),
    getCollections({ all: true }),
  ]);

  root.dataset.kind = entry.kind;
  renderHead(entry, collection, regions);
  renderStage(entry);
  if (entry.kind === 'shoot') renderStrip(entry);
  else renderGallery(entry);
  renderPager(siblings, siblings.findIndex((e) => e.id === entry.id));
  watchStageCover();
  setupStageScroll();

  const lightbox = createLightbox({
    images: entry.images.map((image) => ({ entry, image })),
    thumbs: (i) => items[i],
    collections,
    currentEntryId: entry.id,
  });
  items.forEach(({ button }, i) => button.addEventListener('click', () => lightbox.open(i)));
}

// ---------- Kopf ----------

/** Mono-Label aus Teilen, getrennt durch einen Strich in Akzentfarbe: „Trip — Aug 2024 · 12 Tage — 62°00′N …“ */
function setLabel(target, parts) {
  target.replaceChildren();
  parts.filter(Boolean).forEach((part, index) => {
    if (index) target.append(' ', Object.assign(document.createElement('span'), { className: 'label__dash', textContent: '—' }), ' ');
    target.append(part);
  });
}

function renderHead(entry, collection, regions) {
  const when = formatWhen(entry);
  document.title = `${nameWithYear(entry)} – Nicolas Novotny`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', entry.text ?? '');

  setLabel(el.label, [KIND_LABELS[entry.kind], when, entry.coords && formatCoords(entry.coords)]);
  el.title.textContent = entry.name;
  el.count.textContent = `${pad2(entry.images.length)} Bilder`;
  el.text.textContent = entry.text ?? '';

  // „Auf der Karte zeigen“ nur bei Einträgen mit Ort
  if (entry.coords) el.map.href = `karte.html?ort=${encodeURIComponent(entry.id)}`;
  else el.map.hidden = true;

  // „Zurück zu Landscape“ – oben in der Einleitung und unten bei der Navigation
  el.back.forEach((link) => {
    link.href = collectionUrl(entry.collection);
    link.querySelector('[data-entry-back-name]').textContent = collection?.name ?? 'Übersicht';
  });

  const timeTerm = entry.dateStart ? 'Zeitraum' : entry.date ? 'Datum' : 'Jahr';
  const facts = [
    [timeTerm, when],
    ['Land', entry.country],
    // Großregion (z. B. Nordeuropa, Mitteleuropa) – das Land steht schon daneben
    ['Region', entry.region && regions[regionPath(regions, entry.region)[1] ?? entry.region]?.name],
    ['Bilder', pad2(entry.images.length)],
  ];
  el.facts.replaceChildren(...facts.filter(([, value]) => value).map(([term, value]) => {
    const wrap = document.createElement('div');
    const dt = Object.assign(document.createElement('dt'), { className: 'label', textContent: term });
    const dd = Object.assign(document.createElement('dd'), { textContent: value });
    wrap.append(dt, dd);
    return wrap;
  }));
}

// ---------- Bühne ----------

/** Titelbild in voller Größe; war es schon vom Seitenübergang da, wird nur die passende Größe nachgeladen */
function renderStage(entry) {
  const cover = getCover(entry);
  const { src, srcset, width, height } = imageAttrs(entry, cover);
  const img = el.cover;
  Object.assign(img, { width, height, alt: cover.alt, sizes: '100vw' });
  img.srcset = srcset;
  if (!img.getAttribute('src')) img.src = src;

  const whenReady = () => applyScrim(el.stage, img);   // Verläufe an die Bildhelligkeit anpassen
  if (img.complete && img.naturalWidth) whenReady();
  img.addEventListener('load', whenReady);

  // Kein eigenes Einblenden des Titels: Den Auftritt übernimmt der Seitenübergang (Bild + Titel gleiten an
  // ihren Platz). Eine zusätzliche Animation würde sich mit ihm überschneiden.
}

/** Bühne verdeckt? Dann nimmt sie nicht am Seitenübergang teil (siehe css/entry.css, .is-covered) */
function watchStageCover() {
  let ticking = false;
  const update = () => {
    ticking = false;
    el.stage.classList.toggle('is-covered', scrollY > el.stage.offsetHeight * 0.4);
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

/** Beim Scrollen: Bild zoomt leicht und dunkelt ab, Titel verschwindet, der Inhalt schiebt sich darüber */
function setupStageScroll() {
  const ScrollTrigger = window.ScrollTrigger;
  if (!animated || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const scroll = { trigger: el.stage, start: 'top top', end: () => `+=${el.stage.offsetHeight}`, scrub: true };
  gsap.to(el.cover, { scale: 1.08, ease: 'none', scrollTrigger: scroll });
  gsap.to(el.stage, { '--stage-fade': 0.65, ease: 'none', scrollTrigger: scroll });
  gsap.to([el.caption, el.count.parentElement, el.stageNav], {
    autoAlpha: 0,
    y: -48,
    ease: 'none',
    scrollTrigger: { ...scroll, end: () => `+=${el.stage.offsetHeight * 0.5}` },
  });
}

function showMissing(title, text) {
  root.classList.add('entry-missing');
  el.label.textContent = '';
  el.title.textContent = title;
  el.text.textContent = text;
  el.gallery.hidden = true;
}

// ---------- Bilder (gemeinsam für Galerie und Bildstrecke) ----------

/** Ein Bild mit Knopf zur Großansicht und Bildunterschrift (Nummer + Titel) */
function createItem(entry, image, index) {
  const figure = document.createElement('figure');
  figure.className = 'gallery__item';
  figure.setAttribute('role', 'listitem');
  const ratio = image.width / image.height;
  figure.style.setProperty('--ratio', ratio);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gallery__open';
  button.setAttribute('aria-haspopup', 'dialog');

  // Maße sofort setzen (keine Layout-Sprünge), Quelle erst, wenn die Anzeigebreite feststeht (passende sizes)
  const attrs = imageAttrs(entry, image);
  const img = document.createElement('img');
  Object.assign(img, { width: attrs.width, height: attrs.height, alt: attrs.alt, decoding: 'async', loading: index < 2 ? 'eager' : 'lazy' });
  if (index === 0) img.fetchPriority = 'high';
  const hint = Object.assign(document.createElement('span'), { className: 'visually-hidden', textContent: ' – Großansicht öffnen' });
  button.append(img, hint);

  const caption = document.createElement('figcaption');
  caption.className = 'gallery__caption';
  caption.append(
    Object.assign(document.createElement('span'), { className: 'label', textContent: pad2(index + 1) }),
    Object.assign(document.createElement('span'), { textContent: image.title ?? '' }),
  );

  figure.append(button, caption);
  return { figure, button, img, ratio, attrs };
}

function load({ img, attrs }) {
  const done = () => img.classList.add('is-loaded');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
  img.srcset = attrs.srcset;
  img.src = attrs.src;
  if (img.complete && img.naturalWidth) done();
}

// ---------- Trip: Galerie in Bildzeilen ----------

function renderGallery(entry) {
  items = entry.images.map((image, index) => createItem(entry, image, index));
  layout();
  items.forEach(load);
  new ResizeObserver(() => layout()).observe(el.gallery);
}

/** Zielhöhe einer Bildzeile – auf großen Bildschirmen höher */
function targetRowHeight(width) {
  return Math.min(420, Math.max(220, width * 0.3));
}

/**
 * Teilt die Bilder in Zeilen auf. Eine Zeile wird geschlossen, sobald sie voll ist –
 * vor oder nach dem nächsten Bild, je nachdem, welche Höhe näher an der Zielhöhe liegt.
 * Ist die letzte Zeile nur halb voll, behält sie die Zielhöhe statt riesig zu werden.
 */
function buildRows(ratios, width, gap) {
  // Schmale Bildschirme: ein Bild pro Zeile
  if (width < 560) return ratios.map((ratio, index) => ({ items: [index], height: width / ratio, full: true }));

  const target = targetRowHeight(width);
  const heightOf = (sum, count) => (width - gap * (count - 1)) / sum;
  const rows = [];
  let row = [];
  let sum = 0;

  ratios.forEach((ratio, index) => {
    if (row.length && (sum + ratio) * target + gap * row.length > width) {
      const without = heightOf(sum, row.length);
      const withNext = heightOf(sum + ratio, row.length + 1);
      if (Math.abs(withNext - target) < Math.abs(without - target)) {
        rows.push({ items: [...row, index], height: withNext, full: true });
        row = [];
        sum = 0;
        return;
      }
      rows.push({ items: row, height: without, full: true });
      row = [];
      sum = 0;
    }
    row.push(index);
    sum += ratio;
  });

  if (row.length) {
    const natural = sum * target + gap * (row.length - 1);
    const full = natural >= width * 0.75;
    rows.push({ items: row, height: full ? heightOf(sum, row.length) : target, full, maxWidth: natural });
  }
  return rows;
}

function layout() {
  const width = el.gallery.clientWidth;
  if (!width || width === lastWidth) return;
  lastWidth = width;

  const gap = parseFloat(getComputedStyle(el.gallery).columnGap) || 0;
  const rows = buildRows(items.map((item) => item.ratio), width, gap);
  const focused = items.find((item) => item.button === document.activeElement);

  el.gallery.replaceChildren(...rows.map((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'gallery__row';
    rowEl.setAttribute('role', 'none');
    if (!row.full) rowEl.style.maxWidth = `${row.maxWidth}px`;
    row.items.forEach((index) => {
      const item = items[index];
      // Anzeigebreite → der Browser wählt die passende Größe aus dem srcset
      item.img.sizes = `${Math.ceil(row.height * item.ratio)}px`;
      rowEl.append(item.figure);
    });
    return rowEl;
  }));

  focused?.button.focus({ preventScroll: true });   // Umhängen im DOM verliert sonst den Fokus
}

// ---------- Shoot: Bildstrecke ----------

/**
 * Großzügige Bildstrecke im Magazin-Stil, damit auch 3–5 Bilder hochwertig wirken:
 * Querformate stehen einzeln und groß, zwei aufeinanderfolgende Hochformate teilen sich eine Zeile.
 * Die Größen regelt css/entry.css (höchstens ca. 86 % der Fensterhöhe, nie beschnitten).
 */
function renderStrip(entry) {
  items = entry.images.map((image, index) => createItem(entry, image, index));
  el.gallery.classList.replace('gallery', 'strip');

  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const pair = items[i].ratio < 1 && items[i + 1]?.ratio < 1;
    rows.push(pair ? [items[i], items[++i]] : [items[i]]);
  }

  el.gallery.replaceChildren(...rows.map((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'strip__row';
    rowEl.setAttribute('role', 'none');
    rowEl.style.setProperty('--row-ratio', row.reduce((sum, item) => sum + item.ratio, 0));
    rowEl.style.setProperty('--row-gaps', row.length - 1);
    rowEl.append(...row.map((item) => item.figure));
    return rowEl;
  }));

  // Anzeigebreite erst nach dem Layout bekannt → passende Größe aus dem srcset
  const updateSizes = () => items.forEach(({ img, button }) => { img.sizes = `${Math.ceil(button.clientWidth) || 1200}px`; });
  updateSizes();
  items.forEach(load);
  new ResizeObserver(updateSizes).observe(el.gallery);
}

// ---------- Voriger / nächster Eintrag ----------

/**
 * Voriger/nächster Eintrag derselben Collection – unten nach den Bildern und direkt auf der Bühne.
 * Die Titelbilder der Nachbarn werden leise vorgeladen und beim Klick an die nächste Seite übergeben
 * (js/transitions.js), damit der Wechsel ohne harten Schnitt gelingt.
 */
function renderPager(siblings, index) {
  if (index === -1 || siblings.length < 2) return;
  const neighbours = [-1, 1].map((offset) => {
    const position = (index + offset + siblings.length) % siblings.length;
    const entry = siblings[position];
    return {
      key: offset < 0 ? 'prev' : 'next',
      href: entryUrl(entry),
      number: pad2(position + 1),
      kind: KIND_LABELS[entry.kind],
      name: nameWithYear(entry),
      shortName: nameWithYear(entry, entry.shortName ?? entry.name),   // Bühne: wenig Platz
      entryName: entry.name,
      cover: imageUrl(entry, getCover(entry), 1200),
    };
  });

  for (const { key, href, number, kind, name, shortName, entryName, cover } of neighbours) {
    for (const scope of [el.pager, el.stageNav]) {
      const link = scope.querySelector(`[data-pager-${key}]`);
      link.href = href;
      link.dataset.coverSrc = cover;
      link.dataset.entryName = entryName;
      scope.querySelector(`[data-pager-${key}-number]`).textContent = number;
      scope.querySelector(`[data-pager-${key}-name]`).textContent = scope === el.stageNav ? shortName : name;
      const kindLabel = scope.querySelector(`[data-pager-${key}-kind]`);
      if (kindLabel) kindLabel.textContent = `${key === 'prev' ? 'Voriger' : 'Nächster'} ${kind}`;
    }
  }
  el.pager.hidden = false;
  el.stageNav.hidden = false;

  // Nachbar-Titelbilder vorladen, sobald die Seite zur Ruhe gekommen ist
  const preload = () => neighbours.forEach(({ cover }) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = cover;
  });
  if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 3000 });
  else setTimeout(preload, 1500);
}
