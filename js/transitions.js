// Seitenübergang „Bild fliegt ins Album“ (View Transitions zwischen Seiten, Chrome/Edge/Safari).
// Beim Klick auf einen Album-Link bekommt das zugehörige Bild den Übergangsnamen „album-cover“.
// Auf der Albumseite trägt das Titelbild der Bühne denselben Namen – der Browser lässt das Bild
// dann von seiner alten Position in die Bühne wachsen. Browser ohne Unterstützung wechseln normal.
//
// Welches Bild gehört zum Link?
//   - ein <img> im Link selbst (Alben-Übersicht), oder
//   - data-cover-from="<CSS-Selektor>" am Link (Startseite, Karte)
//   - optional data-title-from="<CSS-Selektor>" für den Titel (Startseite: großer Titel → großer Titel)

const COVER = 'album-cover';
const TITLE = 'album-title';
let named = [];

function clearNames() {
  named.forEach((element) => { element.style.viewTransitionName = ''; });
  named = [];
}

function setName(element, name) {
  element.style.viewTransitionName = name;
  named.push(element);
}

const isVisible = (element) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
};

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link || link.target === '_blank') return;

  const url = new URL(link.href, location.href);
  const id = url.searchParams.get('ort');
  if (url.origin !== location.origin || !url.pathname.endsWith('album.html') || !id) return;

  clearNames();
  const img = link.dataset.coverFrom ? document.querySelector(link.dataset.coverFrom) : link.querySelector('img');
  if (!img || !img.complete || !img.naturalWidth || !isVisible(img)) return;

  setName(img, COVER);
  const title = link.dataset.titleFrom && document.querySelector(link.dataset.titleFrom);
  if (title && isVisible(title)) setName(title, TITLE);

  // Die Albumseite zeigt diese (schon geladene) Fassung und den Titel sofort, damit der Übergang nicht ins Leere läuft
  try {
    const name = link.dataset.albumName ?? title?.textContent ?? null;
    sessionStorage.setItem('album-cover', JSON.stringify({ id, src: img.currentSrc || img.src, title: name }));
  } catch { /* ohne sessionStorage lädt die Albumseite einfach normal */ }
});

// Zurück per Browser-Taste: Namen zurücksetzen, sonst trägt ein altes Bild noch den Übergangsnamen
addEventListener('pageshow', clearNames);
