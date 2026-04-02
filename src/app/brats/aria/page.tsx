import Image from "next/image";
import Link from "next/link";
import { ariaAbout } from "@/content/aria/about";
import journalEntries from "@/content/aria/journal.json";

export const metadata = {
  title: "Glade — Aria | brat.gg",
};

export default function GladePage() {
  const recentEntries = journalEntries.slice(0, 2);

  return (
    <main className="max-w-2xl mx-auto px-6 py-14 space-y-14">
      {/* About */}
      <section className="flex flex-col sm:flex-row gap-8 items-start">
        {/* Portrait */}
        <div className="relative w-48 h-64 shrink-0 rounded-md overflow-hidden border border-[#2a3a2c] bg-[#161d17]">
          <Image
            src="/images/aria/portrait.jpg"
            alt="Aria"
            fill
            className="object-cover object-top"
            unoptimized
          />
        </div>

        {/* Text */}
        <div className="flex flex-col justify-center gap-3 pt-2">
          <h1 className="text-2xl font-light text-[#d6e4d2] tracking-tight">
            Aria
          </h1>
          <p className="text-[#5e7d5a] text-xs tracking-widest uppercase">
            {ariaAbout.tagline}
          </p>
          <p className="text-[#8aaa8c] text-sm leading-relaxed whitespace-pre-line">
            {ariaAbout.bio}
          </p>
          <Link
            href="/brats/aria/chat"
            className="mt-2 self-start px-4 py-2 rounded-md bg-[#2a3a2c] hover:bg-[#3a4e3c] text-[#d6e4d2] text-sm transition-colors"
          >
            Open chat
          </Link>
        </div>
      </section>

      {/* Recent journal */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs tracking-widest uppercase text-[#4a5e4c]">
            Recent journal
          </h2>
          <Link
            href="/brats/aria/journal"
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
