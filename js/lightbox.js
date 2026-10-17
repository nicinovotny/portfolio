// Großansicht als <dialog>: Fokus bleibt darin, Esc schließt, die Seite dahinter ist inaktiv.
// Übergang: Das Bild wächst aus seiner Position in der Galerie (FLIP-Technik) und kehrt beim
// Schließen dorthin zurück – so bleibt klar, wo man in der Galerie ist.
// Bei reduzierter Bewegung wird nur umgeschaltet.
//
// Neben dem Bild (breit) bzw. per i-Knopf darunter (schmal): Titel, Herkunft („TRIP · SEOUL · 2026 →“),
// Aufnahmedaten und Tag-Chips. Angezeigt wird nur, was in albums.json steht.
// Das Markup erzeugt dieses Modul selbst, damit jede Seite (Eintrag, Collection) dieselbe Großansicht hat.
// Styles: css/lightbox.css

import { collectionUrl, entryUrl, imageAttrs } from './data.js';
import { KIND_LABELS, TECH_TAGS, formatExif, monoUpper, pad2 } from './format.js';

const gsap = window.gsap;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animated = Boolean(gsap) && !reducedMotion;
const wideQuery = matchMedia('(min-width: 64rem)');   // muss zu css/lightbox.css passen

const MARKUP = `
  <div class="lightbox__backdrop" data-lightbox-backdrop></div>
  <div class="lightbox__stage" data-lightbox-stage>
    <img class="lightbox__img" data-lightbox-img alt="">
  </div>

  <div class="lightbox__chrome" data-lightbox-chrome>
    <span class="lightbox__corner lightbox__corner--tl" aria-hidden="true"></span>
    <span class="lightbox__corner lightbox__corner--tr" aria-hidden="true"></span>
    <span class="lightbox__corner lightbox__corner--bl" aria-hidden="true"></span>
    <span class="lightbox__corner lightbox__corner--br" aria-hidden="true"></span>

    <div class="lightbox__top">
      <p class="lightbox__counter" aria-hidden="true">
        <span class="lightbox__number" data-lightbox-number>01</span>
        <span class="label label--quiet" data-lightbox-total>/ 01</span>
      </p>
      <div class="lightbox__actions">
        <button class="lightbox__info-toggle" type="button" data-lightbox-toggle aria-expanded="false" aria-controls="lightbox-info" aria-label="Aufnahmedaten anzeigen">
          <span aria-hidden="true">i</span>
        </button>
        <button class="lightbox__close label" type="button" data-lightbox-close>
          Schließen
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>
    </div>

    <button class="lightbox__nav lightbox__nav--prev" type="button" data-lightbox-prev aria-label="Vorheriges Bild">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M15 4l-8 8 8 8"/></svg>
    </button>
    <button class="lightbox__nav lightbox__nav--next" type="button" data-lightbox-next aria-label="Nächstes Bild">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 4l8 8-8 8"/></svg>
    </button>

    <div class="lightbox__caption">
      <p class="lightbox__title" data-lightbox-title></p>
    </div>

    <div class="lightbox__info" id="lightbox-info" data-lightbox-info>
      <p class="lightbox__info-title" data-lightbox-info-title></p>
      <span class="lightbox__origin label" data-lightbox-origin></span>
      <p class="lightbox__exif" data-lightbox-exif>
        <span class="lightbox__gear" data-lightbox-gear></span>
        <span class="lightbox__settings" data-lightbox-settings></span>
      </p>
      <ul class="lightbox__tags" data-lightbox-tags aria-label="Tags"></ul>
      <p class="lightbox__demo label label--quiet" data-lightbox-demo>Demo-Bild</p>
    </div>
  </div>

  <p class="visually-hidden" data-lightbox-status aria-live="polite"></p>`;

/** Legt das <dialog> an (einmal pro Seite) */
function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.dataset.lightbox = '';
  dialog.setAttribute('aria-label', 'Großansicht');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = MARKUP;
  document.body.append(dialog);
  return dialog;
}

