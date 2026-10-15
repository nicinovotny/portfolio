# Projektbriefing: Fotografie-Portfolio Nicolas Novotny

## Kontext
Ich bin Nici, Landschaftsfotograf (ca. 6 Jahre, Nicolas Novotny, nicolasnovotny.de, @nicinovotny) und studiere Online-Medien-Management mit Schwerpunkt Webentwicklung. Ich möchte ein Online-Portfolio meiner besten Bilder bauen. Die Seite soll zwei Dinge gleichzeitig zeigen: meine Fotografie und dass ich beeindruckendes, modernes Web-Development kann. Sie ist eine reine Präsentationsseite, die ich Leuten (auch potenziellen Arbeitgebern) zeigen kann.

## Ziel
Eine moderne, leicht futuristische und konzeptionelle Portfolio-Website, die meine Landschaftsbilder in den Mittelpunkt stellt und auf GitHub Pages läuft. Zunächst mit Demo-Bildern; meine echten Bilder füge ich danach Schritt für Schritt ein.

## Vorgehen in Phasen
**Phase 1 – Designrichtungen (erst vorschlagen, noch nicht bauen):**
2–3 klar unterschiedliche Designrichtungen. Je Richtung: Name, Stimmung in 2–3 Sätzen, Farbpalette, Schriftpaarung, Signature-Animation/Übergang, wie Startseite und Karte darin wirken. Die Balance ist entscheidend: modern, fast futuristisch, aber nicht abgefahren – es muss zu Landschaft und Fotografie passen, die Bilder sind immer der Star, das Interface tritt zurück. Danach auf Nicis Wahl warten.

**Phase 2 – Umsetzung** der gewählten Richtung, Schritt für Schritt.

**Phase 3 – Kurze Anleitung**, wie Nici eigene Bilder und neue Orte einfügt und die Seite auf GitHub Pages veröffentlicht.

## Seiten & Features

### 1. Startseite
Wenige, starke Bilder wirkungsvoll inszeniert, z. B. Fullscreen-Hero mit eleganten Übergängen, Scroll-Animationen, Parallax oder Slide-Effekten. Lieber wenig und eindrucksvoll als eine volle Galerie.

### 2. Weltkarte mit Zoom-Navigation (das Herzstück)
Eine stilisierte, selbst gebaute SVG-Weltkarte (kein 3D-Globus, keine Google/Mapbox-Karte), passend zum Design und voll animierbar. Die Karte funktioniert wie eine Kamera, die von oben über die Welt fliegt:

- **Weltansicht:** Orte, die nah beieinander liegen, werden zu Clustern zusammengefasst (z. B. „Europa · 6 Alben“), damit es übersichtlich bleibt. Nici hat viel in Deutschland und Europa fotografiert, dort wird es sonst schnell voll.
- **Klick auf Cluster oder Region:** Weiche, filmische Zoom-Animation in diesen Bereich (z. B. per GSAP animierte viewBox), mit Easing, das sich wie eine Kamerafahrt anfühlt. Der Ausschnitt wird so gewählt, dass man die Umgebung zur Orientierung sieht. Beispiel Färöer: Die Inseln sind auf der Weltkarte kaum sichtbar, nach dem Zoom liegen sie mittig, Island oben links, Norwegen oben rechts, Schottland unten links sind noch erkennbar. Beispiel Dolomiten: Man sieht die Alpen, und weiter links liegt z. B. das Schweiz-Album als eigener Marker.
- **Gezoomte Ansicht:** Jetzt erscheinen die einzelnen Album-Marker, dazu mehr Kartendetail (Ländergrenzen, Küstenlinien, dezente Beschriftungen), das beim Zoomen eingeblendet wird. Hover zeigt Ortsname + Vorschaubild. Klick auf einen Marker führt mit flüssigem Übergang auf die Albumseite.
- **Herauszoomen:** Intuitiv über einen dezenten Zurück-/Weltansicht-Button, Escape, Klick auf freie Fläche oder Rausscrollen/Pinch. Optional mehrere Stufen (Welt → Kontinent → Region), sodass man sich schrittweise rein- und rauszoomt.
- **Kartendaten:** Grobe Weltumrisse für die Übersicht, beim Reinzoomen detailliertere Umrisse (z. B. auf Basis von Natural Earth), damit kleine Inseln wie die Färöer scharf bleiben. Nur die nötigen Daten laden, damit die Seite schnell bleibt.
- **Mobil:** Tap statt Hover, Pinch-Zoom, große Touch-Ziele.
- **Startorte:** Färöer-Inseln, Südkorea, Lofoten, Südtirol/Dolomiten, Schweiz, plus 1–2 Orte in Deutschland als [Platzhalter]. Alle Zoom-Ausschnitte werden aus den Koordinaten in der zentralen Datendatei berechnet, damit neue Orte automatisch funktionieren.

