// Brat-aware gallery content resolver.
//
// Each companion's gallery images live in src/content/{slug}/gallery.ts.
// This registry maps slug → images so dynamic pages stay companion-agnostic.
//
// Add a new entry here once a companion has a gallery.ts.

import { ariaGallery } from "@/content/aria/gallery";
import { marcyGallery } from "@/content/marcy/gallery";

export type GalleryImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

const GALLERY_MAP: Record<string, GalleryImage[]> = {
  aria: ariaGallery,
  marcy: marcyGallery,
};

/**
 * Returns the gallery images for the given brat slug, or null if not registered.
 */
export function getBratGallery(slug: string): GalleryImage[] | null {
  return GALLERY_MAP[slug] ?? null;
}