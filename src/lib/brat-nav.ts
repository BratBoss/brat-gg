export type NavLink = { label: string; href: string };

export function buildBratNavLinks(slug: string, sectionLabel: string): NavLink[] {
  return [
    { label: sectionLabel, href: `/brats/${slug}` },
    { label: "Journal", href: `/brats/${slug}/journal` },
    { label: "Gallery", href: `/brats/${slug}/gallery` },
    { label: "Chat", href: `/brats/${slug}/chat` },
    { label: "Settings", href: `/settings?brat=${slug}` },
  ];
}
