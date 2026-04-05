import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const authLinkClass =
  "inline-flex items-center leading-none text-xs text-[var(--th-muted)] hover:text-[var(--th-dim)] transition-colors";

export default async function AuthStatus({
  loginHref = "/login",
}: {
  loginHref?: string;
}) {
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
      href={loginHref}
      prefetch={false}
      className={authLinkClass}
    >
      Sign in
    </Link>
  );
}
