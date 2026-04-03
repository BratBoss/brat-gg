# brat.gg

A small, personal website for AI companions. Each companion ("brat") has their own space: a profile page, journal, gallery, and one-on-one chat. brat.gg is a **bring-your-own-key (BYOK)** product — users supply their own OpenRouter API keys. The site does not use any shared or site-managed provider key; each request is made with the individual user's own key, stored encrypted at rest.

V1 ships one companion: Aria.

---

## V1 product scope

**In scope:**
- Magic-link auth (passwordless, email only)
- Per-user chat with Aria, with conversation history stored encrypted at rest
- Streaming responses via OpenRouter (user-supplied API key)
- User settings: display name, avatar, API key, model selection
- Private avatar storage (Supabase Storage, signed URLs)
- Aria's journal and gallery pages (static content)

**Out of scope / deferred:**
- Multiple active chat sessions per user
- Additional companions (Marcy, Sylvie)
- OAuth providers (GitHub, Google, etc.)
- CORS

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Auth + DB + Storage | Supabase | `@supabase/ssr` 0.10 |
| AI provider | OpenRouter (via user key) | — |
| Hosting | Vercel | — |
| Language | TypeScript | 6.0.2 |

**Next.js 16 note:** This version has breaking changes. `middleware.ts` is now `proxy.ts` with a `proxy` export (not `middleware`). Several `experimental` config keys have moved to top-level. If you need to change framework config, check the local Next.js docs in `node_modules/next/dist/docs/` first.

---

## Local development

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- An OpenRouter account (for testing chat)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env.local

# 3. Run the Supabase migration (paste into Supabase SQL editor, or use CLI)
# supabase/migrations/001_initial_schema.sql

# 4. Start dev server
npm run dev
```

Open `http://localhost:3000`.

**Local auth note:** Magic-link testing only works when Supabase Auth site/redirect URLs match the environment you are using. If `NEXT_PUBLIC_APP_URL` points at localhost but Supabase is configured only for production, the email link may return to the production site instead of local dev.

### Build check

```bash
npm run build
```

The build runs TypeScript type-checking. A separate runtime-startup check in `src/instrumentation.ts` validates `MESSAGE_ENCRYPTION_KEY` and `ENCRYPTION_SECRET` — this is distinct from the build step.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (labelled **Publishable key** in the Supabase dashboard) |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL, e.g. `http://localhost:3000` or `https://brat.gg`. Used as the auth redirect origin. |
| `ENCRYPTION_SECRET` | Yes | 64 hex characters (32 bytes). Encrypts user API keys at rest. Generate: `openssl rand -hex 32`. **Server-only. Never expose.** |
| `MESSAGE_ENCRYPTION_KEY` | Yes | 64 hex characters (32 bytes). Encrypts user message history at rest. Generate: `openssl rand -hex 32`. **Server-only. Never expose.** |

`ENCRYPTION_SECRET` and `MESSAGE_ENCRYPTION_KEY` have no fallback. A missing or malformed value causes the server to abort at runtime startup — `src/instrumentation.ts` validates it before the first request is served. The build itself does not fail on this; the failure happens when the server process initialises.

---

## Supabase setup

1. Create a new Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor. This creates:
   - `profiles` table (user settings, encrypted API key, avatar path)
   - `chat_sessions` table
   - `messages` table
   - Row Level Security policies on all three tables
   - Private `avatars` storage bucket with per-user RLS
   - Trigger to auto-create a profile row on new signup
3. In Supabase Auth settings: enable **Email** provider, enable **magic links**.
4. Set the site URL and redirect URL to match `NEXT_PUBLIC_APP_URL`.

**Avatar bucket:** must be `public: false`. Access is via signed URLs generated server-side (1-hour TTL). Never grant public read access to this bucket.

---

## Auth flow

1. User submits email on `/login`.
2. Supabase sends a magic link to that email.
3. User clicks the link → lands on `/auth/callback` → Supabase exchanges the token for a session cookie.
4. `src/proxy.ts` (Next.js middleware) refreshes the session cookie on every request.
5. Protected pages (`/brats/aria/*`) call `supabase.auth.getUser()` server-side and redirect to `/login` if no session.

There are no passwords and no OAuth providers in V1.

---

### How keys are stored

