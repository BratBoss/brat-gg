import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBratBySlug } from "@/content/brats";
import BratNav from "@/components/BratNav";

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

  const navLinks = [
    { label: brat.section ?? brat.name, href: `/brats/${slug}` },
    { label: "Journal", href: `/brats/${slug}/journal` },
    { label: "Gallery", href: `/brats/${slug}/gallery` },
    { label: "Chat", href: `/brats/${slug}/chat` },
    { label: "Settings", href: "/settings" },
  ];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top nav */}
      <header className="border-b border-[#2a3a2c] px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
        {/* Brand */}
        <div className="flex items-center text-sm">
          <Link
            href="/"
            className="text-[#4a5e4c] hover:text-[#8aaa8c] transition-colors"
          >
            brat.gg
          </Link>
        </div>

        {/* Section nav */}
        <BratNav links={navLinks} />

        {/* Auth state */}
        <div className="flex items-center gap-3 text-sm ml-auto">
          {user ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="text-[#6b8a6e] hover:text-[#d6e4d2] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SignOutButton() {
  return (
    <form action="/api/auth/signout" method="POST">
      <button
        type="submit"
        className="text-xs text-[#4a5e4c] hover:text-[#8aaa8c] transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
