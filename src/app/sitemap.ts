import type { MetadataRoute } from "next";
import { BRATS } from "@/content/brats";

const SITE_URL = "https://brat.gg";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  const bratRoutes: MetadataRoute.Sitemap = BRATS.map((brat) => ({
    url: `${SITE_URL}/brats/${brat.slug}`,
    lastModified: now,
    changeFrequency: brat.available ? "weekly" : "monthly",
    priority: brat.available ? 0.8 : 0.5,
  }));

  const subRoutes: MetadataRoute.Sitemap = BRATS.flatMap((brat) =>
    brat.available
      ? [
          {
            url: `${SITE_URL}/brats/${brat.slug}/journal`,
            lastModified: now,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          },
          {
            url: `${SITE_URL}/brats/${brat.slug}/gallery`,
            lastModified: now,
            changeFrequency: "monthly" as const,
            priority: 0.6,
          },
        ]
      : []
  );

  return [...staticRoutes, ...bratRoutes, ...subRoutes];
}
