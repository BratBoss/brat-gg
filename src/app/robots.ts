import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/brats/", "/brats/aria", "/brats/marcy", "/brats/sylvie"],
        disallow: ["/login", "/settings", "/auth/", "/api/", "/brats/*/chat"],
      },
    ],
    sitemap: "https://brat.gg/sitemap.xml",
    host: "https://brat.gg",
  };
}
