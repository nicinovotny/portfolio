// Galerie in Bildzeilen gleicher Höhe (wie Flickr/Google Fotos): Bilder werden nie beschnitten,
// Hoch- und Querformate mischen sich. Genutzt von der Eintragsseite (Trips) und der Collection-Seite (Frames).
// Den Zeilenumbruch rechnet dieses Modul, die Breiten verteilt CSS (flex-grow = Seitenverhältnis,
// css/entry.css bzw. css/collection.css: .gallery, .gallery__row, .gallery__item).

import { imageAttrs } from './data.js';
import { pad2 } from './format.js';

/**
 * Ein Bild mit Knopf zur Großansicht und Bildunterschrift.
 * @param caption  Inhalt der Bildunterschrift (Knoten); Standard: Nummer + Titel
 * @returns { figure, button, img, ratio, attrs }
 */
export function createGalleryItem(entry, image, index, caption = null) {
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
  // lazy: Bilder im sichtbaren Bereich lädt der Browser trotzdem sofort – aber erst nach dem Titelbild der
  // Bühne, das Vorrang hat (vorher konkurrierte das erste Galeriebild mit hoher Priorität um die Leitung)
  Object.assign(img, { width: attrs.width, height: attrs.height, alt: attrs.alt, decoding: 'async', loading: 'lazy' });
  const hint = Object.assign(document.createElement('span'), { className: 'visually-hidden', textContent: ' – Großansicht öffnen' });
  button.append(img, hint);

  const figcaption = document.createElement('figcaption');
  figcaption.className = 'gallery__caption';
  if (caption) figcaption.append(caption);
  else {
    figcaption.append(
      Object.assign(document.createElement('span'), { className: 'label', textContent: pad2(index + 1) }),
      Object.assign(document.createElement('span'), { textContent: image.title ?? '' }),
    );
  }

  figure.append(button, figcaption);
  return { figure, button, img, ratio, attrs };
}

/** Bildquelle setzen; weich einblenden, sobald geladen (css: .gallery__open img.is-loaded) */
export function loadGalleryImage({ img, attrs }) {
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

/**
 * Ordnet die Bilder in Zeilen an, lädt sie und ordnet bei jeder Größenänderung neu.
 * @param container  .gallery-Element (column-gap liefert den Abstand)
 * @param items      Ergebnisse von createGalleryItem
 */
export function justifyGallery(container, items) {
  let lastWidth = 0;

  function layout() {
    const width = container.clientWidth;
    if (!width || width === lastWidth) return;
    lastWidth = width;

    const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
    const rows = buildRows(items.map((item) => item.ratio), width, gap);
    const focused = container.contains(document.activeElement) ? document.activeElement : null;

    container.replaceChildren(...rows.map((row) => {
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

    focused?.focus({ preventScroll: true });   // Umhängen im DOM verliert sonst den Fokus
  }

  layout();
  items.forEach(loadGalleryImage);
  new ResizeObserver(layout).observe(container);
}
