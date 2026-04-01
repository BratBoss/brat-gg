-- ============================================================
-- brat.gg v1 — initial schema
-- ============================================================

-- Profiles: one row per authenticated user
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  -- Stored encrypted on the client/server but kept server-side only.
  -- Never returned to other users.
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
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  brat_slug   text not null,
  created_at  timestamptz not null default now()
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
-- Storage: avatars bucket
-- Create via Supabase dashboard or supabase-cli:
--   insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false);
-- ============================================================

-- Auto-create profile on new user signup
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
