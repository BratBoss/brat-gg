import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Minimal proxy — refreshes the Supabase session cookie and sets CSP headers.
// Page-level auth checks happen server-side in each protected page/layout.
export async function proxy(request: NextRequest) {
  // A fresh nonce per request is required for nonce-based CSP to be effective.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;

  const cspHeader = [
    "default-src 'self'",
    // 'strict-dynamic' allows scripts loaded by nonce'd scripts (Next.js chunks).
    // 'unsafe-eval' is only needed in development for React's error-stack reconstruction.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Supabase storage hosts user avatars; data: for Next.js image edge cases.
    `img-src 'self' ${supabaseOrigin} data:`,
    "font-src 'self'",
    // Supabase (auth OTP, DB queries, storage uploads); OpenRouter is server-side only.
    `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Next.js reads the CSP from the *incoming request* headers during SSR to extract
  // the nonce and inject it into framework scripts and inline styles.
  // x-nonce is also forwarded so server components can pass it to <Script> elements.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // supabaseResponse may be re-created here; pass requestHeaders so x-nonce persists.
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not remove this call.
  await supabase.auth.getUser();

  // Set CSP on the final response. Next.js reads this header during SSR and
  // injects the nonce into all framework scripts, page bundles, and inline styles.
  supabaseResponse.headers.set("Content-Security-Policy", cspHeader);

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
