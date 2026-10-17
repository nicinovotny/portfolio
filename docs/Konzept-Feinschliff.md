# Konzept: Feinschliff vor Schritt 8 (17.10.2026)

Zwei Änderungen, mit Nici besprochen am 17.10.2026. Sie werden **vor** Umbau-Schritt 8 (neue Einträge) umgesetzt, damit die neuen Inhalte gleich in der endgültigen Form erscheinen. Reihenfolge: erst A (klein), dann B (mittel). Nach jedem Teil anhalten, Nici testet, dann Commit.

---

## A. Collections-Übersicht kompakter (`collections.html`)

### Problem
- Jede Collection füllt fast den ganzen Bildschirm: Bild 16:10 auf ca. 58 % Breite, Name in Display-Größe, 7 rem Abstand zwischen den Zeilen. Auf dem Desktop sieht man immer nur eine Collection und muss für jede weitere scrollen.
- Die grünen Linien (Haarlinie vor „Collection öffnen“ in Gletscherfarbe) und die gepunktete Führungslinie gefallen Nici nicht.

### Vorbild
Nicis bisherige Adobe-Portfolio-Seite: <https://nicolasnovotny208ce6.myportfolio.com/work>
- Zickzack-Zeilen: Bild auf der halben Breite, daneben eine ruhige Fläche mit nur dem Namen (klein, mittig), Seiten wechseln von Zeile zu Zeile.
- Zeilenhöhe ca. 450 px bei 1024 px Fensterbreite → knapp zwei Collections auf einen Blick.
- Kein Link-Text, keine Linien; die ganze Zeile ist der Link.

### Umsetzung im Stil „Höhenlinie“

