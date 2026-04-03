# brat.gg

A small, personal website for AI companions. Each companion ("brat") has their own space: a profile page, journal, gallery, and one-on-one chat. brat.gg is a **bring-your-own-key (BYOK)** product — users supply their own OpenRouter API keys. The site does not use any shared or site-managed provider key; each request is made with the individual user's own key, stored encrypted at rest.

V1 ships one companion: Aria.

---

## V1 product scope

**In scope:**
- Magic-link auth (passwordless, email only)
- Per-user chat with Aria, with full conversation history
- Streaming responses via OpenRouter (user-supplied API key)
- User settings: display name, avatar, API key, model selection
- Private avatar storage (Supabase Storage, signed URLs)
- Aria's journal and gallery pages (static content)

**Out of scope / deferred:**
- Conversation summarization / long-term memory
- Multiple active chat sessions per user
- OAuth providers (GitHub, Google, etc.)
- Additional companions (Marcy, Sylvie — placeholder assets exist)

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

**Next.js 16 note:** This version has breaking changes. `middleware.ts` is now `proxy.ts` with a `proxy` export (not `middleware`). Several `experimental` config keys have moved to top-level. Read `node_modules/next/dist/docs/` before touching framework config.

---

## Local development

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- An OpenRouter account (for testing chat; each user provides their own key)

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

### Build check

```bash
npm run build
```

The build runs TypeScript type-checking. A separate runtime-startup check in `src/instrumentation.ts` validates `ENCRYPTION_SECRET` before the first request is served — this is distinct from the build step (see BYOK section).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (labelled **Publishable key** in the Supabase dashboard) |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL, e.g. `http://localhost:3000` or `https://brat.gg`. Used as the auth redirect origin. |
| `ENCRYPTION_SECRET` | Yes | 64 hex characters (32 bytes). Encrypts user API keys at rest. Generate: `openssl rand -hex 32`. **Server-only. Never expose.** |

`ENCRYPTION_SECRET` has no fallback. A missing or malformed value causes the server to abort at runtime startup — `src/instrumentation.ts` validates it before the first request is served. The build itself does not fail on this; the failure happens when the server process initialises.

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

## BYOK model and key security

brat.gg does not use any shared or site-managed OpenRouter key. Every user provides their own key, which is stored encrypted at rest and used only for that user's requests. This is a product constraint, not a cost-saving measure — do not add a site-managed fallback key.

### How keys are stored

- User submits their key via `POST /api/settings`.
- The server encrypts it with AES-256-GCM (`src/lib/crypto.ts`) before writing to `profiles.openrouter_api_key`.
- The encrypted blob is stored as `iv:authTag:ciphertext` (all hex).
- The plaintext key is never logged or returned to the client.

### Key existence vs. key value

Pages that only need to know *whether* a key exists use a HEAD-only count query instead of selecting the encrypted blob. This prevents the encrypted value from being serialized into server component output unnecessarily.

```typescript
// Correct — no key blob in response
supabase.from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("id", user.id)
  .not("openrouter_api_key", "is", null)
```

### Error taxonomy

| Condition | Error type | HTTP status |
|---|---|---|
| User has no key saved | Expected state | 422 — user can fix in Settings |
| Key blob is malformed | Data error | 422 — user should re-enter key |
| `ENCRYPTION_SECRET` missing/wrong | `ConfigError` | 500 — deployment issue |

`ConfigError` is a named class (`src/lib/crypto.ts`). API routes check `err instanceof ConfigError` to distinguish the 500 case from the 422 case.

---

## Chat flow

```
Browser (ChatClient)
  → POST /api/chat { sessionId, message }
      → auth check (Supabase)
      → verify session belongs to user
      → load encrypted API key from profiles
      → decrypt key (AES-256-GCM)
      → build system prompt (reads system-prompt.md, injects user name + date)
      → persist user message to messages table
      → load conversation history
      → POST to OpenRouter (stream: true)
      → pipe SSE stream back to browser
      → after stream ends: persist assistant message to messages table
  ← SSE stream (text/event-stream)
Browser
  → parses SSE chunks (data: {...})
  → accumulates content into streaming state
  → on [DONE]: commits assistant message to local state
```

**System prompt source of truth:** `src/content/aria/system-prompt.md`. Edit that file to change Aria's behavior. `src/content/aria/buildSystemPrompt.ts` reads it at module load, strips the documentation header (everything before the first `---`), and injects template variables. Do not duplicate the prompt text in `buildSystemPrompt.ts`.

**Template variables in `system-prompt.md`:**
- `{{USER_NAME}}` — user's display name, or "someone who hasn't shared their name yet"
- `{{CURRENT_DATE}}` — formatted date, injected at request time
- `{{HISTORY_SUMMARY}}` — reserved for future memory feature; currently removed cleanly when absent

---

## Project structure

