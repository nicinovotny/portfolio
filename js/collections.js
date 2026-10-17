// Collections-Übersicht (collections.html): alle veröffentlichten Collections in fester Reihenfolge,
// je eine große Zeile mit Ziffer, Zähler, Titelbild, Name und kurzem Text. Ganze Zeile ist der Link.

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

/** Zeile: „01 ·········· 21 Trips“, darunter Titelbild + Name, Text, „Collection öffnen“ */
function row(collection, index, counts, cover) {
  const item = document.createElement('li');
  item.className = 'collection-row';

  const link = document.createElement('a');
  link.className = 'collection-row__link';
  link.href = collectionUrl(collection.id);

  // Kopfzeile wie ein Instrument: Ziffer, gepunktete Führungslinie, Zähler
  const top = document.createElement('div');
  top.className = 'collection-row__top';
  top.append(
    Object.assign(document.createElement('span'), { className: 'label', textContent: pad2(index + 1) }),
    Object.assign(document.createElement('span'), { className: 'collection-row__leader' }),
    Object.assign(document.createElement('span'), { className: 'label', textContent: counts.join(' · ') || 'Noch leer' }),
  );
  top.children[1].setAttribute('aria-hidden', 'true');

  const figure = document.createElement('div');
  figure.className = 'collection-row__image';
  if (cover) {
    const img = Object.assign(document.createElement('img'), imageAttrs(cover.entry, cover.image));
    img.alt = '';   // dekorativ: der Name daneben beschreibt den Link
    img.sizes = '(min-width: 48rem) 58vw, 100vw';
    img.loading = index < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    figure.append(img);
  } else {
    figure.classList.add('is-empty');
  }

  const info = document.createElement('div');
  info.className = 'collection-row__info';
  info.append(Object.assign(document.createElement('h2'), { className: 'collection-row__name', textContent: collection.name }));
  if (collection.text) info.append(Object.assign(document.createElement('p'), { className: 'collection-row__text', textContent: collection.text }));
  info.append(Object.assign(document.createElement('span'), { className: 'line-link', textContent: 'Collection öffnen' }));

  const body = document.createElement('div');
  body.className = 'collection-row__body';
  body.append(figure, info);

  link.append(top, body);
  item.append(link);
  return item;
}
