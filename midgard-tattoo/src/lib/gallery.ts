// ─── Galerie und Bewertungen für die öffentlichen Seiten ─────────
// Eine Stelle, die entscheidet, was Besucher zu sehen bekommen.
//
// Zur Rückfall-Logik: Solange der Inhaber nichts hochgeladen hat, zeigt
// die Seite die fünf mitgelieferten Motive aus studio.ts. Sobald das
// erste eigene Bild da ist, gilt ausschließlich der eigene Bestand —
// sonst würden die Beispielbilder für immer zwischen den echten Arbeiten
// kleben und ließen sich nicht löschen.

import { readData } from "./store";
import { GALLERY, type GalleryPiece } from "./studio";
import type { MediaItem, Review } from "./types";

export interface DisplayImage {
  id: string;
  src: string;
  alt: string;
  title: string;
  style: string;
  placement: string;
  width: number;
  height: number;
  blur: string;
}

function fromMedia(item: MediaItem): DisplayImage {
  return {
    id: item.id,
    src: item.url,
    alt: item.alt || item.title,
    title: item.title,
    style: item.style,
    placement: item.placement,
    width: item.width,
    height: item.height,
    blur: item.blur,
  };
}

function fromBuiltIn(piece: GalleryPiece): DisplayImage {
  return {
    id: piece.slug,
    src: piece.src,
    alt: piece.alt,
    title: piece.title,
    style: piece.style,
    placement: piece.placement,
    width: piece.width,
    height: piece.height,
    blur: piece.blur,
  };
}

/** Bilder für die Galerie. */
export async function getGalleryImages(): Promise<DisplayImage[]> {
  try {
    const { media } = await readData();
    if (media.length) {
      return media
        .filter((m) => m.inGallery)
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .map(fromMedia);
    }
  } catch (error) {
    console.error("[gallery] Bestand nicht lesbar, zeige mitgelieferte Motive", error);
  }
  return GALLERY.map(fromBuiltIn);
}

/** Bilder für die Slideshow im Hero.
 *
 *  Reihenfolge der Quellen:
 *   1. Eigene Bilder mit gesetztem Haken „Im Hero zeigen"
 *   2. Sonst die mitgelieferten Motive, die dafür markiert sind —
 *      kuratiert, weil ein Studiofoto als bildschirmfüllender
 *      Hintergrund nicht funktioniert
 *   3. Notfalls die ersten Galeriebilder; ein leerer Hero wäre
 *      schlimmer als eine ungefragte Auswahl. */
export async function getHeroImages(): Promise<DisplayImage[]> {
  try {
    const { media } = await readData();
    if (media.length) {
      const marked = media
        .filter((m) => m.inHero)
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .map(fromMedia);
      if (marked.length) return marked;
    }
  } catch (error) {
    console.error("[gallery] Bestand nicht lesbar, zeige mitgelieferte Motive", error);
  }

  const kuratiert = GALLERY.filter((p) => p.inHero);
  if (kuratiert.length) return kuratiert.map(fromBuiltIn);

  const fallback = await getGalleryImages();
  return fallback.slice(0, 4);
}

/** Veröffentlichte Bewertungen, neueste zuerst. */
export async function getPublishedReviews(): Promise<Review[]> {
  try {
    const { reviews } = await readData();
    return reviews
      .filter((r) => r.published)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error("[reviews] Bestand nicht lesbar", error);
    return [];
  }
}
