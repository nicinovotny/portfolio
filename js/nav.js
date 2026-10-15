// Navigation: markiert die aktuelle Seite und steuert das Handy-Menü.

const nav = document.querySelector('.site-nav');
const toggle = document.querySelector('.menu-toggle');

// Aktuellen Menüpunkt markieren (Dateiname der Seite = href des Links).
// ".html" wird ignoriert, weil manche Server saubere URLs ohne Endung liefern.
const pageName = (path) => path.split('/').pop().replace(/\.html$/, '') || 'index';
const currentPage = pageName(location.pathname);
nav?.querySelectorAll('a[href]').forEach((link) => {
  if (pageName(link.getAttribute('href')) === currentPage) link.setAttribute('aria-current', 'page');
});

// Alles außerhalb der Kopfzeile – wird bei offenem Handy-Menü für Tastatur und Screenreader gesperrt
const outside = [...document.body.children].filter((el) => !el.contains(nav) && el.tagName !== 'SCRIPT');

function setMenu(open) {
  nav.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
  outside.forEach((el) => { el.inert = open; });
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? 'Schließen' : 'Menü';
}

if (nav && toggle) {
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));

  // Escape schließt das Menü und gibt den Fokus an den Knopf zurück
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });

  // Beim Wechsel auf Desktop-Breite Menü zurücksetzen
  matchMedia('(min-width: 48rem)').addEventListener('change', (event) => {
    if (event.matches) setMenu(false);
  });
}
