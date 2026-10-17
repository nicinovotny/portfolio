// Über mich: zählt Reisen (Trips), Länder und Bilder aus data/albums.json für den Steckbrief.

import { getEntries } from './data.js';
import { pad2 } from './format.js';

const target = document.querySelector('[data-about-stats]');

try {
  const entries = await getEntries();
  const trips = entries.filter((entry) => entry.kind === 'trip');
  // Land ohne Zusatz in Klammern zählen, z. B. „Färöer (Dänemark)“ → „Färöer“
  const countries = new Set(entries.filter((entry) => entry.country).map((entry) => entry.country.replace(/\s*\(.*\)$/, '')));
  const images = entries.reduce((sum, entry) => sum + entry.images.length, 0);
  target.textContent = `${pad2(trips.length)} Reisen · ${pad2(countries.size)} Länder · ${pad2(images)} Bilder`;
} catch (error) {
  console.error(error);   // Steckbrief bleibt dann bei „—“
}
