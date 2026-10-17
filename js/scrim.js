// Bildabhängige Verläufe: misst, wie hell ein Bild oben (Navigation) und unten (Titel, Zähler) ist,
// und setzt danach --scrim-top / --scrim-bottom (0 = dunkles Bild, 1 = sehr hell) auf einem Element.
// Die CSS-Verläufe (Startseite, Bühne der Eintragsseite) werden damit nur bei hellen Bildern kräftiger.
// Voraussetzung: Das Bild ist mit crossOrigin="anonymous" geladen oder liegt auf derselben Domain.
//
// Gemessen wird an einer winzigen Fassung (32 × 20 px), die createImageBitmap im Hintergrund erzeugt –
// so muss der Hauptthread das große Bild nicht selbst dekodieren (das ließ die Seite kurz stocken).

const WIDTH = 32;
const HEIGHT = 20;
const cache = new WeakMap();   // img → Promise<{ top, bottom }>

/** Kleine Fassung des Bildes; ohne createImageBitmap-Verkleinerung (ältere Browser) direkt vom Bild */
async function smallSource(img) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(img, { resizeWidth: WIDTH, resizeHeight: HEIGHT, resizeQuality: 'low' });
    } catch { /* weiter mit dem Bild selbst */ }
  }
  return img;
}

async function measure(img) {
  const source = await smallSource(img);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, WIDTH, HEIGHT);
  source.close?.();
  const band = (y0, y1) => {
    const { data } = ctx.getImageData(0, y0, WIDTH, y1 - y0);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    return sum / (data.length / 4) / 255;
  };
  return { top: band(0, 4), bottom: band(10, 20) };
}

export async function applyScrim(target, img) {
  if (!cache.has(img)) cache.set(img, measure(img));
  let value;
  try {
    value = await cache.get(img);
  } catch {
    return;   // Bild ohne Freigabe zum Auslesen: Standardwerte aus dem CSS bleiben
  }
  // ab ca. 35 % Helligkeit wird nachgedunkelt, ab 70 % voll
  const level = (lum) => Math.min(1, Math.max(0, (lum - 0.35) / 0.35));
  target.style.setProperty('--scrim-top', level(value.top).toFixed(2));
  target.style.setProperty('--scrim-bottom', level(value.bottom).toFixed(2));
}