- User submits their key via `POST /api/settings`.
- The server encrypts it with AES-256-GCM (`src/lib/crypto.ts`) before writing to `profiles.openrouter_api_key`.
- The encrypted blob is stored as `iv:authTag:ciphertext` (all hex).
- The plaintext key is never logged or returned to the client.

### How message history is stored

- User and assistant message content is encrypted at rest with `MESSAGE_ENCRYPTION_KEY` before being written to `messages.content`.
- Message history is decrypted server-side when loading chat history for the UI and when building the context sent to OpenRouter.
- Existing legacy plaintext rows remain readable for compatibility; new writes are encrypted. No automatic backfill is performed in this pass.

### Key existence vs. key value

Pages that only need to know *whether* a key exists use a HEAD-only count query instead of selecting the encrypted blob. This prevents the encrypted value from being serialized into server component output unnecessarily.

```typescript
// Correct — no key blob in response
supabase.from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("id", user.id)
  .not("openrouter_api_key", "is", null)
```

---

## Chat flow

```
Browser (ChatClient)
  → POST /api/chat { sessionId, message }
      → auth check (Supabase)
      → verify session belongs to user
      → load encrypted API key from profiles
      → decrypt key (AES-256-GCM)
      → resolve prompt builder by brat_slug (400 if unsupported companion)
      → persist user message to messages table (encrypted at rest)
      → load conversation history and decrypt server-side
      → refresh conversation summary if threshold reached (blocking, before model call)
      → build system prompt via resolved builder (reads companion's system-prompt.md, injects user name + date + summary)
      → build context window: all unsummarized messages (from watermark to end) when summary exists, else trim to 50
      → POST to OpenRouter (stream: true)
      → pipe SSE stream back to browser
      → after stream ends: persist assistant message to messages table (encrypted at rest)
  ← SSE stream (text/event-stream)
Browser
  → parses SSE chunks (data: {...})
  → accumulates content into streaming state
  → on [DONE]: commits assistant message to local state
```

**System prompt source of truth:** Each companion's `system-prompt.md` lives under `src/content/{slug}/`. Edit that file to change the companion's behavior. `buildSystemPrompt.ts` in the same directory reads it at module load, strips the documentation header (everything before the first `---`), and injects template variables. Do not duplicate the prompt text in `buildSystemPrompt.ts`.

**Prompt resolution:** `src/content/brats/getSystemPrompt.ts` maps brat slugs to their builder functions. The chat route resolves the builder from `chat_sessions.brat_slug`. Adding a new companion requires a prompt file, a builder, and one registry entry in that file.

**Template variables in `system-prompt.md`:**
- `{{USER_NAME}}` — user's display name, or "someone who hasn't shared their name yet"
- `{{CURRENT_DATE}}` — formatted date, injected at request time
- `{{HISTORY_SUMMARY}}` — per-session encrypted summary of older messages; injected when present, removed cleanly when absent

---

## Project structure (high level)

```
src/
├── proxy.ts                        # Session cookie refresh (Next.js middleware)
├── instrumentation.ts              # Startup: validates ENCRYPTION_SECRET and MESSAGE_ENCRYPTION_KEY
│
├── app/
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Home (/)
│   ├── login/page.tsx              # Magic link login
│   ├── auth/callback/route.ts      # Supabase auth callback
│   │
│   ├── brats/aria/
│   │   ├── page.tsx                # Aria profile overview
│   │   ├── layout.tsx              # Aria section layout
│   │   ├── chat/page.tsx           # Chat page (server component, loads session)
│   │   ├── settings/page.tsx       # Settings page (server component)
│   │   ├── journal/page.tsx        # Journal (static content)
│   │   └── gallery/page.tsx        # Gallery (static content)
│   │
│   └── api/
│       ├── chat/route.ts           # POST /api/chat — decrypt key, stream from OpenRouter
│       ├── settings/route.ts       # POST /api/settings — encrypt + save key, update profile
│       └── auth/signout/route.ts   # POST /api/auth/signout
│
├── components/
│   ├── chat/ChatClient.tsx         # Full chat UI (streaming, input, new chat)
│   └── aria/SettingsClient.tsx     # Settings form (avatar upload, key entry)
│
├── lib/
│   ├── crypto.ts                   # AES-256-GCM helpers for API keys and message history
│   ├── summarize.ts                # Conversation summarization helpers (trigger, slice, OpenRouter call)
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       └── server.ts               # Server Supabase client (SSR, cookies)
│
├── content/
│   ├── brats/
│   │   ├── index.ts                # Canonical companion metadata (slug, name, portrait…)
│   │   └── getSystemPrompt.ts      # Prompt builder registry — maps slug → builder function
│   └── aria/
│       ├── system-prompt.md        # Aria's character and behavior (canonical)
│       ├── buildSystemPrompt.ts    # Reads system-prompt.md, injects variables
│       ├── about.ts                # Aria's tagline and bio
│       └── journal.json            # Journal entries

supabase/
└── migrations/
    ├── 001_initial_schema.sql      # Full schema: tables, RLS, storage, trigger
    └── 002_conversation_summary.sql  # Adds summary columns to chat_sessions
```

