// Collection-Seite (collection.html?id=<collection>): Kopf mit Ziffer, Name, Text und Zählern,
// darunter die Einträge als Kacheln (gruppiert nach Art, neueste zuerst, ohne Jahresüberschriften)
// und die Frames: eigene Einzelbilder plus getaggte Bilder aus anderen Einträgen (mit Herkunftszeile).
// Frames öffnen direkt die Großansicht; &bild=<entryId>/<imageId> öffnet sie beim Laden (Ziel von
// entry.html?id=<frame>). Zum Schluss: nächste Collection (mit Umlauf) und Übersicht.
// Collections mit "layout": "wall" (Automotive, Portrait, Creative) zeigen statt Kacheln nur eine Bildwand:
// Ihre Shoots haben keine eigene Seite, alle Bilder stehen wie Frames in einer Galerie (js/data.js, hasOwnPage).

import {
  OVERVIEW_URL, collectionUrl, entryUrl, getCollectionEntries, getCollectionFrames, getCollections, imageRef,
} from './data.js';
import { KIND_ORDER, KIND_PLURALS as PLURAL, formatCollectionCounts, nameWithYear, pad2 } from './format.js';
import { createGalleryItem, justifyGallery } from './gallery.js';
import { createLightbox } from './lightbox.js';
import { createTile } from './tiles.js';

const root = document.querySelector('[data-collection]');
const el = {
  position: root.querySelector('[data-collection-position]'),
  name: root.querySelector('[data-collection-name]'),
  text: root.querySelector('[data-collection-text]'),
  readout: root.querySelector('[data-collection-readout]'),
  sections: root.querySelector('[data-collection-sections]'),
  pager: root.querySelector('[data-collection-pager]'),
  all: root.querySelector('[data-collection-all]'),
  next: root.querySelector('[data-collection-next]'),
  nextNumber: root.querySelector('[data-collection-next-number]'),
  nextName: root.querySelector('[data-collection-next-name]'),
};

init();

async function init() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  let published;
  let all;
  try {
    [published, all] = await Promise.all([getCollections(), getCollections({ all: true })]);
  } catch (error) {
    console.error(error);
    showMissing('Seite konnte nicht geladen werden', 'Läuft die Seite über einen lokalen Server (z. B. npx serve)?');
    return;
  }

  // Unveröffentlichte Collections sind nicht erreichbar (Schalter "published" in albums.json)
  const index = published.findIndex((collection) => collection.id === id);
  if (index === -1) {
    showMissing('Nicht gefunden', id ? `Zu „${id}“ gibt es keine Collection.` : 'Es wurde keine Collection angegeben.');
    return;
  }

  const collection = published[index];
  const [entries, frames] = await Promise.all([getCollectionEntries(collection.id), getCollectionFrames(collection.id)]);

  renderHead(collection, index, published.length, entries, frames);
  renderEntries(entries, Boolean(collection.groupByYear));
  const frameItems = renderFrames(frames, collection.layout === 'wall');
  if (!entries.length && !frames.length) renderEmpty();
  renderPager(published, index);

  if (frameItems.length) {
    const lightbox = createLightbox({
      images: frames.map(({ entry, image }) => ({ entry, image })),
      thumbs: (i) => frameItems[i],
      collections: all,
    });
    frameItems.forEach(({ button }, i) => button.addEventListener('click', () => lightbox.open(i)));
    openRequested(params.get('bild'), frames, frameItems, lightbox);
  }
}

// ---------- Kopf ----------

function renderHead(collection, index, total, entries, frames) {
  document.title = `${collection.name} – Nicolas Novotny`;
  if (collection.text) document.querySelector('meta[name="description"]')?.setAttribute('content', collection.text);

  el.position.replaceChildren(
    `${pad2(index + 1)} / ${pad2(total)} `,
    Object.assign(document.createElement('span'), { className: 'label__dash', textContent: '—' }),
    ' Collection',
  );
  el.name.textContent = collection.name;
  el.text.textContent = collection.text ?? '';
  // z. B. „Landscape · 21 Trips“ oder „Wildlife · 23 Bilder · aus 6 Einträgen“
  el.readout.textContent = [collection.name, ...formatCollectionCounts(entries, frames)].join(' · ');
}

function showMissing(title, text) {
  root.classList.add('collection-missing');
  el.position.textContent = '';
  el.name.textContent = title;
  el.text.textContent = text;
}

function renderEmpty() {
  el.sections.append(Object.assign(document.createElement('p'), {
    className: 'collection-empty label label--quiet',
    textContent: 'Noch keine Bilder in dieser Collection.',
  }));
}

/** Abschnitt mit Überschrift (Haarlinie, Name links, Anzahl rechts) */
function section(title, count, labelId) {
  const wrap = document.createElement('section');
  wrap.className = 'collection-section';
  wrap.setAttribute('aria-labelledby', labelId);
  const head = document.createElement('div');
  head.className = 'collection-section__head';
  head.append(
    Object.assign(document.createElement('h2'), { className: 'collection-section__title', id: labelId, textContent: title }),
    Object.assign(document.createElement('span'), { className: 'label label--quiet', textContent: pad2(count) }),
  );
  wrap.append(head);
  el.sections.append(wrap);
  return wrap;
}

