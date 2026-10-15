// Kartendaten-Generator
// Rechnet Natural Earth (npm-Paket world-atlas) einmalig in SVG-Pfade um.
// Ergebnis: data/map/world.json (Übersicht, 110m) und data/map/detail.json (Zoom, 50m).
// Das Gradnetz wird im Browser berechnet (js/map-projection.js), weil es dort kleiner ist.
//
// Aufruf (nur nötig, wenn sich die Karte ändern soll):
//   cd tools
//   npm install
//   npm run build-map

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import * as topojson from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { createProjection } from '../js/map-projection.js';

const atlas = (file) => JSON.parse(readFileSync(new URL(`./node_modules/world-atlas/${file}`, import.meta.url)));
const outDir = fileURLToPath(new URL('../data/map/', import.meta.url));

// ---------- Einstellungen ----------

const WIDTH = 2000;            // Breite der Weltkarte in Kartenkoordinaten
const DETAIL_TOLERANCE = 0.01;  // Vereinfachung der 50m-Daten (größer = gröber, kleinere Datei)
const FAROE_ID = '234';        // Färöer bleiben unvereinfacht, damit sie beim Zoom scharf sind

// Dezente Beschriftungen für die gezoomte Ansicht (Lage in Grad, minZoom = ab welcher Vergrößerung)
const LABELS = [
  // Meere
  { name: 'Nordatlantik', lon: -28, lat: 50, type: 'sea', minZoom: 1.6 },
  { name: 'Nordsee', lon: 3.2, lat: 56.2, type: 'sea', minZoom: 3 },
  { name: 'Norwegische See', lon: 1, lat: 67.5, type: 'sea', minZoom: 3 },
  { name: 'Ostsee', lon: 19.5, lat: 57.5, type: 'sea', minZoom: 3 },
  { name: 'Mittelmeer', lon: 17, lat: 35.5, type: 'sea', minZoom: 2.5 },
  { name: 'Japanisches Meer', lon: 134, lat: 40.5, type: 'sea', minZoom: 3 },
  { name: 'Gelbes Meer', lon: 123.5, lat: 35.5, type: 'sea', minZoom: 4 },
  { name: 'Pazifik', lon: -150, lat: 15, type: 'sea', minZoom: 0 },
  { name: 'Atlantik', lon: -38, lat: 22, type: 'sea', minZoom: 0 },
  { name: 'Indischer Ozean', lon: 78, lat: -22, type: 'sea', minZoom: 0 },
  // Länder und Landesteile
  { name: 'Island', lon: -18.6, lat: 64.9, type: 'land', minZoom: 2.5 },
  { name: 'Norwegen', lon: 9, lat: 61.6, type: 'land', minZoom: 2.5 },
  { name: 'Schweden', lon: 15.5, lat: 63, type: 'land', minZoom: 2.5 },
  { name: 'Finnland', lon: 26.5, lat: 63.5, type: 'land', minZoom: 2.5 },
  { name: 'Schottland', lon: -4.3, lat: 57, type: 'land', minZoom: 3 },
  { name: 'England', lon: -1.5, lat: 52.6, type: 'land', minZoom: 4 },
  { name: 'Irland', lon: -8, lat: 53.2, type: 'land', minZoom: 3 },
  { name: 'Dänemark', lon: 9.2, lat: 56.1, type: 'land', minZoom: 4 },
  { name: 'Deutschland', lon: 10.2, lat: 51.6, type: 'land', minZoom: 2.5 },
  { name: 'Niederlande', lon: 5.6, lat: 52.4, type: 'land', minZoom: 5 },
  { name: 'Belgien', lon: 4.5, lat: 50.6, type: 'land', minZoom: 6 },
  { name: 'Frankreich', lon: 2.4, lat: 46.6, type: 'land', minZoom: 2.5 },
  { name: 'Spanien', lon: -3.7, lat: 40.2, type: 'land', minZoom: 2.5 },
  { name: 'Portugal', lon: -8.1, lat: 39.7, type: 'land', minZoom: 4 },
  { name: 'Italien', lon: 12.6, lat: 43, type: 'land', minZoom: 2.5 },
  { name: 'Schweiz', lon: 7.6, lat: 47.1, type: 'land', minZoom: 6 },
  { name: 'Österreich', lon: 14.4, lat: 47.6, type: 'land', minZoom: 5 },
  { name: 'Tschechien', lon: 15.5, lat: 49.8, type: 'land', minZoom: 5 },
  { name: 'Polen', lon: 19.3, lat: 52.1, type: 'land', minZoom: 3 },
  { name: 'Russland', lon: 38, lat: 58, type: 'land', minZoom: 2.5 },
  { name: 'China', lon: 113, lat: 36.5, type: 'land', minZoom: 2.5 },
  { name: 'Nordkorea', lon: 126.9, lat: 40.3, type: 'land', minZoom: 4 },
  { name: 'Japan', lon: 138.5, lat: 36.8, type: 'land', minZoom: 3 },
];

// ---------- Projektion ----------

const sphere = { type: 'Sphere' };
const projection = geoNaturalEarth1().fitWidth(WIDTH, sphere);
const [[, top], [, bottom]] = geoPath(projection).bounds(sphere);
const height = Math.ceil(bottom - top);
projection.translate([projection.translate()[0], projection.translate()[1] - top]);

const scale = projection.scale();
const translate = projection.translate();
const path = (digits) => geoPath(projection).digits(digits);

// Kontrolle: die eigene Projektion im Browser muss dieselben Werte liefern wie d3
const own = createProjection({ scale, translate });
for (const point of [[-6.9, 62], [127.8, 36.4], [-170, -60]]) {
  const [ax, ay] = projection(point);
  const [bx, by] = own.project(...point);
  if (Math.hypot(ax - bx, ay - by) > 0.01) throw new Error(`Projektion weicht ab bei ${point}`);
  const [lon, lat] = own.invert(ax, ay);
  if (Math.hypot(lon - point[0], lat - point[1]) > 1e-4) throw new Error(`Umkehrung weicht ab bei ${point}`);
}

// ---------- Übersicht (110m) ----------

const land110 = atlas('land-110m.json');
const world = {
  width: WIDTH,
  height,
  scale: +scale.toFixed(6),
  translate: translate.map((v) => +v.toFixed(6)),
  sphere: path(1)(sphere),
  land: path(1)(topojson.feature(land110, land110.objects.land)),
};

// ---------- Detail (50m) ----------

const countries = atlas('countries-50m.json');
const simplified = simplify(presimplify(structuredClone(countries)), DETAIL_TOLERANCE);
const isFaroe = (g) => g.id === FAROE_ID;

const landDetail = path(1)(topojson.merge(simplified, simplified.objects.countries.geometries.filter((g) => !isFaroe(g))));
const faroe = path(2)(topojson.merge(countries, countries.objects.countries.geometries.filter(isFaroe)));
const borders = path(1)(topojson.mesh(simplified, simplified.objects.countries, (a, b) => a !== b));

const detail = {
  land: landDetail + faroe,
  borders,
  labels: LABELS,
};

// ---------- Schreiben ----------

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}world.json`, JSON.stringify(world));
writeFileSync(`${outDir}detail.json`, JSON.stringify(detail));

const kb = (obj) => `${(JSON.stringify(obj).length / 1024).toFixed(0)} KB`;
console.log(`world.json  ${kb(world)}  (${WIDTH} × ${height})`);
console.log(`detail.json ${kb(detail)}  (Land ${kb(detail.land)}, Grenzen ${kb(detail.borders)})`);
