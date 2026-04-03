import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
