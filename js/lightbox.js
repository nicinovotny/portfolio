// Großansicht als <dialog>: Fokus bleibt darin, Esc schließt, die Seite dahinter ist inaktiv.
// Übergang: Das Bild wächst aus seiner Position in der Galerie (FLIP-Technik) und kehrt beim
// Schließen dorthin zurück – so bleibt klar, wo man in der Galerie ist.
// Bei reduzierter Bewegung wird nur umgeschaltet.

import { imageAttrs } from './data.js';
import { pad2 } from './format.js';

const gsap = window.gsap;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animated = Boolean(gsap) && !reducedMotion;

/**
 * @param dialog  das <dialog data-lightbox> aus album.html
 * @param album   Album aus albums.json
 * @param thumbs  (index) → { button, img } des Galerie-Bildes
 */
export function createLightbox({ dialog, album, thumbs }) {
  const { images } = album;
  const q = (name) => dialog.querySelector(`[data-lightbox-${name}]`);
  const ui = {
    backdrop: q('backdrop'),
    stage: q('stage'),
    img: q('img'),
    chrome: q('chrome'),
    number: q('number'),
    total: q('total'),
    title: q('title'),
    meta: q('meta'),
    status: q('status'),
    close: q('close'),
    prev: q('prev'),
    next: q('next'),
  };

  let current = 0;
  let busy = false;      // während eines Übergangs keine weiteren Wechsel …
  let pending = 0;       // … aber der letzte Tastendruck wird gemerkt
  let closing = false;
  let loadId = 0;        // verhindert, dass ein langsam geladenes Bild ein neueres überschreibt

  ui.total.textContent = `/ ${pad2(images.length)}`;
  ui.prev.hidden = ui.next.hidden = images.length < 2;

  // ---------- Bild ----------

  /** Anzeigegröße: so groß wie möglich innerhalb der Bühne, Seitenverhältnis bleibt */
  function measure(index) {
    const { width, height } = images[index];
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
    const image = images[index];
    const attrs = imageAttrs(album, image);
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
      const attrs = imageAttrs(album, images[target]);
      const pre = new Image();
      pre.sizes = `${Math.ceil(measure(target).w)}px`;
      pre.srcset = attrs.srcset;
      pre.src = attrs.src;
    }
  }

  function show(index) {
    current = index;
    const image = images[index];
    setSource(index, fit(index));
    ui.number.textContent = pad2(index + 1);
    ui.title.textContent = image.title;
    ui.meta.textContent = [album.shortName ?? album.name, image.demo != null ? 'Demo-Bild' : null].filter(Boolean).join(' · ');
    ui.status.textContent = `Bild ${index + 1} von ${images.length}: ${image.title}`;
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

  // Esc: eigene Schließen-Animation statt sofortigem Schließen
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', cleanup);

  document.addEventListener('keydown', (event) => {
    if (!dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
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

  // Fenstergröße geändert: Bild neu einpassen
  new ResizeObserver(() => { if (dialog.open) fit(current); }).observe(ui.stage);

  return { open, close };
}
