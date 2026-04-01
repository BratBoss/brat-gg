-- brat.gg v1 — add history_summary to profiles
--
-- Stores a cumulative, LLM-generated summary of a user's past conversations
-- with a given brat. Updated by /api/chat/summarize when the user starts a
-- new chat. Injected into the system prompt via {{HISTORY_SUMMARY}}.

alter table public.profiles
  add column if not exists history_summary text;