**Aufbau einer Zeile (Desktop ab 48rem):**
```
┌──────────────────────────────┬─────────────────────┐
│                              │                     │
│   Titelbild (3:2, cover)     │        01           │  ← Mono, leise (#5E666B)
│   ca. 55–58 % der Breite      │     Landscape       │  ← Geist 200, ca. 2.5–3.5rem
│                              │      21 Trips       │  ← Mono-Label (#8C9397)
│                              │  [Text, optional]   │  ← klein, max. 2 Zeilen
└──────────────────────────────┴─────────────────────┘
┌─────────────────────┬──────────────────────────────┐
│        02           │                              │
│     Automotive      │   Titelbild                  │   ← nächste Zeile gespiegelt
│      8 Shoots       │                              │
└─────────────────────┴──────────────────────────────┘
```
- Grid pro Zeile: `grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr)`; jede zweite Zeile gespiegelt (`:nth-child(even)` → Bild rechts, z. B. per `order` oder `grid-template-areas`). Landscape (erste Zeile) hat das Bild links.
- Bild: `aspect-ratio: 3 / 2`, `object-fit: cover`, Höhe zusätzlich begrenzt (`max-height: 55svh`), damit es auf breiten, flachen Bildschirmen nicht ausufert. Die Textfläche ist genauso hoch wie das Bild (Grid streckt).
- Textfläche: Hintergrund `var(--color-land-2)` (#161B1F, dunkle Entsprechung zum Hellgrau des Vorbilds), Inhalt vertikal und horizontal zentriert, Abstände `var(--space-s)`.
- Inhalt: Ziffer (`.label.label--quiet`), Name (Geist 200, `clamp(2rem, 1.4rem + 2vw, 3.5rem)`, `letter-spacing: -0.03em`), Zähler aus `formatCollectionCounts` (`.label`), optional `collection.text` klein (0.9375rem, Sekundärfarbe, max. 2 Zeilen mit `-webkit-line-clamp`). Ohne Bilder: Zähler „Noch leer“, Bildfläche bleibt dunkel (`.is-empty`).
- Abstand zwischen den Zeilen: `var(--space-s)` bis `var(--space-m)` (1–1.5rem) statt `var(--space-2xl)`.
- Seitenkopf („Portfolio — 05 Collections“ / „Collections“) bleibt, darf aber etwas weniger Abstand nach unten haben, damit die erste Zeile früher beginnt.

**Entfällt:**
- „Collection öffnen“ (`.line-link` mit grüner Linie)
- gepunktete Führungslinie (`.collection-row__leader`) und die Kopfzeile `01 ……… 21 Trips`

**Zustände (Barrierefreiheit):**
- Ganze Zeile ist ein `<a>`; sichtbarer Fokus (`:focus-visible`, Outline mit Abstand).
- Überfahren und Fokus: Bild zoomt leicht (`scale(1.03)`, wie bisher), Name färbt sich in Gletscherfarbe `#A9C4C4`. Das ist der einzige Akzent, keine Linien.
- `prefers-reduced-motion`: kein Zoom (globale Regel in `css/base.css` greift schon).
- Alt-Text des Titelbilds bleibt leer (dekorativ), der Name beschreibt den Link.

**Handy (unter 48rem):**
- Kein Zickzack: Bild oben (3:2, volle Breite), darunter die Fläche als schmale Leiste: links Ziffer + Name (ca. 1.75rem), rechts der Zähler. Text weglassen oder eine Zeile.
- Abstand zwischen den Collections ca. 1.5rem.

**Dateien:** `js/collections.js` (Markup der Zeile neu: `<a class="collection-row">` mit `.collection-row__image` und `.collection-row__panel`), `css/collections.css` (neu schreiben). Sonst nichts – Datenfunktionen (`getCollectionCover`, `formatCollectionCounts`) bleiben.

**Offene Frage an Nici beim Umsetzen:** Soll die Collections-Liste auf der **Startseite** (große Textzeilen `01 Landscape …… 21 Trips` mit Vorschaubild beim Überfahren) so bleiben? Sie hat ebenfalls eine gepunktete Führungslinie und große Zeilen. Vorschlag: so lassen (sie ist bewusst typografisch und auf der Startseite kompakter), nur die Führungslinie ggf. entfernen – Nici entscheidet.

**Testen:** 1440×900 (zwei Collections sichtbar?), 1024×768, 375×812; Tastatur (Tab durch alle Zeilen, Fokus sichtbar); keine horizontale Scrollleiste.

---

## B. Eintragsseite darf nicht wie die Startseite aussehen (`entry.html`)

### Problem
Startseiten-Hero und Bühne der Eintragsseite sind fast gleich: Vollbild, dunkle Verläufe, unten links ein Mono-Label und ein riesiger Titel in Geist 200, Eckmarken. Bei Seoul 2026 ist sogar das Bild dasselbe (Hero-Favorit = Titelbild des Eintrags). Nach dem Klick wirkt es, als sei man auf der Startseite geblieben oder der Link falsch – erst beim Scrollen sieht man die Galerie. Nici mag die großen Bilder, aber der **erste Blick** in einen Eintrag muss sich klar von der Startseite unterscheiden.

### Grundsatz
- **Startseite:** Vollbild, Diashow – große Ziffer `01 / 05`, Fortschrittslinie, Pause, Name der Collection in Display-Größe.
- **Eintragsseite:** großes Bild, aber erkennbar eine *Seite mit Inhalt*: kürzere Bühne, Ortsangabe „wo bin ich“, Inhalt beginnt schon im ersten Bildschirm.

### Umsetzung (Kombination aus drei Änderungen)

**1. Kürzere Bühne mit Anschnitt**
- Höhe `72svh` (statt `100svh`), `min-height: 26rem`. Unter der Bühne ist im ersten Bildschirm schon der Anfang des Inhalts zu sehen (Einleitungstext bzw. obere Kante der Galerie).
- Das bisherige Verhalten bleibt: Bühne `sticky`, beim Scrollen leichter Zoom + Abdunkeln, Inhalt schiebt sich darüber (`setupStageScroll` in `js/entry.js`, Endpunkte beziehen sich schon auf `el.stage.offsetHeight`).
- Der Hinweis „05 Bilder“ mit laufender Linie unten Mitte entfällt (der Inhalt ist ja sichtbar) – oder wandert als kleines Label in die Bühnenbeschriftung.

**2. Brotkrumen-Zeile oben**
- Direkt unter der Kopfzeile, links, in Geist Mono (`.label`), auf der Bühne mit Textschatten wie die übrigen Bühnenlabels:
  `Collections / Landscape / Trip 03 von 21`
  - „Collections“ → `collections.html`, „Landscape“ → `collection.html?id=landscape` (Links), „Trip 03 von 21“ = Position innerhalb der Collection (nur Text).
- Als `<nav aria-label="Brotkrumen">` mit `<ol>`, aktuelles Element mit `aria-current="page"`.
- Handy: gekürzt auf `← Landscape · 03/21`.

**3. Kleinerer Titel, keine Startseiten-Elemente**
- Titel statt `var(--text-display)` (bis 6.5rem) in ca. `clamp(2.25rem, 1.5rem + 3vw, 4rem)` (≈ `var(--text-h1)` bis etwas größer), Label darüber unverändert (`Trip — Sep 2026 · 5 Tage — Koordinaten`).
- Keine Diashow-Optik: keine große Ziffer, keine Fortschrittslinie (hat die Eintragsseite ohnehin nicht – so bleibt es).
- Eckmarken: unten links/rechts entfernen oder nur oben behalten, damit der „Instrumentenrahmen“ der Startseite nicht 1:1 wiederkehrt.
- Voriger/Nächster auf der Bühne (unten rechts) bleibt, rückt mit der kürzeren Bühne nach oben.

**Seitenübergang („Bild fliegt in den Eintrag“):** funktioniert weiter – die Bühne trägt den Übergangsnamen `entry-cover`, sie ist nur niedriger; das Bild landet im kleineren Rahmen. Der Titel gleitet von der Startseite nicht mehr groß→groß (die Größen unterscheiden sich jetzt); prüfen, ob `morphTitle` (Inline-Skript in `entry.html`, `js/transitions.js`) dann besser immer aus ist (Titel blendet mit der Bühne ein). Übergang Eintrag → Eintrag (`entry-swap`) unverändert.

**Lesbarkeit:** Verläufe (`.entry-stage__shade`, `::before`) an die geringere Höhe anpassen; `applyScrim` (Bildhelligkeit) bleibt.

**Dateien:**
- `entry.html` – Brotkrumen-Markup in der Bühne, Scroll-Hinweis entfernen/umbauen
- `css/entry.css` – Bühnenhöhe, Titelgröße, Brotkrumen, Eckmarken, Verläufe, Handy
- `js/entry.js` – Brotkrumen befüllen (Collection-Name, Position `index + 1` von `siblings.length` – beides ist in `init()` schon vorhanden)
- ggf. `js/transitions.js` / Inline-Skript in `entry.html` (Titel-Übergang)

**Alternative (nur falls A–C oben noch zu ähnlich wirken):** Bild nicht randlos, sondern eingerahmt mit Seitenrand (`var(--gutter)`) und Eckmarken, Titel und Label *neben* bzw. *unter* dem Bild statt darauf. Deutlicherer Bruch, aber weniger immersiv – erst vorschlagen, nicht direkt bauen.

**Testen:**
- Startseite → „Aus: Trip · Seoul · 2026 →“ (gleiches Bild!) – ist sofort klar, dass man im Eintrag ist?
- Collection-Kachel → Eintrag, Karte → Eintrag, Voriger/Nächster
- 1440×900, 1024×768, 375×812; Firefox ohne View Transitions; `prefers-reduced-motion`
- Trip und Shoot (Shoot nur mit vorübergehendem Testeintrag, siehe Schritt 2)

---

## Danach
Umbau-Schritt 8: neue Einträge aus der Bestandsliste (Entscheidungen dazu in `docs/Entscheidungen.md`, „Vorbereitung Schritt 8“).
