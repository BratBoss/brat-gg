"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Provider } from "@supabase/supabase-js";

const OAUTH_PROVIDERS: { provider: Provider; label: string; icon: React.ReactNode }[] = [
  {
    provider: "github",
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
];

function isSafeNextPath(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//") && !next.includes(":") && !next.includes("@");
}

function buildCallbackUrl(next: string) {
  const base = `${window.location.origin}/auth/callback`;
  const safePath = isSafeNextPath(next) ? next : "/";
  return safePath !== "/" ? `${base}?next=${encodeURIComponent(safePath)}` : base;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const urlError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading("magic-link");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: buildCallbackUrl(next),
      },
    });

    setAuthLoading(null);

    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }
  }

  async function handleOAuth(provider: Provider) {
    setAuthLoading(provider);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: buildCallbackUrl(next),
      },
    });
    // signInWithOAuth redirects on success; only reaches here on error.
    setAuthLoading(null);
    if (error) {
      setError(error.message);
    }
  }

  const busy = authLoading !== null;

  return (
    <>
      {submitted ? (
        <div className="text-center space-y-3">
          <p className="text-[#d6e4d2] text-lg font-light">Check your email.</p>
          <p className="text-[#6b8a6e] text-sm leading-relaxed">
            A magic link has been sent to{" "}
            <span className="text-[#8aaa8c]">{email}</span>. Click it to sign
            in — no password needed.
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-light text-[#d6e4d2] mb-2 text-center">
            Sign in
          </h1>
          <p className="text-[#6b8a6e] text-sm text-center mb-8">
            Enter your email and we will send you a magic link.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="w-full px-4 py-3 rounded-md bg-[#161d17] border border-[#2a3a2c] text-[#d6e4d2] placeholder-[#4a5e4c] text-base sm:text-sm focus:outline-none focus:border-[#5e7d5a] transition-colors disabled:opacity-50"
            />

            {(error || urlError === "auth_failed") && (
              <p className="text-red-400/80 text-xs">
                {error ?? "Sign-in failed or was cancelled. Please try again."}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-md bg-[#2a3a2c] hover:bg-[#3a4e3c] text-[#d6e4d2] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading === "magic-link" ? "Sending…" : "Send magic link"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#2a3a2c]" />
            <span className="text-[#4a5e4c] text-xs">or</span>
            <div className="flex-1 h-px bg-[#2a3a2c]" />
          </div>

          <div className="flex flex-col gap-3">
            {OAUTH_PROVIDERS.map(({ provider, label, icon }) => (
              <button
                key={provider}
                type="button"
                disabled={busy}
                onClick={() => handleOAuth(provider)}
                className="w-full py-3 rounded-md border border-[#2a3a2c] hover:border-[#3a4e3c] hover:bg-[#161d17] text-[#8aaa8c] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
              >
                {icon}
                {authLoading === provider ? "Connecting…" : `Continue with ${label}`}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="text-[#8aaa8c] text-sm tracking-widest uppercase hover:text-[#d6e4d2] transition-colors"
          >
            brat.gg
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-light text-[#d6e4d2] mb-2 text-center">
                  Sign in
                </h1>
                <p className="text-[#6b8a6e] text-sm text-center">
                  Enter your email and we will send you a magic link.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="h-11 rounded-md bg-[#161d17] border border-[#2a3a2c] animate-pulse" />
                <div className="h-11 rounded-md bg-[#2a3a2c] animate-pulse" />
              </div>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
