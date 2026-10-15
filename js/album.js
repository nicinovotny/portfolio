// Albumseite (album.html?ort=<id>): Kopf mit Ortsangaben, Galerie in Bildzeilen,
// Navigation zum vorigen/nächsten Ort. Die Großansicht steckt in js/lightbox.js.

import { getAlbums, getRegions, imageAttrs } from './data.js';
import { formatCoords, pad2 } from './format.js';
import { createLightbox } from './lightbox.js';

const root = document.querySelector('[data-album]');
const el = {
  label: root.querySelector('[data-album-label]'),
  title: root.querySelector('[data-album-title]'),
  text: root.querySelector('[data-album-text]'),
  facts: root.querySelector('[data-album-facts]'),
  map: root.querySelector('[data-album-map]'),
  gallery: root.querySelector('[data-gallery]'),
  pager: root.querySelector('[data-album-pager]'),
};

let items = [];       // { figure, button, img, ratio }
let lastWidth = 0;

init();

async function init() {
  const id = new URLSearchParams(location.search).get('ort');
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
  renderGallery(album);
  renderPager(albums, index);

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
  el.text.textContent = album.text;
  el.map.href = `karte.html?ort=${encodeURIComponent(album.id)}`;

  const facts = [
    ['Jahr', album.year],
    ['Land', album.country],
    ['Region', regions[album.region]?.name],
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
    for (const index of row.items) {
      const item = items[index];
      // Anzeigebreite → der Browser wählt die passende Größe aus dem srcset
      item.img.sizes = `${Math.ceil(row.height * item.ratio)}px`;
      rowEl.append(item.figure);
    }
    return rowEl;
  }));

  focused?.button.focus({ preventScroll: true });   // Umhängen im DOM verliert sonst den Fokus
}

// ---------- Voriger / nächster Ort ----------

function renderPager(albums, index) {
  if (albums.length < 2) return;
  const fill = (key, offset) => {
    const target = (index + offset + albums.length) % albums.length;
    const album = albums[target];
    el.pager.querySelector(`[data-pager-${key}]`).href = `album.html?ort=${encodeURIComponent(album.id)}`;
    el.pager.querySelector(`[data-pager-${key}-number]`).textContent = pad2(target + 1);
    el.pager.querySelector(`[data-pager-${key}-name]`).textContent = [album.name, album.year].filter(Boolean).join(' ');
  };
  fill('prev', -1);
  fill('next', 1);
  el.pager.hidden = false;
}
