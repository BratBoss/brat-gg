import Link from "next/link";
import type { BratMeta } from "@/content/brats";
import AuthStatus from "@/components/AuthStatus";
import BratNav from "@/components/BratNav";
import HeaderShell from "@/components/HeaderShell";
import { buildBratNavLinks } from "@/lib/brat-nav";

export default async function BratHeader({ brat }: { brat: BratMeta }) {
  const navLinks = buildBratNavLinks(brat.slug, brat.section ?? brat.name);

  return (
    <HeaderShell
      left={
        <Link
          href="/"
          className="text-[#8aaa8c] text-sm tracking-widest uppercase hover:text-[#d6e4d2] transition-colors"
        >
          brat.gg
        </Link>
      }
      center={<BratNav links={navLinks} bratSlug={brat.slug} />}
      right={<AuthStatus />}
    />
  );
}
