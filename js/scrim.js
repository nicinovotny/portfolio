// Bildabhängige Verläufe: misst, wie hell ein Bild oben (Navigation) und unten (Titel, Zähler) ist,
// und setzt danach --scrim-top / --scrim-bottom (0 = dunkles Bild, 1 = sehr hell) auf einem Element.
// Die CSS-Verläufe (Startseite, Album-Bühne) werden damit nur bei hellen Bildern kräftiger.
// Voraussetzung: Das Bild ist mit crossOrigin="anonymous" geladen oder liegt auf derselben Domain.

const cache = new WeakMap();

function measure(img) {
  if (cache.has(img)) return cache.get(img);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 20;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const band = (y0, y1) => {
    const { data } = ctx.getImageData(0, y0, canvas.width, y1 - y0);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    return sum / (data.length / 4) / 255;
  };
  const value = { top: band(0, 4), bottom: band(10, 20) };
  cache.set(img, value);
  return value;
}

export function applyScrim(target, img) {
  let value;
  try {
    value = measure(img);
  } catch {
    return;   // Bild ohne Freigabe zum Auslesen: Standardwerte aus dem CSS bleiben
  }
  // ab ca. 35 % Helligkeit wird nachgedunkelt, ab 70 % voll
  const level = (lum) => Math.min(1, Math.max(0, (lum - 0.35) / 0.35));
  target.style.setProperty('--scrim-top', level(value.top).toFixed(2));
  target.style.setProperty('--scrim-bottom', level(value.bottom).toFixed(2));
}
