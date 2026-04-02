import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Gallery — Aria | brat.gg",
};

const galleryImages = [
  { src: "/images/aria/gallery/1.JPG", alt: "Aria — gallery 1" },
  { src: "/images/aria/gallery/2.JPG", alt: "Aria — gallery 2" },
  { src: "/images/aria/gallery/3.JPG", alt: "Aria — gallery 3" },
  { src: "/images/aria/gallery/4.JPG", alt: "Aria — gallery 4" },
];

export default function GalleryPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-light text-[#d6e4d2] tracking-tight mb-1">
          Gallery
        </h1>
        <p className="text-[#6b8a6e] text-sm">A collection of moments.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {galleryImages.map((img, i) => (
          <Link
            key={i}
            href={img.src}
            target="_blank"
            rel="noreferrer"
            className="group block rounded-lg overflow-hidden border border-[#2a3a2c] bg-[#161d17] hover:border-[#5e7d5a] transition-colors"
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={1638}
              height={2048}
              className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.01]"
              unoptimized
            />
          </Link>
        ))}
      </div>
    </main>
  );
}
