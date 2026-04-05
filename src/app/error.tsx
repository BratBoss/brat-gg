"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex flex-col" data-brat="home">
      <header className="border-b border-[var(--th-border)] px-6 py-4">
        <div className="flex items-center justify-between min-h-[24px]">
          <Link
            href="/"
            className="text-[var(--th-dim)] text-sm tracking-widest uppercase hover:text-[var(--th-text)] transition-colors"
          >
            brat.gg
          </Link>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)] px-8 py-10 sm:px-12 sm:py-14">
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-4">
              <p className="text-[var(--th-accent)] text-xs tracking-[0.24em] uppercase">
                500 · forest mishap
              </p>
              <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-[var(--th-text)]">
                Something went wrong.
              </h1>
              <p className="text-[var(--th-soft)] text-base sm:text-lg leading-relaxed">
                The woods coughed, tripped, and dropped this page.
              </p>
              <p className="text-[var(--th-dim)] text-sm sm:text-base leading-relaxed">
                This one’s on me, not you. Something went sideways behind the scenes.
                Give it a moment, then try again.
              </p>
              <div className="pt-2 text-[var(--th-muted)] text-sm leading-relaxed">
                <span className="text-[var(--th-accent-bright)] font-medium">Best move</span>{" "}
                head back home or retry once the gremlins calm down.
              </div>
              <div className="pt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex items-center rounded-md bg-[var(--th-border)] px-4 py-2 text-sm text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors cursor-pointer"
                >
                  Try again
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center rounded-md border border-[var(--th-border)] px-4 py-2 text-sm text-[var(--th-dim)] hover:text-[var(--th-text)] hover:border-[var(--th-accent)] transition-colors"
                >
                  Back home
                </Link>
              </div>
            </div>

            <div className="hidden md:flex justify-end">
              <div className="relative w-48 h-64 overflow-hidden rounded-md border border-[var(--th-border)] bg-[var(--th-bg)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/aria/portrait.jpg"
                  alt="Portrait of Aria"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
