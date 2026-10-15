// Erzeugt schlanke SVG-Pfade für die Mockups (Europa-Ausschnitt + Welt-Minikarte)
import { createRequire } from 'module';
const require = createRequire('/tmp/claude-0/-home-claude/9caf4838-609c-53be-b195-2d2e636d97d8/scratchpad/geo/package.json');
const topo = require('topojson-client');
const simp = require('topojson-simplify');
const d3 = await import('/tmp/claude-0/-home-claude/9caf4838-609c-53be-b195-2d2e636d97d8/scratchpad/geo/node_modules/d3-geo/src/index.js');
const fs = require('fs');

const base = '/tmp/claude-0/-home-claude/9caf4838-609c-53be-b195-2d2e636d97d8/scratchpad/geo/node_modules/world-atlas/';
const tol = parseFloat(process.argv[2] || '0.02');

// Europa: 50m, vereinfacht
let c50 = JSON.parse(fs.readFileSync(base + 'countries-50m.json'));
c50 = simp.presimplify(c50);
c50 = simp.simplify(c50, tol);
const land50 = topo.merge(c50, c50.objects.countries.geometries.filter(g => g.id !== '234'));
const c50o = JSON.parse(fs.readFileSync(base + 'countries-50m.json'));
const faroe50 = topo.merge(c50o, c50o.objects.countries.geometries.filter(g => g.id === '234'));
const borders50 = topo.mesh(c50, c50.objects.countries, (a, b) => a !== b);

const W = 1280, H = 800;
const bbox = { type: 'Polygon', coordinates: [[[-26, 43], [34, 43], [34, 71.5], [-26, 71.5], [-26, 43]].reverse()] };
const proj = d3.geoNaturalEarth1().fitExtent([[40, 30], [W - 40, H - 30]], { type: 'MultiPoint', coordinates: [[-26, 43], [34, 43], [34, 71.5], [-26, 71.5], [4, 72], [4, 42.5]] });
proj.clipExtent([[-20, -20], [W + 20, H + 20]]);
const path = d3.geoPath(proj).digits(0);
const landD = path(land50);
const borderD = path(borders50);
const faroeD = path(faroe50);

// Graticule im Ausschnitt
const grat = d3.geoGraticule().step([10, 5]).extent([[-40, 35], [50, 80]]);
const gratD = path(grat());

const places = {
  faroe: [-6.9, 62.0], lofoten: [13.9, 68.2], saxony: [14.1, 50.92],
  blackforest: [8.2, 48.0], swiss: [7.91, 46.59], dolomites: [11.72, 46.6],
  iceland: [-19, 64.9], norway: [9, 61.5], scotland: [-4.5, 57], northsea: [3, 56], atlantic: [-17, 55]
};
const pts = {};
for (const [k, v] of Object.entries(places)) pts[k] = proj(v).map(Math.round);

// Welt-Minikarte 110m
const l110 = JSON.parse(fs.readFileSync(base + 'land-110m.json'));
let l110s = simp.simplify(simp.presimplify(l110), parseFloat(process.argv[3]||"0.5")); const land110 = topo.feature(l110s, l110s.objects.land);
const MW = 280, MH = 146;
const mproj = d3.geoNaturalEarth1().fitExtent([[2, 2], [MW - 2, MH - 2]], { type: 'Sphere' });
const mpath = d3.geoPath(mproj).digits(0);
const worldD = mpath(land110);
const mpts = { europe: mproj([9, 54]).map(Math.round), korea: mproj([127.8, 36.4]).map(Math.round) };
const corners = [[-26, 43], [34, 43], [34, 71.5], [-26, 71.5]].map(c => mproj(c).map(Math.round));

fs.writeFileSync('/tmp/claude-0/-home-claude/9caf4838-609c-53be-b195-2d2e636d97d8/scratchpad/out.json', JSON.stringify({ faroeD, landD, borderD, gratD, worldD }));
console.log('sizes', landD.length, borderD.length, gratD.length, worldD.length);
console.log('pts', JSON.stringify(pts));
console.log('mini', JSON.stringify(mpts), JSON.stringify(corners));
