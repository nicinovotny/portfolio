// Eintragsseite (entry.html?id=<id>): Bühne mit Titelbild, darüber schiebt sich der Inhalt.
// Zwei Layouts je nach Art des Eintrags ("kind" in albums.json):
//   trip  – Galerie in Bildzeilen gleicher Höhe (viele Bilder, Ort im Mittelpunkt)
//   shoot – großzügige Bildstrecke: Querformate einzeln groß, zwei Hochformate nebeneinander
// Frames und Einträge aus Bildwand-Collections haben keine eigene Seite und werden zur Collection weitergeleitet.
// Voriger/nächster Eintrag bleibt innerhalb der Collection. Die Großansicht steckt in js/lightbox.js.

import {
  canonicalId, collectionUrl, entryUrl, getCollection, getCollectionEntries, getCollections, getCover, getEntry, getRegions,
  hasOwnPage, imageAttrs, imageUrl, regionPath,
} from './data.js';
import { KIND_LABELS, formatCoords, formatWhen, nameWithYear, pad2 } from './format.js';
import { createGalleryItem, justifyGallery, loadGalleryImage } from './gallery.js';
import { createLightbox } from './lightbox.js';
import { applyScrim } from './scrim.js';

const gsap = window.gsap;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animated = Boolean(gsap) && !reducedMotion;

const root = document.querySelector('[data-entry]');
const el = {
  stage: root.querySelector('[data-entry-stage]'),
  cover: root.querySelector('[data-entry-cover]'),
  caption: root.querySelector('[data-entry-caption]'),
  crumbs: root.querySelector('[data-entry-crumbs]'),
  label: root.querySelector('[data-entry-label]'),
  title: root.querySelector('[data-entry-title]'),
  text: root.querySelector('[data-entry-text]'),
  facts: root.querySelector('[data-entry-facts]'),
  map: root.querySelector('[data-entry-map]'),
  back: root.querySelectorAll('[data-entry-back]'),
  gallery: root.querySelector('[data-gallery]'),
  pager: root.querySelector('[data-entry-pager]'),
  stageNav: root.querySelector('[data-stage-nav]'),
};

let items = [];       // { figure, button, img, ratio, attrs } – siehe js/gallery.js

init();

async function init() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('id');
  const id = canonicalId(requested);

  let entry;
  let regions;
  try {
    [entry, regions] = await Promise.all([getEntry(id), getRegions()]);
  } catch (error) {
    console.error(error);
    showMissing('Seite konnte nicht geladen werden', 'Läuft die Seite über einen lokalen Server (z. B. npx serve)?');
    return;
  }

  if (!entry) {
    showMissing('Nicht gefunden', id ? `Zu „${id}“ gibt es keinen Eintrag.` : 'Es wurde kein Eintrag angegeben.');
    return;
  }

  // Frames und Einträge aus Bildwand-Collections haben keine eigene Seite: Collection öffnen,
  // dort zeigt die Lightbox das Titelbild (alte Links auf Shoots führen so weiter)
  if (!hasOwnPage(entry)) {
    location.replace(new URL(entryUrl(entry), location.href));
    return;
  }

  // Alte id in der Adresse (z. B. "kleinarl") stillschweigend durch die neue ersetzen
  if (requested !== entry.id) {
    params.set('id', entry.id);
    history.replaceState(history.state, '', `?${params}`);
  }

  const [collection, siblings, collections] = await Promise.all([
    getCollection(entry.collection),
    getCollectionEntries(entry.collection),
    getCollections({ all: true }),
  ]);

  root.dataset.kind = entry.kind;
  renderHead(entry, collection, regions);
  renderCrumbs(entry, collection, siblings);
  renderStage(entry);
  if (entry.kind === 'shoot') renderStrip(entry);
  else renderGallery(entry);
  renderPager(siblings, siblings.findIndex((e) => e.id === entry.id));
  watchStageCover();
  setupStageScroll();

  const lightbox = createLightbox({
    images: entry.images.map((image) => ({ entry, image })),
    thumbs: (i) => items[i],
    collections,
    currentEntryId: entry.id,
  });
  items.forEach(({ button }, i) => button.addEventListener('click', () => lightbox.open(i)));
}

// ---------- Kopf ----------

/** Mono-Label aus Teilen, getrennt durch einen Strich in Akzentfarbe: „Trip — Aug 2024 · 12 Tage — 62°00′N …“ */
function setLabel(target, parts) {
  target.replaceChildren();
  parts.filter(Boolean).forEach((part, index) => {
    if (index) target.append(' ', Object.assign(document.createElement('span'), { className: 'label__dash', textContent: '—' }), ' ');
    target.append(part);
  });
}

