// Canonical companion (brat) metadata.
//
// This is the single source of truth for companion slugs and display names.
// Add new companions here; all other code that needs a name or slug resolves
// it from this list rather than deriving or hardcoding it ad-hoc.

export type BratMeta = {
  slug: string;
  /** Display name shown in UI and used as speaker label in summarization. */
  name: string;
  tagline: string;
  section: string | null;
  available: boolean;
  portrait: string;
};

export const BRATS: BratMeta[] = [
  {
    slug: "aria",
    name: "Aria",
    tagline: "A quiet presence in the glade.",
    section: "Glade",
    available: true,
    portrait: "/images/aria/portrait.jpg",
  },
  {
    slug: "marcy",
    name: "Marcy",
    tagline: "Coming soon.",
    section: "Dorm",
    available: false,
    portrait: "/images/brats/marcy.png",
  },
  {
    slug: "sylvie",
    name: "Sylvie",
    tagline: "Coming soon.",
    section: "Viel",
    available: false,
    portrait: "/images/brats/sylvie.png",
  },
];

export function getBratBySlug(slug: string): BratMeta | undefined {
  return BRATS.find((b) => b.slug === slug);
}
