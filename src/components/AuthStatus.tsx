import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AuthStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? (
    <form action="/api/auth/signout" method="POST">
      <button
        type="submit"
        className="text-sm text-[#6b8a6e] hover:text-[#d6e4d2] transition-colors"
      >
        Sign out
      </button>
    </form>
  ) : (
    <Link
      href="/login"
      className="text-sm text-[#6b8a6e] hover:text-[#d6e4d2] transition-colors"
    >
      Sign in
    </Link>
  );
}