```
src/
├── proxy.ts                        # Session cookie refresh (Next.js middleware)
├── instrumentation.ts              # Startup: validates ENCRYPTION_SECRET
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
│   ├── crypto.ts                   # AES-256-GCM encrypt/decrypt + ConfigError
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       └── server.ts               # Server Supabase client (SSR, cookies)
│
└── content/aria/
    ├── system-prompt.md            # Aria's character and behavior (canonical)
    ├── buildSystemPrompt.ts        # Reads system-prompt.md, injects variables
    ├── about.ts                    # Aria's tagline and bio
    └── journal.json                # Journal entries

supabase/
└── migrations/
    └── 001_initial_schema.sql      # Full schema: tables, RLS, storage, trigger
```

---

## Important invariants

These rules exist for security or architectural reasons. Do not change them without understanding the consequence.

**1. No site-managed API keys.**
brat.gg is BYOK by design. The server never calls OpenRouter with a site credential. Do not add a fallback key, a free-tier key, or any server-side provider credential.

**2. No ENCRYPTION_SECRET fallback.**
`src/lib/crypto.ts` throws `ConfigError` if `ENCRYPTION_SECRET` is absent or not exactly 64 hex characters. There is no dev/test fallback. This is intentional: silent crypto degradation is worse than a startup failure.

**3. Never return the encrypted key blob to the client.**
The `openrouter_api_key` column must not appear in any query that is serialized into a server component or API response. Use the HEAD-only count pattern when you only need to know if a key exists.

**4. `profiles.avatar_url` stores a storage path, not a URL.**
The avatars bucket is private. Server components generate signed URLs (`createSignedUrl`) with a short TTL for display. Do not store public URLs, do not make the bucket public.

**5. `system-prompt.md` is the single source of truth for Aria's prompt.**
`buildSystemPrompt.ts` reads the file; it does not contain a copy. Do not paste the prompt back into the `.ts` file. The file is bundled into the Vercel lambda via `outputFileTracingIncludes` in `next.config.ts` — do not remove that config entry.

**6. RLS is the primary data isolation boundary.**
Row Level Security is enabled on `profiles`, `chat_sessions`, and `messages`. The API routes also verify ownership explicitly (belt-and-suspenders), but RLS is the authoritative gate. Do not disable RLS to work around a query issue.

**7. `src/proxy.ts` must call `supabase.auth.getUser()`.**
This is required by `@supabase/ssr` to keep session cookies fresh. Removing or skipping this call breaks SSR auth. The comment in the file is there for a reason.

---

## Deployment (Vercel)

1. Connect the repo to a Vercel project.
2. Set all four environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (production domain, e.g. `https://brat.gg`)
   - `ENCRYPTION_SECRET` (generate a fresh value for production)
3. Deploy. If `ENCRYPTION_SECRET` is missing or malformed, the server will abort at runtime startup (not at build time) — this is the intended behavior.

**`outputFileTracingIncludes`:** `next.config.ts` includes `src/content/aria/system-prompt.md` in the `/api/chat` serverless bundle. Without this, the file is absent from the Vercel lambda and the chat route throws at runtime. This key is at the top level of the Next.js config object (not under `experimental` — that location was removed in Next.js 16).

---

## Known bugs

### BUG-004: Chat messages intermittently hang while sending

**Summary:**
Chat message sending sometimes becomes stuck mid-request, leaving the interface in a loading/disabled state until the page is refreshed.

**Current behavior:**
On the live chat page, sending a message sometimes works normally, but other times the message send appears to hang. The send button remains spinning, the chat input stays greyed out/disabled, and no response arrives. Refreshing the page temporarily restores functionality, but the issue can recur after one or several successful messages.

**Expected behavior:**
Each message send should either complete successfully with a streamed assistant response or fail gracefully with a visible error state. The chat UI should never remain indefinitely stuck in a loading/disabled state.

**Impact:**
This affects core chat reliability and makes the product feel unstable. It can interrupt conversations, force page refreshes, and reduce trust in the chat experience.

**Root cause (primary):**
Unknown / under investigation

**Files affected:**
Unknown / under investigation

**Status:**
Not assigned

---

## Deferred / future work (Listed top to bottom most important to least)

| Feature | Notes |
|---|---|
| Long-context handling | No message trimming. Long conversations will hit model context limits. |
| Multiple chat sessions per user | Currently one session per user per brat (latest wins). No UI for session history. |
| Additional companions | Placeholder assets for Marcy and Sylvie exist in `public/images/brats/`. No routes, content, or sessions. |
| OAuth login | Only magic link in V1. Supabase supports OAuth providers with minimal changes when needed. |
| Conversation summarization / memory | `{{HISTORY_SUMMARY}}` variable is wired in the prompt template but not populated. Intentionally deferred — no design for the summarization trigger or storage yet. |
| CORS | Security improvement |