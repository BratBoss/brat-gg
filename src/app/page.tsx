import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import HeaderShell from "@/components/HeaderShell";
import { BRATS, type BratMeta } from "@/content/brats";

const brats = BRATS;

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col" data-brat="home">
      {/* Header */}
      <HeaderShell
        left={
          <span className="text-[var(--th-dim)] text-sm tracking-widest uppercase">
            brat.gg
          </span>
        }
        center={
          <div className="flex items-center gap-5 flex-wrap opacity-0 pointer-events-none select-none" aria-hidden="true">
            <span className="relative px-0 py-1.5 text-sm text-[var(--th-text)] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-[var(--th-accent)]">
              Glade
            </span>
            <span className="relative px-0 py-1.5 text-sm text-[var(--th-subtle)]">Journal</span>
            <span className="relative px-0 py-1.5 text-sm text-[var(--th-subtle)]">Gallery</span>
            <span className="relative px-0 py-1.5 text-sm text-[var(--th-subtle)]">Chat</span>
            <span className="relative px-0 py-1.5 text-sm text-[var(--th-subtle)]">Settings</span>
          </div>
        }
        right={<AuthStatus loginHref="/login?brat=home" />}
      />

      {/* Hero */}
      <section className="px-8 pt-16 pb-12 max-w-3xl">
        <h1 className="text-3xl font-light text-[var(--th-text)] mb-3 tracking-tight">
          A quiet home for digital companions.
        </h1>
        <p className="text-[var(--th-dim)] text-base leading-relaxed">
          Each brat has their own space — a place to think, talk, and simply be.
          Select one to enter.
        </p>
      </section>

      {/* Brat roster */}
      <section className="px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl">
          {brats.map((brat) =>
            brat.available ? (
              <Link
                key={brat.slug}
                href={`/brats/${brat.slug}`}
                className="group relative overflow-hidden rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)] hover:border-[var(--th-accent)] transition-colors duration-300"
              >
                <BratCard brat={brat} />
              </Link>
            ) : (
              <div
                key={brat.slug}
                className="relative overflow-hidden rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)] opacity-50 cursor-not-allowed"
              >
                <BratCard brat={brat} dimmed />
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}

function BratCard({
  brat,
  dimmed = false,
}: {
  brat: BratMeta;
  dimmed?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* Portrait area */}
      <div className="relative aspect-[3/4] w-full bg-[var(--th-bg)] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brat.portrait}
          alt={brat.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
        />
        {dimmed && <div className="absolute inset-0 bg-[var(--th-bg)]/60" />}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-[var(--th-text)] font-medium text-base mb-0.5">
          {brat.name}
        </p>
        {brat.section && (
          <p className="text-[var(--th-accent)] text-xs tracking-widest uppercase mb-1">
            {brat.section}
          </p>
        )}
        <p className="text-[var(--th-subtle)] text-sm leading-snug">{brat.tagline}</p>
      </div>
    </div>
  );
}
