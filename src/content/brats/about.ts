// Brat-aware about content resolver.
//
// Each companion's about data (tagline + bio) lives in its own content file.
// This registry maps slug → about data so dynamic pages don't need
// companion-specific imports.
//
// Add a new entry here once a companion has an about.ts in src/content/{slug}/.

import { ariaAbout } from "@/content/aria/about";

export type BratAbout = {
  tagline: string;
  bio: string;
};

const ABOUT_MAP: Record<string, BratAbout> = {
  aria: ariaAbout,
};

/**
 * Returns the about data for the given brat slug, or null if not registered.
 */
export function getBratAbout(slug: string): BratAbout | null {
  return ABOUT_MAP[slug] ?? null;
}