function renderHead(entry, collection, regions) {
  const when = formatWhen(entry);
  document.title = `${nameWithYear(entry)} – Nicolas Novotny`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', entry.text ?? '');

  setLabel(el.label, [KIND_LABELS[entry.kind], when, entry.coords && formatCoords(entry.coords)]);
  el.title.textContent = entry.name;
  el.text.textContent = entry.text ?? '';

  // „Auf der Karte zeigen“ nur bei Einträgen mit Ort
  if (entry.coords) el.map.href = `karte.html?ort=${encodeURIComponent(entry.id)}`;
  else el.map.hidden = true;

  // „Zurück zu Landscape“ – oben in der Einleitung und unten bei der Navigation
  el.back.forEach((link) => {
    link.href = collectionUrl(entry.collection);
    link.querySelector('[data-entry-back-name]').textContent = collection?.name ?? 'Übersicht';
  });

  const timeTerm = entry.dateStart ? 'Zeitraum' : entry.date ? 'Datum' : 'Jahr';
  const facts = [
    [timeTerm, when],
    ['Land', entry.country],
    ['Region', regionName(entry, regions)],
    ['Bilder', pad2(entry.images.length)],
  ];
  el.facts.replaceChildren(...facts.filter(([, value]) => value).map(([term, value]) => {
    const wrap = document.createElement('div');
    const dt = Object.assign(document.createElement('dt'), { className: 'label', textContent: term });
    const dd = Object.assign(document.createElement('dd'), { textContent: value });
    wrap.append(dt, dd);
    return wrap;
  }));
}

/**
 * Großregion (z. B. Nordeuropa, Mitteleuropa) – das Land steht schon daneben. Ist die zweite Ebene selbst
 * das Land (Asien → Südkorea), gilt der Kontinent; sonst stünde zweimal „Südkorea“ da.
 */
function regionName(entry, regions) {
  if (!entry.region) return null;
  const country = entry.country?.replace(/\s*\(.*\)$/, '');
  const names = regionPath(regions, entry.region).map((id) => regions[id]?.name);
  return [names[1], names[0]].find((name) => name && name !== country) ?? null;
}

/**
 * Brotkrumen oben auf der Bühne: „Collections / Landscape / Trip 03 von 21“ – macht sofort klar, dass man
 * in einem Eintrag ist (und nicht mehr auf der Startseite). Handy: „← Landscape · 03/21“ (css/entry.css).
 */
function renderCrumbs(entry, collection, siblings) {
  if (!collection) return;
  const position = siblings.findIndex((e) => e.id === entry.id);
  const link = el.crumbs.querySelector('[data-entry-crumbs-collection]');
  link.href = collectionUrl(collection.id);
  el.crumbs.querySelector('[data-entry-crumbs-name]').textContent = collection.name;
  const current = el.crumbs.querySelector('[data-entry-crumbs-position]');
  if (position === -1) {
    current.textContent = KIND_LABELS[entry.kind];
  } else {
    current.replaceChildren(
      Object.assign(document.createElement('span'), { className: 'entry-crumbs__long', textContent: `${KIND_LABELS[entry.kind]} ${pad2(position + 1)} von ${pad2(siblings.length)}` }),
      Object.assign(document.createElement('span'), { className: 'entry-crumbs__short', textContent: `${pad2(position + 1)}/${pad2(siblings.length)}` }),
    );
  }
  el.crumbs.hidden = false;
}

// ---------- Bühne ----------

/** Titelbild in voller Größe; war es schon vom Seitenübergang da, wird nur die passende Größe nachgeladen */
function renderStage(entry) {
  const cover = getCover(entry);
  const { src, srcset, width, height } = imageAttrs(entry, cover);
  const img = el.cover;
  Object.assign(img, { width, height, alt: cover.alt, sizes: '100vw' });
  // Direkt aufgerufen (ohne Seitenübergang): gleich die passende Größe laden und weich einblenden,
  // sobald sie da ist – keine unscharfe Zwischenstufe (die fiel auf Retina-Bildschirmen auf)
  if (!img.getAttribute('src')) {
    img.classList.add('is-fading');
    img.addEventListener('load', () => img.classList.remove('is-fading'), { once: true });
    img.srcset = srcset;
    img.src = src;
  } else {
    img.srcset = srcset;   // Bild kam schon mit dem Seitenübergang (js/transitions.js)
  }

  const whenReady = () => applyScrim(el.stage, img);   // Verläufe an die Bildhelligkeit anpassen
  if (img.complete && img.naturalWidth) whenReady();
  img.addEventListener('load', whenReady);

  // Kein eigenes Einblenden des Titels: Den Auftritt übernimmt der Seitenübergang (Bild + Titel gleiten an
  // ihren Platz). Eine zusätzliche Animation würde sich mit ihm überschneiden.
}

