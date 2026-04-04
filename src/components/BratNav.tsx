"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { NavLink } from "@/lib/brat-nav";

export default function BratNav({
  links,
  bratSlug,
}: {
  links: NavLink[];
  bratSlug: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settingsBrat = searchParams.get("brat") ?? "aria";

  return (
    <nav className="flex items-center gap-1.5 flex-wrap">
      {links.map((link) => {
        const active =
          link.href.startsWith("/settings")
            ? pathname === "/settings" && settingsBrat === bratSlug
            : pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              active
                ? "text-[#d6e4d2] bg-[#161d17] border-[#334534]"
                : "text-[#6b8a6e] border-transparent hover:text-[#d6e4d2] hover:bg-[#161d17] hover:border-[#2a3a2c]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
