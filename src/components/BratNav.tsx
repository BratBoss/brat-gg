"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { label: string; href: string };

export default function BratNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 flex-wrap">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              active
                ? "text-[#d6e4d2] bg-[#161d17]"
                : "text-[#6b8a6e] hover:text-[#d6e4d2] hover:bg-[#161d17]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