/** Bühne verdeckt? Dann nimmt sie nicht am Seitenübergang teil (siehe css/entry.css, .is-covered) */
function watchStageCover() {
  let ticking = false;
  const update = () => {
    ticking = false;
    el.stage.classList.toggle('is-covered', scrollY > el.stage.offsetHeight * 0.4);
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

/** Beim Scrollen: Bild zoomt leicht und dunkelt ab, Titel verschwindet, der Inhalt schiebt sich darüber */
function setupStageScroll() {
  const ScrollTrigger = window.ScrollTrigger;
  if (!animated || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const scroll = { trigger: el.stage, start: 'top top', end: () => `+=${el.stage.offsetHeight}`, scrub: true };
  gsap.to(el.cover, { scale: 1.08, ease: 'none', scrollTrigger: scroll });
  gsap.to(el.stage, { '--stage-fade': 0.65, ease: 'none', scrollTrigger: scroll });
  gsap.to([el.caption, el.crumbs, el.stageNav], {
    autoAlpha: 0,
    y: -48,
    ease: 'none',
    scrollTrigger: { ...scroll, end: () => `+=${el.stage.offsetHeight * 0.5}` },
  });
}

function showMissing(title, text) {
  root.classList.add('entry-missing');
  el.label.textContent = '';
  el.title.textContent = title;
  el.text.textContent = text;
  el.gallery.hidden = true;
}

// ---------- Trip: Galerie in Bildzeilen (js/gallery.js) ----------

function renderGallery(entry) {
  items = entry.images.map((image, index) => createGalleryItem(entry, image, index));
  justifyGallery(el.gallery, items);
}

// ---------- Shoot: Bildstrecke ----------

/**
 * Großzügige Bildstrecke im Magazin-Stil, damit auch 3–5 Bilder hochwertig wirken:
 * Querformate stehen einzeln und groß, zwei aufeinanderfolgende Hochformate teilen sich eine Zeile.
 * Die Größen regelt css/entry.css (höchstens ca. 86 % der Fensterhöhe, nie beschnitten).
 */
function renderStrip(entry) {
  items = entry.images.map((image, index) => createGalleryItem(entry, image, index));
  el.gallery.classList.replace('gallery', 'strip');

  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const pair = items[i].ratio < 1 && items[i + 1]?.ratio < 1;
    rows.push(pair ? [items[i], items[++i]] : [items[i]]);
  }

  el.gallery.replaceChildren(...rows.map((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'strip__row';
    rowEl.setAttribute('role', 'none');
    rowEl.style.setProperty('--row-ratio', row.reduce((sum, item) => sum + item.ratio, 0));
    rowEl.style.setProperty('--row-gaps', row.length - 1);
    rowEl.append(...row.map((item) => item.figure));
    return rowEl;
  }));

  // Anzeigebreite erst nach dem Layout bekannt → passende Größe aus dem srcset
  const updateSizes = () => items.forEach(({ img, button }) => { img.sizes = `${Math.ceil(button.clientWidth) || 1200}px`; });
  updateSizes();
  items.forEach(loadGalleryImage);
  new ResizeObserver(updateSizes).observe(el.gallery);
}

// ---------- Voriger / nächster Eintrag ----------

/**
 * Voriger/nächster Eintrag derselben Collection – unten nach den Bildern und direkt auf der Bühne.
 * Die Titelbilder der Nachbarn werden leise vorgeladen und beim Klick an die nächste Seite übergeben
 * (js/transitions.js), damit der Wechsel ohne harten Schnitt gelingt.
 */
function renderPager(siblings, index) {
  if (index === -1 || siblings.length < 2) return;
  // Nur zwei Einträge: Voriger und Nächster wären derselbe – dann nur „Nächster“
  const offsets = siblings.length === 2 ? [1] : [-1, 1];
  if (offsets.length === 1) {
    for (const scope of [el.pager, el.stageNav]) scope.querySelector('[data-pager-prev]').hidden = true;
  }
  const neighbours = offsets.map((offset) => {
    const position = (index + offset + siblings.length) % siblings.length;
    const entry = siblings[position];
    return {
      key: offset < 0 ? 'prev' : 'next',
      href: entryUrl(entry),
      number: pad2(position + 1),
      kind: KIND_LABELS[entry.kind],
      name: nameWithYear(entry),
      shortName: nameWithYear(entry, entry.shortName ?? entry.name),   // Bühne: wenig Platz
      entryName: entry.name,
      cover: imageUrl(entry, getCover(entry), 1200),
    };
  });

  for (const { key, href, number, kind, name, shortName, entryName, cover } of neighbours) {
    for (const scope of [el.pager, el.stageNav]) {
      const link = scope.querySelector(`[data-pager-${key}]`);
      link.href = href;
      link.dataset.coverSrc = cover;
      link.dataset.entryName = entryName;
      scope.querySelector(`[data-pager-${key}-number]`).textContent = number;
      scope.querySelector(`[data-pager-${key}-name]`).textContent = scope === el.stageNav ? shortName : name;
      const kindLabel = scope.querySelector(`[data-pager-${key}-kind]`);
      if (kindLabel) kindLabel.textContent = `${key === 'prev' ? 'Voriger' : 'Nächster'} ${kind}`;
    }
  }
  el.pager.hidden = false;
  el.stageNav.hidden = false;

  // Nachbar-Titelbilder vorladen, sobald die Seite zur Ruhe gekommen ist
  const preload = () => neighbours.forEach(({ cover }) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = cover;
  });
  if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 3000 });
  else setTimeout(preload, 1500);
}
