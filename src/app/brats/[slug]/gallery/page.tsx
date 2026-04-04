import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBratBySlug } from "@/content/brats";
import { getBratGallery } from "@/content/brats/gallery";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brat = getBratBySlug(slug);
  if (!brat || !brat.available) return {};
  return { title: `Gallery — ${brat.name} | brat.gg` };
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brat = getBratBySlug(slug);

  if (!brat || !brat.available) notFound();

  const images = getBratGallery(slug);
  if (!images) notFound();

  return (
    <main className="max-w-5xl mx-auto px-6 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-light text-[var(--th-text)] tracking-tight mb-1">
          Gallery
        </h1>
        <p className="text-[var(--th-subtle)] text-sm">A collection of moments.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {images.map((img, i) => (
          <a
            key={i}
            href={img.src}
            target="_blank"
            rel="noreferrer"
            className="group block rounded-lg overflow-hidden border border-[var(--th-border)] bg-[var(--th-surface)] hover:border-[var(--th-accent)] transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.01]"
            />
          </a>
        ))}
      </div>
    </main>
  );
}
