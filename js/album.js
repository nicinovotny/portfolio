// Albumseite (album.html?ort=<id>): Bühne mit Titelbild, darüber schiebt sich der Inhalt
// (Einleitung, Galerie in Bildzeilen, Navigation zum vorigen/nächsten Ort).
// Die Großansicht steckt in js/lightbox.js.

import { canonicalId, getAlbums, getRegions, getCover, imageAttrs, imageUrl, regionPath } from './data.js';
import { formatCoords, pad2 } from './format.js';
import { createLightbox } from './lightbox.js';
import { applyScrim } from './scrim.js';

const gsap = window.gsap;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animated = Boolean(gsap) && !reducedMotion;

const root = document.querySelector('[data-album]');
const el = {
  stage: root.querySelector('[data-album-stage]'),
  cover: root.querySelector('[data-album-cover]'),
  caption: root.querySelector('[data-album-caption]'),
  count: root.querySelector('[data-album-count]'),
  label: root.querySelector('[data-album-label]'),
  title: root.querySelector('[data-album-title]'),
  text: root.querySelector('[data-album-text]'),
  facts: root.querySelector('[data-album-facts]'),
  map: root.querySelector('[data-album-map]'),
  gallery: root.querySelector('[data-gallery]'),
  pager: root.querySelector('[data-album-pager]'),
  stageNav: root.querySelector('[data-stage-nav]'),
};

let items = [];       // { figure, button, img, ratio }
let lastWidth = 0;

init();

async function init() {
  const id = canonicalId(new URLSearchParams(location.search).get('ort'));   // alte ids führen weiter
  let albums;
  let regions;
  try {
    [albums, regions] = await Promise.all([getAlbums(), getRegions()]);
  } catch (error) {
    console.error(error);
    showMissing('Album konnte nicht geladen werden', 'Läuft die Seite über einen lokalen Server (z. B. npx serve)?');
    return;
  }

  const index = albums.findIndex((album) => album.id === id);
  if (index === -1) {
    showMissing('Album nicht gefunden', id ? `Zu „${id}“ gibt es kein Album.` : 'Es wurde kein Ort angegeben.');
    return;
  }

  const album = albums[index];
  renderHead(album, index, regions);
  renderStage(album);
  renderGallery(album);
  renderPager(albums, index);
  watchStageCover();
  setupStageScroll();

  const lightbox = createLightbox({
    dialog: document.querySelector('[data-lightbox]'),
    album,
    thumbs: (i) => items[i],
  });
  items.forEach(({ button }, i) => button.addEventListener('click', () => lightbox.open(i)));
}

// ---------- Kopf ----------

function renderHead(album, index, regions) {
  document.title = `${[album.name, album.year].filter(Boolean).join(' ')} – Nicolas Novotny`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', album.text);

  el.label.innerHTML = `Album ${pad2(index + 1)} <span class="label__dash">—</span> `;
  if (album.year) el.label.append(`${album.year} `, Object.assign(document.createElement('span'), { className: 'label__dash', textContent: '—' }), ' ');
  el.label.append(formatCoords(album.coords));
  el.title.textContent = album.name;
  el.count.textContent = `${pad2(album.images.length)} Bilder`;
  el.text.textContent = album.text;
  el.map.href = `karte.html?ort=${encodeURIComponent(album.id)}`;

  const facts = [
    ['Jahr', album.year],
    ['Land', album.country],
    // Großregion (z. B. Nordeuropa, Mitteleuropa) – das Land steht schon in der Zeile darüber
    ['Region', regions[regionPath(regions, album.region)[1] ?? album.region]?.name],
    ['Bilder', pad2(album.images.length)],
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
function renderStage(album) {
  const cover = getCover(album);
  const { src, srcset, width, height } = imageAttrs(album, cover);
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

/** Bühne verdeckt? Dann nimmt sie nicht am Seitenübergang teil (siehe css/album.css, .is-covered) */
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
  root.classList.add('album-missing');
  el.label.textContent = 'Album';
  el.title.textContent = title;
  el.text.textContent = text;
  el.gallery.hidden = true;
}

// ---------- Galerie ----------

function renderGallery(album) {
  items = album.images.map((image, index) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery__item';
    figure.setAttribute('role', 'listitem');
    const ratio = image.width / image.height;
    figure.style.setProperty('--ratio', ratio);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery__open';
    button.setAttribute('aria-haspopup', 'dialog');

    // Maße sofort setzen (keine Layout-Sprünge), Quelle erst nach dem Zeilenumbruch (passende sizes)
    const img = document.createElement('img');
    const { width, height, alt } = imageAttrs(album, image);
    Object.assign(img, { width, height, alt, decoding: 'async', loading: index < 2 ? 'eager' : 'lazy' });
    if (index === 0) img.fetchPriority = 'high';
    const hint = Object.assign(document.createElement('span'), { className: 'visually-hidden', textContent: ' – Großansicht öffnen' });
    button.append(img, hint);

    const caption = document.createElement('figcaption');
    caption.className = 'gallery__caption';
    caption.append(
      Object.assign(document.createElement('span'), { className: 'label', textContent: pad2(index + 1) }),
      Object.assign(document.createElement('span'), { textContent: image.title }),
    );

    figure.append(button, caption);
    return { figure, button, img, ratio, attrs: imageAttrs(album, image) };
  });

  layout();
  items.forEach(load);
  new ResizeObserver(() => layout()).observe(el.gallery);
}

function load({ img, attrs }) {
  const done = () => img.classList.add('is-loaded');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
  img.srcset = attrs.srcset;
  img.src = attrs.src;
  if (img.complete && img.naturalWidth) done();
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

// ---------- Voriger / nächster Ort ----------

/**
 * Voriger/nächster Ort – unten nach der Galerie und direkt auf der Bühne.
 * Die Titelbilder der Nachbarn werden leise vorgeladen und beim Klick an die nächste Seite übergeben
 * (js/transitions.js), damit der Wechsel ohne harten Schnitt gelingt.
 */
function renderPager(albums, index) {
  if (albums.length < 2) return;
  const neighbours = [-1, 1].map((offset) => {
    const number = (index + offset + albums.length) % albums.length;
    const album = albums[number];
    return {
      key: offset < 0 ? 'prev' : 'next',
      href: `album.html?ort=${encodeURIComponent(album.id)}`,
      number: pad2(number + 1),
      name: [album.name, album.year].filter(Boolean).join(' '),
      albumName: album.name,
      cover: imageUrl(album, getCover(album), 1200),
    };
  });

  for (const { key, href, number, name, albumName, cover } of neighbours) {
    for (const scope of [el.pager, el.stageNav]) {
      const link = scope.querySelector(`[data-pager-${key}]`);
      link.href = href;
      link.dataset.coverSrc = cover;
      link.dataset.albumName = albumName;
      scope.querySelector(`[data-pager-${key}-number]`).textContent = number;
      scope.querySelector(`[data-pager-${key}-name]`).textContent = name;
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
