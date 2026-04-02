import Link from "next/link";
import Image from "next/image";

const brats = [
  {
    slug: "aria",
    name: "Aria",
    tagline: "A quiet presence in the glade.",
    section: "Glade",
    available: true,
    portrait: "/images/aria/portrait.jpg",
  },
  {
    slug: "marcy",
    name: "Marcy",
    tagline: "Coming soon.",
    section: null,
    available: false,
    portrait: "/images/brats/marcy.png",
  },
  {
    slug: "sylvie",
    name: "Sylvie",
    tagline: "Coming soon.",
    section: null,
    available: false,
    portrait: "/images/brats/sylvie.png",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#2a3a2c]">
        <span className="text-[#8aaa8c] text-sm tracking-widest uppercase">
          brat.gg
        </span>
      </header>

      {/* Hero */}
      <section className="px-8 pt-16 pb-12 max-w-2xl">
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
                <BratCard brat={brat} comingSoon />
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
  comingSoon = false,
}: {
  brat: (typeof brats)[number];
  comingSoon?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* Portrait area */}
      <div className="relative aspect-[3/4] w-full bg-[#0f1410] overflow-hidden">
        <Image
          src={brat.portrait}
          alt={brat.name}
          fill
          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
          unoptimized
        />
        {comingSoon && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1410]/60">
            <span className="text-[#4a5e4c] text-xs tracking-widest uppercase">
              Coming soon
            </span>
          </div>
        )}
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