// ---------- Einträge als Kacheln ----------

function renderEntries(entries, groupByYear = false) {
  let position = 0;
  const grid = (list, options) => {
    const ul = document.createElement('ul');
    ul.className = 'tile-grid';
    ul.append(...list.map((entry) => createTile(entry, position++, options)));
    return ul;
  };
  for (const kind of KIND_ORDER) {
    const list = entries.filter((entry) => entry.kind === kind);
    if (!list.length) continue;
    const wrap = section(PLURAL[kind], list.length, `abschnitt-${kind}`);
    // "groupByYear" an der Collection (albums.json): Trips nach Jahren gegliedert, neueste zuerst
    if (groupByYear && kind === 'trip') wrap.append(...yearGroups(list, grid));
    else wrap.append(grid(list));
  }
}

/** Ein Unterabschnitt pro Jahr (Reihenfolge innerhalb des Jahres wie in albums.json), ohne Jahr am Ende */
function yearGroups(list, grid) {
  const years = [...new Set(list.map((entry) => entry.year ?? null))]
    .sort((a, b) => (a == null) - (b == null) || b - a);
  return years.map((year) => {
    const inYear = list.filter((entry) => (entry.year ?? null) === year);
    const group = document.createElement('section');
    group.className = 'collection-year';
    const id = `jahr-${year ?? 'ohne'}`;
    group.setAttribute('aria-labelledby', id);
    const head = document.createElement('div');
    head.className = 'collection-year__head';
    head.append(
      Object.assign(document.createElement('h3'), { className: 'collection-year__title', id, textContent: year ?? 'Ohne Jahr' }),
      Object.assign(document.createElement('span'), { className: 'label label--quiet', textContent: `${pad2(inYear.length)} ${inYear.length === 1 ? 'Trip' : 'Trips'}` }),
    );
    group.append(head, grid(inYear, { yearShown: true }));
    return group;
  });
}

// ---------- Frames ----------

/**
 * Bildunterschrift: Titel; darunter bei getaggten Bildern „Aus: Island · 2025 →“ (Link zum Eintrag),
 * bei Bildwand-Shoots der Name ohne Link („Aprilia Tuono 660 · 2022“), bei Frames das Jahr
 */
function frameCaption({ entry, image, tagged }) {
  const wrap = document.createElement('span');
  wrap.className = 'frame-caption';
  wrap.append(Object.assign(document.createElement('span'), { textContent: image.title ?? '' }));
  const quiet = (textContent) => Object.assign(document.createElement('span'), { className: 'label label--quiet', textContent });
  if (tagged && entry.kind !== 'frame') {
    const origin = Object.assign(document.createElement('a'), {
      className: 'frame-caption__origin label',
      href: entryUrl(entry, image),
      textContent: `Aus: ${nameWithYear(entry)} →`,
    });
    wrap.append(origin);
  } else if (entry.kind !== 'frame') {
    wrap.append(quiet(nameWithYear(entry)));
  } else if (entry.year) {
    wrap.append(quiet(String(entry.year)));
  }
  return wrap;
}

/** Frames als Abschnitt unter den Kacheln; bei "layout": "wall" ist die Galerie die ganze Seite (ohne Überschrift) */
function renderFrames(frames, wall = false) {
  if (!frames.length) return [];
  const wrap = wall ? el.sections : section(PLURAL.frame, frames.length, 'abschnitt-frames');
  const gallery = document.createElement('div');
  gallery.className = wall ? 'gallery gallery--wall' : 'gallery';
  gallery.setAttribute('role', 'list');
  gallery.setAttribute('aria-label', wall ? 'Bilder' : 'Frames');
  wrap.append(gallery);

  const items = frames.map((frame, index) => createGalleryItem(frame.entry, frame.image, index, frameCaption(frame)));
  justifyGallery(gallery, items);
  return items;
}

/** &bild=<entryId>/<imageId>: Frame in der Großansicht öffnen (z. B. von entry.html?id=<frame>) */
function openRequested(ref, frames, items, lightbox) {
  if (!ref) return;
  const index = frames.findIndex(({ entry, image }) => imageRef(entry, image) === ref);
  if (index === -1) return;
  items[index].figure.scrollIntoView({ block: 'center' });
  requestAnimationFrame(() => lightbox.open(index));
}

// ---------- Nächste Collection ----------

function renderPager(published, index) {
  el.all.href = OVERVIEW_URL;
  if (published.length < 2) {
    el.next.hidden = true;
  } else {
    const position = (index + 1) % published.length;
    const next = published[position];
    el.next.href = collectionUrl(next.id);
    el.nextNumber.textContent = pad2(position + 1);
    el.nextName.textContent = next.name;
  }
  el.pager.hidden = false;
}
