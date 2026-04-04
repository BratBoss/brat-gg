-- ============================================================
-- brat.gg v1 — initial schema
-- ============================================================

-- Profiles: one row per authenticated user
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  -- Storage path only (e.g. "userId/avatar.jpg").
  -- Display via signed URLs — never a public URL.
  avatar_url    text,
  -- AES-256-GCM encrypted by the Next.js server before writing.
  -- The plaintext key is never stored or logged.
  openrouter_api_key  text,
  openrouter_model    text not null default 'x-ai/grok-4.1-fast',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);


-- Chat sessions: one active session per user per brat
create table if not exists public.chat_sessions (
  id                             uuid primary key default gen_random_uuid(),
  user_id                        uuid not null references auth.users(id) on delete cascade,
  brat_slug                      text not null,
  history_summary                text,
  summary_updated_at             timestamptz,
  last_summarized_message_count  integer not null default 0,
  created_at                     timestamptz not null default now(),
  -- Enforces the one-session-per-user-per-brat invariant at the DB level.
  -- The upsert in getOrCreateSession relies on this constraint.
  constraint chat_sessions_user_brat_unique unique (user_id, brat_slug)
);

alter table public.chat_sessions enable row level security;

create policy "Users can manage their own chat sessions"
  on public.chat_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Messages: belong to a chat session
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Covers the hot query: messages for a session ordered by time.
-- Used by both chat page load and the API route's history window.
create index if not exists messages_session_created_idx
  on public.messages (session_id, created_at asc);

alter table public.messages enable row level security;

-- Users can only access messages in sessions they own
create policy "Users can manage their own messages"
  on public.messages for all
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );


-- ============================================================
-- Storage: avatars bucket (private)
--
-- Run this SQL in the Supabase SQL editor to create the bucket
-- and its RLS policies. The bucket must be private (public=false).
-- Files are stored at path: {userId}/avatar.{ext}
-- Access is via short-lived signed URLs generated server-side.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Authenticated users may upload/overwrite only their own avatar
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- SELECT is required so the authenticated session can create signed URLs
create policy "Users can read their own avatar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- Auto-create profile on new user signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