/**
 * @param images          [{ entry, image }] in Anzeigereihenfolge – Bilder dürfen aus verschiedenen Einträgen stammen
 * @param thumbs          (index) → { button, img } des Bildes auf der Seite (Start- und Zielpunkt des Übergangs)
 * @param collections     alle Collections (für die Namen der Tag-Chips)
 * @param currentEntryId  Eintrag der aktuellen Seite: dessen Herkunftszeile ist kein Link
 */
export function createLightbox({ images, thumbs, collections = [], currentEntryId = null }) {
  const dialog = document.querySelector('[data-lightbox]') ?? createDialog();
  const q = (name) => dialog.querySelector(`[data-lightbox-${name}]`);
  const ui = {
    backdrop: q('backdrop'),
    stage: q('stage'),
    img: q('img'),
    chrome: q('chrome'),
    number: q('number'),
    total: q('total'),
    title: q('title'),
    info: q('info'),
    infoTitle: q('info-title'),
    origin: q('origin'),
    exif: q('exif'),
    gear: q('gear'),
    settings: q('settings'),
    tags: q('tags'),
    demo: q('demo'),
    toggle: q('toggle'),
    status: q('status'),
    close: q('close'),
    prev: q('prev'),
    next: q('next'),
  };
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));

  let current = 0;
  let busy = false;      // während eines Übergangs keine weiteren Wechsel …
  let pending = 0;       // … aber der letzte Tastendruck wird gemerkt
  let closing = false;
  let loadId = 0;        // verhindert, dass ein langsam geladenes Bild ein neueres überschreibt
  let infoOpen = false;  // schmale Bildschirme: Aufnahmedaten eingeblendet?

  ui.total.textContent = `/ ${pad2(images.length)}`;
  ui.prev.hidden = ui.next.hidden = images.length < 2;

  // ---------- Bild ----------

  /** Anzeigegröße: so groß wie möglich innerhalb der Bühne, Seitenverhältnis bleibt */
  function measure(index) {
    const { width, height } = images[index].image;
    const box = ui.stage.getBoundingClientRect();
    const ratio = width / height;
    const w = Math.min(box.width, box.height * ratio, width);
    return { w, h: w / ratio };
  }

  function fit(index) {
    const { w, h } = measure(index);
    ui.img.style.width = `${w}px`;
    ui.img.style.height = `${h}px`;
    return w;
  }

  /** Zeigt sofort die schon geladene Galerie-Fassung und tauscht sie gegen die große, sobald sie da ist */
  function setSource(index, displayWidth) {
    const id = ++loadId;
    const { entry, image } = images[index];
    const attrs = imageAttrs(entry, image);
    const thumb = thumbs(index).img;

    ui.img.alt = image.alt;
    ui.img.removeAttribute('srcset');
    ui.img.src = thumb.complete && thumb.naturalWidth ? thumb.currentSrc : attrs.src;

    const full = new Image();
    full.sizes = `${Math.ceil(displayWidth)}px`;
    full.srcset = attrs.srcset;
    full.src = attrs.src;
    full.decode()
      .then(() => { if (id === loadId && ui.img.src !== full.currentSrc) ui.img.src = full.currentSrc; })
      .catch(() => {});
  }

  /** Nachbarbilder vorladen, damit Blättern sofort geht */
  function preloadAround(index) {
    for (const offset of [1, -1]) {
      const target = (index + offset + images.length) % images.length;
      const { entry, image } = images[target];
      const attrs = imageAttrs(entry, image);
      const pre = new Image();
      pre.sizes = `${Math.ceil(measure(target).w)}px`;
      pre.srcset = attrs.srcset;
      pre.src = attrs.src;
    }
  }

  // ---------- Infobereich ----------

  /** Herkunft: „Trip · Seoul · 2026 →“ als Link zum Eintrag; auf dessen eigener Seite und bei Frames nur Text */
  function renderOrigin(entry) {
    const isFrame = entry.kind === 'frame';
    const text = monoUpper([KIND_LABELS[entry.kind], isFrame ? null : entry.name, entry.year].filter(Boolean).join(' · '));
    const linked = !isFrame && entry.id !== currentEntryId;
    const origin = document.createElement(linked ? 'a' : 'span');
    origin.className = 'lightbox__origin label';
    origin.dataset.lightboxOrigin = '';
    origin.textContent = linked ? `${text} →` : text;
    if (linked) origin.href = entryUrl(entry);
    ui.origin.replaceWith(origin);
    ui.origin = origin;
  }

  /** Aufnahmedaten – fehlende Werte entfallen, ohne Daten verschwindet der ganze Block */
  function renderExif(image) {
    const { gear, settings } = formatExif(image.exif);
    ui.gear.textContent = monoUpper(gear.join(' · '));
    ui.gear.hidden = !gear.length;
    ui.settings.replaceChildren(...settings.map((value) => Object.assign(document.createElement('span'), { textContent: monoUpper(value) })));
    ui.settings.hidden = !settings.length;
    ui.exif.hidden = !gear.length && !settings.length;
  }

  /** Tags als Chips: Collections verlinkt, Technik-Tags (Analog) als Text */
  function renderTags(image) {
    const tags = (image.tags ?? []).filter((tag) => collectionNames.has(tag) || TECH_TAGS[tag]);
    ui.tags.replaceChildren(...tags.map((tag) => {
      const li = document.createElement('li');
      const isCollection = collectionNames.has(tag);
      const chip = document.createElement(isCollection ? 'a' : 'span');
      chip.className = 'chip';
      chip.textContent = isCollection ? collectionNames.get(tag) : TECH_TAGS[tag];
      if (isCollection) chip.href = collectionUrl(tag);
      li.append(chip);
      return li;
    }));
    ui.tags.hidden = !tags.length;
  }

  /** Schmal + eingeblendet: Platz unter dem Bild schaffen (die Bühne passt das Bild dann neu ein) */
  function updateInfoSpace() {
    const space = !wideQuery.matches && infoOpen ? ui.info.offsetHeight + 16 : 0;
    dialog.style.setProperty('--info-h', `${space}px`);
  }

  function setInfoOpen(open) {
    infoOpen = open;
    dialog.classList.toggle('is-info-open', open);
    ui.toggle.setAttribute('aria-expanded', String(open));
    ui.toggle.setAttribute('aria-label', open ? 'Aufnahmedaten ausblenden' : 'Aufnahmedaten anzeigen');
    updateInfoSpace();
    fit(current);
  }

  function show(index) {
    current = index;
    const { entry, image } = images[index];
    const title = image.title ?? '';
    ui.number.textContent = pad2(index + 1);
    ui.title.textContent = title;
    ui.infoTitle.textContent = title;
    ui.infoTitle.hidden = !title;
    renderOrigin(entry);
    renderExif(image);
    renderTags(image);
    ui.demo.hidden = image.demo == null;
    updateInfoSpace();   // Inhalt ändert die Höhe des Infobereichs → erst dann das Bild einpassen
    setSource(index, fit(index));
    ui.status.textContent = `Bild ${index + 1} von ${images.length}${title ? `: ${title}` : ''}`;
    if (images.length > 1) preloadAround(index);
  }

  /** Wartet, bis das Bild dekodiert ist – höchstens 0,8 s */
  function ready(img) {
    const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    return Promise.race([decoded, new Promise((resolve) => setTimeout(resolve, 800))]);
  }

  // ---------- Öffnen / Schließen ----------

  function open(index) {
    if (dialog.open) return;
    document.documentElement.classList.add('has-lightbox');
    dialog.showModal();
    ui.close.focus({ preventScroll: true });   // nicht jeder Browser setzt den Fokus in den Dialog
    show(index);
    if (!animated) return;

    const thumb = thumbs(index).img;
    const from = thumb.getBoundingClientRect();
    const to = ui.img.getBoundingClientRect();
    busy = true;
    thumb.style.visibility = 'hidden';
    const done = () => {
      busy = false;
      thumb.style.visibility = '';
      if (pending) { const queued = pending; pending = 0; go(queued); }
    };
    gsap.timeline({ onComplete: done })
      .fromTo(ui.backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power1.out' }, 0)
      .fromTo(ui.img, { x: from.left - to.left, y: from.top - to.top, scale: from.width / to.width },
        { x: 0, y: 0, scale: 1, duration: 0.8, ease: 'expo.out' }, 0)
      // nur Deckkraft (nicht autoAlpha): unsichtbare Elemente würden den Fokus verlieren
      .fromTo(ui.chrome, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.35);
  }

  async function close() {
    if (!dialog.open || closing) return;
    closing = true;
    const thumb = thumbs(current).img;

    // Galerie-Bild in den sichtbaren Bereich holen (unsichtbar hinter der Lightbox),
    // damit das Bild an seinen Platz zurückfliegen kann
    const rect = thumb.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) thumb.scrollIntoView({ block: 'center' });

    if (animated) {
      gsap.killTweensOf([ui.img, ui.backdrop, ui.chrome]);
      gsap.set(ui.img, { x: 0, y: 0, scale: 1, autoAlpha: 1 });
      const from = ui.img.getBoundingClientRect();
      const to = thumb.getBoundingClientRect();
      thumb.style.visibility = 'hidden';
      await gsap.timeline()
        .to(ui.chrome, { autoAlpha: 0, duration: 0.2 }, 0)
        .to(ui.img, { x: to.left - from.left, y: to.top - from.top, scale: to.width / from.width, duration: 0.6, ease: 'power3.inOut' }, 0)
        .to(ui.backdrop, { autoAlpha: 0, duration: 0.45, ease: 'power1.in' }, 0.15);
    }
    dialog.close();   // löst 'close' aus → cleanup
  }

  function cleanup() {
    loadId++;
    gsap?.killTweensOf([ui.img, ui.backdrop, ui.chrome]);
    gsap?.set([ui.img, ui.backdrop, ui.chrome], { clearProps: 'transform,opacity,visibility' });
    const { button, img } = thumbs(current);
    img.style.visibility = '';
    document.documentElement.classList.remove('has-lightbox');
    busy = false;
    pending = 0;
    closing = false;
    button.focus({ preventScroll: true });   // Fokus zurück auf das zuletzt gezeigte Bild
  }

  // ---------- Blättern ----------

  async function go(delta) {
    if (closing || images.length < 2) return;
    if (busy) { pending = delta; return; }   // Druck während eines Wechsels: danach ausführen
    busy = true;
    const next = (current + delta + images.length) % images.length;
    const shift = 32 * Math.sign(delta);

    if (animated) await gsap.to(ui.img, { autoAlpha: 0, x: -shift, duration: 0.2, ease: 'power2.in' });
    show(next);
    await ready(ui.img);
    if (animated) await gsap.fromTo(ui.img, { autoAlpha: 0, x: shift }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power2.out' });
    busy = false;
    if (pending && dialog.open) {
      const queued = pending;
      pending = 0;
      go(queued);
    }
  }

  // ---------- Bedienung ----------

  ui.close.addEventListener('click', close);
  ui.prev.addEventListener('click', () => go(-1));
  ui.next.addEventListener('click', () => go(1));
  ui.backdrop.addEventListener('click', close);
  ui.toggle.addEventListener('click', () => setInfoOpen(!infoOpen));

  // Esc: eigene Schließen-Animation statt sofortigem Schließen
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', cleanup);

  // Pfeiltasten blättern, „i“ blendet die Aufnahmedaten ein/aus (schmale Bildschirme)
  document.addEventListener('keydown', (event) => {
    if (!dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'i' && !wideQuery.matches) setInfoOpen(!infoOpen);
  });

  // Wischen blättert, Tipp neben das Bild schließt
  let start = null;
  ui.stage.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    start = { x: event.clientX, y: event.clientY, onImage: event.target === ui.img };
  });
  ui.stage.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const { onImage } = start;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 8 && !onImage) close();
  });
  ui.stage.addEventListener('pointercancel', () => { start = null; });

  // Fenstergröße geändert: Platz für die Aufnahmedaten neu berechnen, Bild neu einpassen
  new ResizeObserver(() => { if (dialog.open) fit(current); }).observe(ui.stage);
  wideQuery.addEventListener('change', () => { if (dialog.open) updateInfoSpace(); });

  return { open, close };
}
