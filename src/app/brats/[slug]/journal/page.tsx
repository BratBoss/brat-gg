import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBratBySlug } from "@/content/brats";
import { getBratJournal } from "@/content/brats/journal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brat = getBratBySlug(slug);
  if (!brat) return {};
  return { title: `Journal — ${brat.name} | brat.gg` };
}

export default async function JournalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brat = getBratBySlug(slug);

  if (!brat || !brat.available) notFound();

  const journalEntries = getBratJournal(slug);
  if (!journalEntries) notFound();

  return (
    <main className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-light text-[#d6e4d2] tracking-tight mb-1">
          Journal
        </h1>
        <p className="text-[#6b8a6e] text-sm">
          {brat.name}&apos;s thoughts, written down.
        </p>
      </div>

      <div className="space-y-8">
        {journalEntries.map((entry) => (
          <article
            key={entry.id}
            className="border-b border-[#2a3a2c] pb-8 last:border-0"
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[#d6e4d2] text-base font-medium">
                {entry.title}
              </h2>
              <time className="text-[#4a5e4c] text-xs ml-4 shrink-0">
                {formatDate(entry.date)}
              </time>
            </div>
            <div className="text-[#8aaa8c] text-sm leading-relaxed whitespace-pre-line">
              {entry.body}
            </div>
            {entry.status && (
              <p className="mt-4 text-[#8aaa8c] text-sm leading-relaxed">
                <span className="text-[#6b8a6e] font-medium">Status:</span>{" "}
                {entry.status}
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
