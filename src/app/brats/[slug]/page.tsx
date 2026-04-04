import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBratBySlug } from "@/content/brats";
import { getBratAbout } from "@/content/brats/about";
import { getBratJournal } from "@/content/brats/journal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brat = getBratBySlug(slug);
  if (!brat) return {};
  return { title: `${brat.section ?? brat.name} — ${brat.name} | brat.gg` };
}

export default async function GladePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brat = getBratBySlug(slug);
  if (!brat || !brat.available) notFound();

  const about = getBratAbout(slug);
  if (!about) notFound();

  const journalEntries = getBratJournal(slug) ?? [];
  const recentEntries = journalEntries.slice(0, 2);

  return (
    <main className="max-w-2xl mx-auto px-6 py-14 space-y-14">
      {/* About */}
      <section className="flex flex-col sm:flex-row gap-8 items-start">
        {/* Portrait */}
        <div className="relative w-48 h-64 shrink-0 rounded-md overflow-hidden border border-[#2a3a2c] bg-[#161d17] sm:mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brat.portrait}
            alt={brat.name}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </div>

        {/* Text */}
        <div className="flex flex-col justify-center gap-3 pt-2">
          <h1 className="text-2xl font-light text-[#d6e4d2] tracking-tight">
            {brat.name}
          </h1>
          <p className="text-[#5e7d5a] text-xs tracking-widest uppercase">
            {about.tagline}
          </p>
          <p className="text-[#8aaa8c] text-sm leading-relaxed whitespace-pre-line">
            {about.bio}
          </p>
          <Link
            href={`/brats/${slug}/chat`}
            className="mt-2 self-start px-4 py-2 rounded-md bg-[#2a3a2c] hover:bg-[#3a4e3c] text-[#d6e4d2] text-sm transition-colors"
          >
            Open chat
          </Link>
        </div>
      </section>

      {/* Recent journal */}
      {recentEntries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs tracking-widest uppercase text-[#4a5e4c]">
              Recent journal
            </h2>
            <Link
              href={`/brats/${slug}/journal`}
              className="text-xs text-[#4a5e4c] hover:text-[#8aaa8c] transition-colors"
            >
              All entries →
            </Link>
          </div>

          <div className="space-y-3">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-[#2a3a2c] bg-[#161d17] px-5 py-4"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[#d6e4d2] text-sm font-medium">
                    {entry.title}
                  </p>
                  <time className="text-[#4a5e4c] text-xs ml-4 shrink-0">
                    {formatDate(entry.date)}
                  </time>
                </div>
                <p className="text-[#6b8a6e] text-sm leading-relaxed">
                  {entry.excerpt}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
