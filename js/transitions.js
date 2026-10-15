// Seitenübergang „Bild fliegt ins Album“ (View Transitions zwischen Seiten, Chrome/Edge/Safari).
// Beim Klick auf einen Album-Link bekommt das zugehörige Bild den Übergangsnamen „album-cover“.
// Auf der Albumseite trägt das Titelbild der Bühne denselben Namen – der Browser lässt das Bild
// dann von seiner alten Position in die Bühne wachsen. Browser ohne Unterstützung wechseln normal.
//
// Welches Bild gehört zum Link?
//   - ein <img> im Link selbst (Alben-Übersicht), oder
//   - data-cover-from="<CSS-Selektor>" am Link (Startseite, Karte)
//   - data-cover-src="<Bildadresse>" (Voriger/Nächster Ort): kein eigenes Bild auf der Seite, die Bühne
//     des aktuellen Albums überblendet in die Bühne des nächsten; die Adresse wird nur übergeben
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

  // Album → Album: Bildadresse übergeben (Bild ist vorgeladen), Bühne zu Bühne überblendet der Browser
  if (!img && link.dataset.coverSrc) {
    // anderer Titel: nicht von Name zu Name gleiten (überlagert sich), sondern mit der Bühne überblenden
    const currentTitle = document.querySelector('[data-album-title]');
    if (currentTitle) setName(currentTitle, 'none');
    store(id, link.dataset.coverSrc, link.dataset.albumName, false, true);
    return;
  }
  if (!img || !img.complete || !img.naturalWidth || !isVisible(img)) return;

  setName(img, COVER);
  const title = link.dataset.titleFrom && document.querySelector(link.dataset.titleFrom);
  if (title && isVisible(title)) setName(title, TITLE);

  store(id, img.currentSrc || img.src, link.dataset.albumName ?? title?.textContent ?? null, named.includes(title));
});

/** Die Albumseite zeigt diese (schon geladene) Fassung und den Titel sofort, damit der Übergang nicht ins Leere läuft */
function store(id, src, title, morphTitle = false, swap = false) {
  try {
    sessionStorage.setItem('album-cover', JSON.stringify({ id, src, title, morphTitle, swap }));
  } catch { /* ohne sessionStorage lädt die Albumseite einfach normal */ }
}

// Zurück per Browser-Taste: Namen zurücksetzen, sonst trägt ein altes Bild noch den Übergangsnamen
addEventListener('pageshow', clearNames);
