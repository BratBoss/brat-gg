// Brat-aware gallery content resolver.
//
// Each companion's gallery images live in src/content/{slug}/gallery.ts.
// This registry maps slug → images so dynamic pages stay companion-agnostic.
//
// Add a new entry here once a companion has a gallery.ts.

import { ariaGallery, type GalleryImage } from "@/content/aria/gallery";

export type { GalleryImage };

const GALLERY_MAP: Record<string, GalleryImage[]> = {
  aria: ariaGallery,
};

/**
 * Returns the gallery images for the given brat slug, or null if not registered.
 */
export function getBratGallery(slug: string): GalleryImage[] | null {
  return GALLERY_MAP[slug] ?? null;
}
