// Album-Übersicht (alben.html): alle Reisen aus data/albums.json, gruppiert nach Jahr (neueste zuerst).

import { entryUrl, getAlbums, getCover, imageAttrs } from './data.js';
import { formatCoords, pad2 } from './format.js';

const container = document.querySelector('[data-album-years]');
const count = document.querySelector('[data-album-count]');

try {
  const albums = await getAlbums();
  count.textContent = `${pad2(albums.length)} Reisen`;

  // Nach Jahr gruppieren; Reisen ohne Jahr kommen ans Ende
  const years = new Map();
  albums.forEach((album, index) => {
    const year = album.year ?? null;
    if (!years.has(year)) years.set(year, []);
    years.get(year).push({ album, number: index + 1 });
  });
  const order = [...years.keys()].sort((a, b) => (a === null) - (b === null) || b - a);

  let imageCount = 0;
  container.append(...order.map((year) => {
    const entries = years.get(year);
    const section = document.createElement('section');
    section.className = 'album-year';
    const headingId = `jahr-${year ?? 'ohne'}`;
    section.setAttribute('aria-labelledby', headingId);

    const head = document.createElement('div');
    head.className = 'album-year__head';
    const heading = Object.assign(document.createElement('h2'), {
      className: 'album-year__title',
      id: headingId,
      textContent: year ?? 'Ohne Jahr',
    });
    const meta = Object.assign(document.createElement('p'), {
      className: 'label label--quiet',
      textContent: `${pad2(entries.length)} ${entries.length === 1 ? 'Album' : 'Alben'}`,
    });
    head.append(heading, meta);

    const grid = document.createElement('ol');
    grid.className = 'album-grid';
    grid.append(...entries.map(({ album, number }) => card(album, number, imageCount++)));

    section.append(head, grid);
    return section;
  }));
} catch (error) {
  console.error(error);
  container.innerHTML = '<p class="status-error">Die Alben konnten nicht geladen werden. Läuft die Seite über einen lokalen Server (z. B. <code>npx serve</code>)?</p>';
}

function card(album, number, position) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'album-card';
  link.href = entryUrl(album);
  link.dataset.entryName = album.name;   // für den Übergang ins Album (js/transitions.js)

  // Bild mit festen Maßen + lazy loading → keine Layout-Sprünge
  const figure = document.createElement('div');
  figure.className = 'album-card__image';
  // gleiche Lademethode wie das Titelbild der Albumseite → beim Übergang kommt es direkt aus dem Cache
  const img = Object.assign(document.createElement('img'), { crossOrigin: 'anonymous' }, imageAttrs(album, getCover(album)));
  img.sizes = '(min-width: 72rem) 33vw, (min-width: 48rem) 50vw, 100vw';
  img.loading = position < 3 ? 'eager' : 'lazy';
  img.decoding = 'async';
  figure.append(img);

  const label = document.createElement('p');
  label.className = 'label';
  label.innerHTML = `Album ${pad2(number)} <span class="label__dash">—</span> `;
  label.append(formatCoords(album.coords));

  const name = document.createElement('h3');
  name.className = 'album-card__name';
  name.textContent = album.name;

  link.append(figure, label, name);
  item.append(link);
  return item;
}
