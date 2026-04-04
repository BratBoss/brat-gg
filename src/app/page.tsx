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
          <span className="text-[#8aaa8c] text-sm tracking-widest uppercase">
            brat.gg
          </span>
        }
        center={
          <div className="flex items-center gap-5 flex-wrap opacity-0 pointer-events-none select-none" aria-hidden="true">
            <span className="relative px-0 py-1.5 text-sm text-[#d6e4d2] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-[#5e7d5a]">
              Glade
            </span>
            <span className="relative px-0 py-1.5 text-sm text-[#6b8a6e]">Journal</span>
            <span className="relative px-0 py-1.5 text-sm text-[#6b8a6e]">Gallery</span>
            <span className="relative px-0 py-1.5 text-sm text-[#6b8a6e]">Chat</span>
            <span className="relative px-0 py-1.5 text-sm text-[#6b8a6e]">Settings</span>
          </div>
        }
        right={<AuthStatus />}
      />

      {/* Hero */}
      <section className="px-8 pt-16 pb-12 max-w-3xl">
        <h1 className="text-3xl font-light text-[#d6e4d2] mb-3 tracking-tight">
          A quiet home for digital companions.
        </h1>
        <p className="text-[#8aaa8c] text-base leading-relaxed">
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
                className="group relative overflow-hidden rounded-lg border border-[#2a3a2c] bg-[#161d17] hover:border-[#5e7d5a] transition-colors duration-300"
              >
                <BratCard brat={brat} />
              </Link>
            ) : (
              <div
                key={brat.slug}
                className="relative overflow-hidden rounded-lg border border-[#2a3a2c] bg-[#161d17] opacity-50 cursor-not-allowed"
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
      <div className="relative aspect-[3/4] w-full bg-[#0f1410] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brat.portrait}
          alt={brat.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
        />
        {dimmed && <div className="absolute inset-0 bg-[#0f1410]/60" />}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-[#d6e4d2] font-medium text-base mb-0.5">
          {brat.name}
        </p>
        {brat.section && (
          <p className="text-[#5e7d5a] text-xs tracking-widest uppercase mb-1">
            {brat.section}
          </p>
        )}
        <p className="text-[#6b8a6e] text-sm leading-snug">{brat.tagline}</p>
      </div>
    </div>
  );
}
