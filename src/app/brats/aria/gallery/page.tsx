import Image from "next/image";

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
            className="rounded-md overflow-hidden border border-[#2a3a2c] bg-[#161d17]"
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={1638}
              height={2048}
              className="w-full h-auto block"
              unoptimized
            />
          </div>
        ))}
      </div>
    </main>
  );
}
