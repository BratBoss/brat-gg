import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow Supabase storage URLs for user avatars
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // unoptimized: true is set per-image for local/public assets above
  },
};

export default nextConfig;
