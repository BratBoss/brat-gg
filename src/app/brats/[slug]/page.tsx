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
  if (!brat || !brat.available) return {};

  const sectionLabel = brat.section ?? brat.name;
  const description = brat.slug === "marcy"
    ? `Visit ${brat.name}'s ${sectionLabel.toLowerCase()} — a warmer, lived-in corner of brat.gg for conversation, journal entries, and gallery moments.`
    : `Step into ${brat.name}'s ${sectionLabel.toLowerCase()} — a quiet, personal space for conversation, journal entries, and gallery moments.`;

  return {
    title: `${sectionLabel} — ${brat.name} | brat.gg`,
    description,
    openGraph: {
      title: `${sectionLabel} — ${brat.name} | brat.gg`,
      description,
    },
    twitter: {
      title: `${sectionLabel} — ${brat.name} | brat.gg`,
      description,
    },
  };
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
        <div className="relative w-48 h-64 shrink-0 rounded-md overflow-hidden border border-[var(--th-border)] bg-[var(--th-surface)] sm:mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brat.portrait}
            alt={brat.name}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </div>

        {/* Text */}
        <div className="flex flex-col justify-center gap-3 pt-2">
          <h1 className="text-2xl font-light text-[var(--th-text)] tracking-tight">
            {brat.name}
          </h1>
          <p className="text-[var(--th-accent)] text-xs tracking-widest uppercase">
            {about.tagline}
          </p>
          <p className="text-[var(--th-dim)] text-sm leading-relaxed whitespace-pre-line">
            {about.bio}
          </p>
          <Link
            href={`/brats/${slug}/chat`}
            prefetch={false}
            className="mt-2 self-start px-4 py-2 rounded-md bg-[var(--th-border)] hover:bg-[var(--th-surface-hover)] text-[var(--th-text)] text-sm transition-colors"
          >
            Open chat
          </Link>
        </div>
      </section>

      {/* Recent journal */}
      {recentEntries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs tracking-widest uppercase text-[var(--th-muted)]">
              Recent journal
            </h2>
            <Link
              href={`/brats/${slug}/journal`}
              prefetch={false}
              className="text-xs text-[var(--th-muted)] hover:text-[var(--th-dim)] transition-colors"
            >
              All entries →
            </Link>
          </div>

          <div className="space-y-3">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-[var(--th-border)] bg-[var(--th-surface)] px-5 py-4"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[var(--th-text)] text-sm font-medium">
                    {entry.title}
                  </p>
                  <time className="text-[var(--th-muted)] text-xs ml-4 shrink-0">
                    {formatDate(entry.date)}
                  </time>
                </div>
                <p className="text-[var(--th-subtle)] text-sm leading-relaxed">
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
