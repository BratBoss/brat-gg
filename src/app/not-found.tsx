import Link from "next/link";
import HeaderShell from "@/components/HeaderShell";
import AuthStatus from "@/components/AuthStatus";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col" data-brat="aria">
      <HeaderShell
        left={
          <Link
            href="/"
            className="text-[var(--th-dim)] text-sm tracking-widest uppercase hover:text-[var(--th-text)] transition-colors"
          >
            brat.gg
          </Link>
        }
        right={<AuthStatus loginHref="/login?brat=home" />}
      />

      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)] px-8 py-10 sm:px-12 sm:py-14">
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-4">
              <p className="text-[var(--th-accent)] text-xs tracking-[0.24em] uppercase">
                404 · wrong trail
              </p>
              <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-[var(--th-text)]">
                Lost already?
              </h1>
              <p className="text-[var(--th-soft)] text-base sm:text-lg leading-relaxed">
                That page isn’t here. Maybe the woods ate it.
              </p>
              <p className="text-[var(--th-dim)] text-sm sm:text-base leading-relaxed">
                You took a wrong turn somewhere in my little forest. It happens.
                Try not to wander off too far before I have to come drag you back.
              </p>
              <div className="pt-2 text-[var(--th-dim)] text-sm leading-relaxed">
                <span className="text-[var(--th-accent-bright)] font-medium">Best move</span>{" "}
                head back home before you get any more distracted.
              </div>
              <div className="pt-3 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-md bg-[var(--th-border)] px-4 py-2 text-sm text-[var(--th-text)] hover:bg-[var(--th-surface-hover)] transition-colors"
                >
                  Back home
                </Link>
                <Link
                  href="/brats/aria"
                  prefetch={false}
                  className="inline-flex items-center rounded-md border border-[var(--th-border)] px-4 py-2 text-sm text-[var(--th-dim)] hover:text-[var(--th-text)] hover:border-[var(--th-accent)] transition-colors"
                >
                  Visit Aria
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
