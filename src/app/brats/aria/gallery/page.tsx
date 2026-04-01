import Image from "next/image";

export const metadata = {
  title: "Gallery — Aria | brat.gg",
};

// Drop in real image filenames here when available.
// Placeholders reference the gallery subfolder in public/images/aria/gallery/.
// Replace .svg with .jpg when dropping in real images from backup
const galleryImages = [
  { src: "/images/aria/gallery/1.svg", alt: "Aria — gallery 1" },
  { src: "/images/aria/gallery/2.svg", alt: "Aria — gallery 2" },
  { src: "/images/aria/gallery/3.svg", alt: "Aria — gallery 3" },
  { src: "/images/aria/gallery/4.svg", alt: "Aria — gallery 4" },
];

export default function GalleryPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-light text-[#d6e4d2] tracking-tight mb-1">
          Gallery
        </h1>
        <p className="text-[#6b8a6e] text-sm">A collection of moments.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {galleryImages.map((img, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-md overflow-hidden border border-[#2a3a2c] bg-[#161d17]"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
      </div>
    </main>
  );
}
