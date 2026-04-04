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
    <nav className="flex items-center gap-5 flex-wrap">
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
            className={`relative px-0 py-1.5 text-sm transition-colors after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:transition-colors ${
              active
                ? "text-[#d6e4d2] after:bg-[#5e7d5a]"
                : "text-[#6b8a6e] hover:text-[#d6e4d2] after:bg-transparent hover:after:bg-[#334534]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
