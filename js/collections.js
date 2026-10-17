// Collections-Übersicht (collections.html): alle veröffentlichten Collections in fester Reihenfolge,
// je eine kompakte Zeile im Zickzack: Titelbild, daneben Ziffer, Name, Zähler und kurzer Text. Ganze Zeile ist der Link.

import {
  collectionUrl, getCollectionCover, getCollectionEntries, getCollectionFrames, getCollections, imageAttrs,
} from './data.js';
import { formatCollectionCounts, pad2 } from './format.js';

const list = document.querySelector('[data-collections]');
const count = document.querySelector('[data-collections-count]');

try {
  const collections = await getCollections();
  count.textContent = `${pad2(collections.length)} Collections`;
  const rows = await Promise.all(collections.map(async (collection, index) => {
    const [entries, frames, cover] = await Promise.all([
      getCollectionEntries(collection.id),
      getCollectionFrames(collection.id),
      getCollectionCover(collection),
    ]);
    return row(collection, index, formatCollectionCounts(entries, frames), cover);
  }));
  list.replaceChildren(...rows);
} catch (error) {
  console.error(error);
  list.outerHTML = '<p class="status-error">Die Collections konnten nicht geladen werden. Läuft die Seite über einen lokalen Server (z. B. <code>npx serve</code>)?</p>';
}

/**
 * Zeile im Zickzack: Titelbild auf gut der halben Breite, daneben eine ruhige Fläche mit Ziffer, Name,
 * Zähler und kurzem Text. Jede zweite Zeile ist gespiegelt (css/collections.css). Ganze Zeile = Link.
 */
function row(collection, index, counts, cover) {
  const item = document.createElement('li');

  const link = document.createElement('a');
  link.className = 'collection-row';
  link.href = collectionUrl(collection.id);

  const figure = document.createElement('div');
  figure.className = 'collection-row__image';
  if (cover) {
    const img = Object.assign(document.createElement('img'), imageAttrs(cover.entry, cover.image));
    img.alt = '';   // dekorativ: der Name daneben beschreibt den Link
    img.sizes = '(min-width: 80rem) 36rem, (min-width: 48rem) 50vw, 100vw';   // Liste höchstens 72rem breit, Bild = Hälfte
    img.loading = index < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    figure.append(img);
  } else {
    figure.classList.add('is-empty');
  }

  const panel = document.createElement('div');
  panel.className = 'collection-row__panel';
  panel.append(
    Object.assign(document.createElement('span'), { className: 'collection-row__number label label--quiet', textContent: pad2(index + 1) }),
    Object.assign(document.createElement('h2'), { className: 'collection-row__name', textContent: collection.name }),
    Object.assign(document.createElement('span'), { className: 'collection-row__count label', textContent: counts.join(' · ') || 'Noch leer' }),
  );
  if (collection.text) panel.append(Object.assign(document.createElement('p'), { className: 'collection-row__text', textContent: collection.text }));

  link.append(figure, panel);
  item.append(link);
  return item;
}
