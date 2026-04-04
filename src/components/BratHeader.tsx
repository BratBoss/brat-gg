import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { BratMeta } from "@/content/brats";
import BratNav from "@/components/BratNav";
import { buildBratNavLinks } from "@/lib/brat-nav";

export default async function BratHeader({ brat }: { brat: BratMeta }) {
  const navLinks = buildBratNavLinks(brat.slug, brat.section ?? brat.name);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-[#2a3a2c] px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
      <div className="flex items-center text-sm">
        <Link
          href="/"
          className="text-[#bfcbb7] text-sm tracking-widest uppercase hover:text-[#d6e4d2] transition-colors"
        >
          brat.gg
        </Link>
      </div>

      <BratNav links={navLinks} bratSlug={brat.slug} />

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
