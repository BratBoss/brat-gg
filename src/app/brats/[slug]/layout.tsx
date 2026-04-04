import { notFound } from "next/navigation";
import { getBratBySlug } from "@/content/brats";
import BratHeader from "@/components/BratHeader";

export default async function BratLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brat = getBratBySlug(slug);

  if (!brat || !brat.available) {
    notFound();
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <BratHeader brat={brat} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
