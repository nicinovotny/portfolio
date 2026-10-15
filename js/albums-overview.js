// Album-Übersicht (alben.html): eine Karte pro Ort, erzeugt aus data/albums.json.

import { getAlbums, getCover, imageAttrs } from './data.js';
import { formatCoords, pad2 } from './format.js';

const grid = document.querySelector('[data-album-grid]');
const count = document.querySelector('[data-album-count]');

try {
  const albums = await getAlbums();
  count.textContent = `${pad2(albums.length)} Orte`;

  grid.append(...albums.map((album, index) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'album-card';
    link.href = `album.html?ort=${encodeURIComponent(album.id)}`;

    // Bild mit festen Maßen + lazy loading → keine Layout-Sprünge
    const figure = document.createElement('div');
    figure.className = 'album-card__image';
    const img = Object.assign(document.createElement('img'), imageAttrs(album, getCover(album)));
    img.sizes = '(min-width: 72rem) 33vw, (min-width: 48rem) 50vw, 100vw';
    img.loading = index < 3 ? 'eager' : 'lazy';
    img.decoding = 'async';
    figure.append(img);

    const label = document.createElement('p');
    label.className = 'label';
    label.innerHTML = `Album ${pad2(index + 1)} <span class="label__dash">—</span> `;
    label.append(formatCoords(album.coords));

    const name = document.createElement('h2');
    name.className = 'album-card__name';
    name.textContent = album.name;

    link.append(figure, label, name);
    item.append(link);
    return item;
  }));
} catch (error) {
  console.error(error);
  grid.outerHTML = '<p class="status-error">Die Alben konnten nicht geladen werden. Läuft die Seite über einen lokalen Server (z. B. <code>npx serve</code>)?</p>';
}