---

## Important invariants

These rules exist for security or architectural reasons. Do not change them without understanding the consequence.

**1. No site-managed API keys.**
brat.gg is BYOK by design. The server never calls OpenRouter with a site credential. Do not add a fallback key, a free-tier key, or any server-side provider credential.

**2. No ENCRYPTION_SECRET fallback.**
`src/lib/crypto.ts` throws `ConfigError` if `ENCRYPTION_SECRET` is absent or not exactly 64 hex characters. There is no dev/test fallback. This is intentional: silent crypto degradation is worse than a startup failure.

**3. No MESSAGE_ENCRYPTION_KEY fallback.**
`src/lib/crypto.ts` throws `ConfigError` if `MESSAGE_ENCRYPTION_KEY` is absent or not exactly 64 hex characters. There is no dev/test fallback. This is intentional for the same reason: silent degradation is worse than a startup failure.

**4. Never return the encrypted key blob to the client.**
The `openrouter_api_key` column must not appear in any query that is serialized into a server component or API response. Use the HEAD-only count pattern when you only need to know if a key exists.

**5. `profiles.avatar_url` stores a storage path, not a URL.**
The avatars bucket is private. Server components generate signed URLs (`createSignedUrl`) with a short TTL for display. Do not store public URLs, do not make the bucket public.

**6. Each companion's `system-prompt.md` is the single source of truth for that companion's prompt.**
The companion's `buildSystemPrompt.ts` reads the file; it does not contain a copy. Do not paste prompt text back into the `.ts` file. All companion prompt files are bundled into the Vercel lambda via the `./src/content/*/system-prompt.md` glob in `outputFileTracingIncludes` (`next.config.ts`) — do not remove that config entry.

**7. RLS is the primary data isolation boundary.**
Row Level Security is enabled on `profiles`, `chat_sessions`, and `messages`. The API routes also verify ownership explicitly (belt-and-suspenders), but RLS is the authoritative gate. Do not disable RLS to work around a query issue.

**8. `src/proxy.ts` must call `supabase.auth.getUser()`.**
This is required by `@supabase/ssr` to keep session cookies fresh. Removing or skipping this call breaks SSR auth. The comment in the file is there for a reason.

---

## Deployment (Vercel)

1. Connect the repo to a Vercel project.
2. Set all five environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (production domain, e.g. `https://brat.gg`)
   - `ENCRYPTION_SECRET` (generate a fresh value for production)
   - `MESSAGE_ENCRYPTION_KEY` (generate a fresh value for production)
3. Deploy. If `ENCRYPTION_SECRET` or `MESSAGE_ENCRYPTION_KEY` is missing or malformed, the server will abort at runtime startup (not at build time) — this is the intended behavior.

Use different generated values for `ENCRYPTION_SECRET` and `MESSAGE_ENCRYPTION_KEY`; do not reuse the same secret for both.

**`outputFileTracingIncludes`:** `next.config.ts` includes all `src/content/*/system-prompt.md` files in the `/api/chat` serverless bundle via a glob. Without this, the files are absent from the Vercel lambda and the chat route throws at runtime. This key is at the top level of the Next.js config object (not under `experimental` — that location was removed in Next.js 16).

---

## Deferred / future work (Listed top to bottom most important to least)

| Feature | Notes |
|---|---|
| Multiple chat sessions per user | Currently one session per user per brat (latest wins). No UI for session history. |
| Additional companions | Placeholder assets for Marcy and Sylvie exist in `public/images/brats/`. No routes, content, or sessions. |
| OAuth login | Only magic link in V1. Supabase supports OAuth providers with minimal changes when needed. |
| CORS | Security improvement |
