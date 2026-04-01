"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <span className="text-[#8aaa8c] text-sm tracking-widest uppercase">
            brat.gg
          </span>
        </div>

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

              {error && (
                <p className="text-red-400/80 text-xs">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md bg-[#2a3a2c] hover:bg-[#3a4e3c] text-[#d6e4d2] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