### 3. Albumseite pro Ort
Ein gemeinsames Template (z. B. album.html?ort=faroe), damit jedes Album eine teilbare URL hat. Nur Bilder dieses Orts, schöne Galerie mit Lightbox/Vollbild, kurzer Text zum Ort, Navigation zum nächsten Ort und zurück zur Karte (idealerweise zurück in den passenden Zoom-Ausschnitt).

### 4. Über mich
Steckbrief-artig, mit Porträt-Platzhalter, ein paar persönlichen Infos, Kamera-Equipment und Werdegang als [Platzhalter].

### 5. Navigation
Schlanke Menüleiste mit kleinen Icons zu Instagram und LinkedIn (Links als [Platzhalter]). Dezenter Footer-Link für ein Impressum (Inhalt trägt Nici nach).

## Technik
- Vanilla HTML, CSS und JavaScript, kein Framework, kein Build-Schritt – die Seite muss direkt aus dem Repo auf GitHub Pages laufen. Begründung: einfache Seite, volle Kontrolle, leicht wartbar.
- GSAP (inkl. ScrollTrigger) per CDN für Animationen und Karten-Zoom; View Transitions API für Seitenübergänge, mit sauberem Fallback.
- Alle Pfade relativ, damit es auch unter username.github.io/repo-name funktioniert.
- Lokales Testen über einen einfachen Dev-Server (z. B. VS Code Live Server oder `npx serve`), da JSON per fetch nicht über file:// lädt.
- **Datenmodell:** Alle Orte und Bilder in einer zentralen Datei (data/albums.json) mit id, Name, Land, Region/Cluster, Koordinaten, Kurztext, Cover-Bild und Bildliste (Datei, Titel, Alt-Text). Karte, Startseite und Albumseiten werden daraus generiert, sodass neue Bilder oder Orte nur dort und im Bilderordner ergänzt werden. Ordnerstruktur: images/<ort-id>/.
- **Demo-Bilder:** Landschafts-Platzhalter von picsum.photos mit festen Seeds, damit sie stabil bleiben, und so eingebunden, dass sie später einfach durch eigene Dateien ersetzt werden.

## Qualitätskriterien
- Kein Kontaktformular, keine Cookies, kein Tracking, keine Analytics. Schriften selbst hosten statt von Google Fonts laden (DSGVO).
- Performance trotz großer Bilder und Kartendaten: Lazy Loading, responsive Bildgrößen (srcset), moderne Formate (WebP/AVIF), keine Layout-Sprünge, flüssige 60-fps-Animationen.
- Voll responsiv; auf dem Handy bleibt die Karte per Tap und Pinch gut bedienbar.
- `prefers-reduced-motion` respektieren (Zoom dann als schneller Überblendeffekt), Tastaturbedienung und Alt-Texte für Barrierefreiheit.
- Sauberer, kommentierter Code, den Nici versteht und weiterentwickeln kann.
- Vermeiden: generischer Template-Look, überladene Effekte, die von den Bildern ablenken, Effekte ohne Zweck.

## Ausgabe
In Phase 2 alle Dateien vollständig mit Ordnerstruktur und kurzer README.