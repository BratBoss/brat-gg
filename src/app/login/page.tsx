"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Provider } from "@supabase/supabase-js";

const OAUTH_PROVIDERS: { provider: Provider; label: string }[] = [
  { provider: "github", label: "GitHub" },
  { provider: "google", label: "Google" },
];

function buildCallbackUrl(next: string) {
  const base = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  return next && next !== "/" ? `${base}?next=${encodeURIComponent(next)}` : base;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const urlError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: buildCallbackUrl(next),
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }
  }

  async function handleOAuth(provider: Provider) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: buildCallbackUrl(next),
      },
    });
    if (error) {
      setError(error.message);
    }
  }

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
              className="w-full px-4 py-3 rounded-md bg-[#161d17] border border-[#2a3a2c] text-[#d6e4d2] placeholder-[#4a5e4c] text-sm focus:outline-none focus:border-[#5e7d5a] transition-colors"
            />

            {(error || urlError === "auth_failed") && (
              <p className="text-red-400/80 text-xs">
                {error ?? "Sign-in failed or was cancelled. Please try again."}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-md bg-[#2a3a2c] hover:bg-[#3a4e3c] text-[#d6e4d2] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#2a3a2c]" />
            <span className="text-[#4a5e4c] text-xs">or</span>
            <div className="flex-1 h-px bg-[#2a3a2c]" />
          </div>

          <div className="flex flex-col gap-3">
            {OAUTH_PROVIDERS.map(({ provider, label }) => (
              <button
                key={provider}
                type="button"
                onClick={() => handleOAuth(provider)}
                className="w-full py-3 rounded-md border border-[#2a3a2c] hover:border-[#3a4e3c] hover:bg-[#161d17] text-[#8aaa8c] text-sm font-medium transition-colors"
              >
                Continue with {label}
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

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
