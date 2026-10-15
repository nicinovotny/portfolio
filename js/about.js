// Über mich: zählt Reisen, Länder und Bilder aus data/albums.json für den Steckbrief.

import { getAlbums } from './data.js';
import { pad2 } from './format.js';

const target = document.querySelector('[data-about-stats]');

try {
  const albums = await getAlbums();
  // Land ohne Zusatz in Klammern zählen, z. B. „Färöer (Dänemark)“ → „Färöer“
  const countries = new Set(albums.map((album) => album.country.replace(/\s*\(.*\)$/, '')));
  const images = albums.reduce((sum, album) => sum + album.images.length, 0);
  target.textContent = `${pad2(albums.length)} Reisen · ${pad2(countries.size)} Länder · ${pad2(images)} Bilder`;
} catch (error) {
  console.error(error);   // Steckbrief bleibt dann bei „—“
}
