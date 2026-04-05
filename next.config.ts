import type { NextConfig } from "next";

const ICON_CACHE = 'public, max-age=604800, stale-while-revalidate=86400'; // 7d / 1d SWR
const MANIFEST_CACHE = 'public, max-age=3600, stale-while-revalidate=86400'; // 1h / 1d SWR

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Web manifest — short TTL so app name/icon updates propagate within ~1 h
      { source: '/site.webmanifest', headers: [{ key: 'Cache-Control', value: MANIFEST_CACHE }] },
      // Favicons
      { source: '/favicon-:dimensions.png', headers: [{ key: 'Cache-Control', value: ICON_CACHE }] },
      // Android Chrome icons
      { source: '/android-chrome-:dimensions.png', headers: [{ key: 'Cache-Control', value: ICON_CACHE }] },
      // Apple touch icons — base + all suffixed variants (-152x152, -precomposed, etc.)
      { source: '/apple-touch-icon.png', headers: [{ key: 'Cache-Control', value: ICON_CACHE }] },
      { source: '/apple-touch-icon-:variant.png', headers: [{ key: 'Cache-Control', value: ICON_CACHE }] },
    ];
  },
  // Include each companion's system prompt in the /api/chat serverless bundle.
  // Without this the files are absent from the Vercel lambda at runtime.
  // The glob covers every companion directory under src/content/ — add a new
  // companion's prompt file there and it is automatically included.
  outputFileTracingIncludes: {
    "/api/chat": ["./src/content/*/system-prompt.md"],
  },
  images: {
    // Allow Supabase storage URLs for user avatars
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
