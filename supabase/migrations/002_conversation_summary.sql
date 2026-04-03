-- ============================================================
-- brat.gg v2 — conversation summary / memory
-- ============================================================
--
-- Adds three columns to chat_sessions to support per-session
-- conversation summarization:
--
--   history_summary                — AES-256-GCM encrypted summary
--                                    of older messages (enc: prefix,
--                                    same scheme as messages.content)
--   summary_updated_at             — when the summary was last written
--   last_summarized_message_count  — total message count at the time the
--                                    summary was last generated; used as
--                                    the trigger watermark

alter table public.chat_sessions
  add column if not exists history_summary                text,
  add column if not exists summary_updated_at             timestamptz,
  add column if not exists last_summarized_message_count  integer not null default 0;
