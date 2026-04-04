import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const authLinkClass =
  "inline-flex items-center leading-none text-xs text-[#4a5e4c] hover:text-[#8aaa8c] transition-colors";

export default async function AuthStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? (
    <form action="/api/auth/signout" method="POST">
      <button
        type="submit"
        className={authLinkClass}
      >
        Sign out
      </button>
    </form>
  ) : (
    <Link
      href="/login"
      className={authLinkClass}
    >
      Sign in
    </Link>
  );
}
