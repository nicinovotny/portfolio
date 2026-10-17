// Seitenübergang „Bild fliegt in den Eintrag“ (View Transitions zwischen Seiten, Chrome/Edge/Safari).
// Beim Klick auf einen Link zu entry.html bekommt das zugehörige Bild den Übergangsnamen „entry-cover“.
// Auf der Eintragsseite trägt das Titelbild der Bühne denselben Namen – der Browser lässt das Bild
// dann von seiner alten Position in die Bühne wachsen. Browser ohne Unterstützung wechseln normal.
//
// Welches Bild gehört zum Link?
//   - ein <img> im Link selbst (Kacheln der Collection-Seite), oder
//   - data-cover-from="<CSS-Selektor>" am Link (Startseite, Karte)
//   - data-cover-src="<Bildadresse>" (Voriger/Nächster Eintrag): kein eigenes Bild auf der Seite, die Bühne
//     des aktuellen Eintrags überblendet in die Bühne des nächsten; die Adresse wird nur übergeben
//   - optional data-title-from="<CSS-Selektor>" für den Titel (Startseite: großer Titel → großer Titel)

const COVER = 'entry-cover';
const TITLE = 'entry-title';
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
  const id = url.searchParams.get('id');
  if (url.origin !== location.origin || !url.pathname.endsWith('entry.html') || !id) return;

  clearNames();
  const img = link.dataset.coverFrom ? document.querySelector(link.dataset.coverFrom) : link.querySelector('img');

  // Eintrag → Eintrag: Bildadresse übergeben (Bild ist vorgeladen), Bühne zu Bühne überblendet der Browser
  if (!img && link.dataset.coverSrc) {
    // anderer Titel: nicht von Name zu Name gleiten (überlagert sich), sondern mit der Bühne überblenden
    const currentTitle = document.querySelector('[data-entry-title]');
    if (currentTitle) setName(currentTitle, 'none');
    store(id, link.dataset.coverSrc, link.dataset.entryName, false, true);
    return;
  }
  if (!img || !img.complete || !img.naturalWidth || !isVisible(img)) return;

  setName(img, COVER);
  const title = link.dataset.titleFrom && document.querySelector(link.dataset.titleFrom);
  if (title && isVisible(title)) setName(title, TITLE);

  store(id, img.currentSrc || img.src, link.dataset.entryName ?? title?.textContent ?? null, named.includes(title));
});

/** Die Eintragsseite zeigt diese (schon geladene) Fassung und den Titel sofort, damit der Übergang nicht ins Leere läuft */
function store(id, src, title, morphTitle = false, swap = false) {
  try {
    sessionStorage.setItem('entry-cover', JSON.stringify({ id, src, title, morphTitle, swap }));
  } catch { /* ohne sessionStorage lädt die Eintragsseite einfach normal */ }
}

// Zurück per Browser-Taste: Namen zurücksetzen, sonst trägt ein altes Bild noch den Übergangsnamen
addEventListener('pageshow', clearNames);
