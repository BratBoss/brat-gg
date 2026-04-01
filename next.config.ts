import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include the system prompt file in the /api/chat serverless bundle.
  // Without this, the file is not present in the Vercel lambda at runtime.
  outputFileTracingIncludes: {
    "/api/chat": ["./src/content/aria/system-prompt.md"],
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
