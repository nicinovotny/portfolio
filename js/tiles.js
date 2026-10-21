// Kachel für einen Eintrag (Collection-Seite, „Zuletzt“ auf der Startseite): Titelbild 3:2, Label, Name.
// Styles: .tile-grid / .tile in css/base.css

import { entryUrl, getCover, imageAttrs } from './data.js';
import { KIND_LABELS, formatWhen } from './format.js';

/** Kachel: Titelbild (3:2), Label „Trip — Aug 2024“, Name. Das Bild fliegt beim Klick in die Eintragsseite. */
/**
 * @param options.yearShown  Jahr steht schon als Überschrift darüber → im Label statt des Jahres das Land
 */
export function createTile(entry, position, { yearShown = false } = {}) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'tile';
  link.href = entryUrl(entry);
  link.dataset.entryName = entry.name;   // für den Übergang (js/transitions.js)

  const figure = document.createElement('div');
  figure.className = 'tile__image';
  // gleiche Lademethode wie das Titelbild der Eintragsseite → beim Übergang kommt es direkt aus dem Cache
  const img = Object.assign(document.createElement('img'), imageAttrs(entry, getCover(entry)));
  img.sizes = '(min-width: 104rem) 25vw, (min-width: 72rem) 33vw, (min-width: 48rem) 50vw, 100vw';   // ab ca. 1660 px vier Spalten
  img.loading = position < 3 ? 'eager' : 'lazy';
  img.decoding = 'async';
  figure.append(img);

  const label = document.createElement('p');
  label.className = 'label';
  label.append(KIND_LABELS[entry.kind]);
  let when = formatWhen(entry);
  if (yearShown && when === String(entry.year)) when = entry.country ?? '';
  if (when) label.append(' ', Object.assign(document.createElement('span'), { className: 'label__dash', textContent: '—' }), ` ${when}`);

  const name = Object.assign(document.createElement('h3'), { className: 'tile__name', textContent: entry.name });

  link.append(figure, label, name);
  item.append(link);
  return item;
}
