# Wave 2 rollout — live DB steps

Run these statements in the Supabase SQL editor in order.
Each section must succeed before moving to the next.

---

## 1. Duplicate-session detection (read-only, always run first)

```sql
SELECT
  user_id,
  brat_slug,
  count(*) AS session_count
FROM public.chat_sessions
GROUP BY user_id, brat_slug
HAVING count(*) > 1;
```

**If this returns zero rows:** no duplicates exist. Skip section 2 entirely
and go straight to section 3.

**If this returns any rows:** continue to section 2 before touching anything.

---

## 2. Pre-cleanup inspection (only needed if section 1 found duplicates)

> **Warning:** the cleanup in this section deletes `chat_sessions` rows.
> Because `messages` has `ON DELETE CASCADE`, every message in every deleted
> session is also permanently destroyed. There is no undo.
>
> Run the inspection query below first and read its output carefully before
> deciding to proceed.

### 2a. Inspect what would be kept vs deleted, and how many messages each session holds

```sql
SELECT
  cs.id,
  cs.user_id,
  cs.brat_slug,
  cs.created_at,
  count(m.id)                                                   AS message_count,
  CASE WHEN cs.id = keeper.id THEN 'KEEP' ELSE 'DELETE' END     AS action
FROM public.chat_sessions cs
LEFT JOIN public.messages m
  ON m.session_id = cs.id
JOIN (
  SELECT DISTINCT ON (user_id, brat_slug) id, user_id, brat_slug
  FROM public.chat_sessions
  ORDER BY user_id, brat_slug, created_at DESC
) keeper
  ON keeper.user_id = cs.user_id AND keeper.brat_slug = cs.brat_slug
GROUP BY cs.id, cs.user_id, cs.brat_slug, cs.created_at, keeper.id
ORDER BY cs.user_id, cs.brat_slug, cs.created_at DESC;
```

Read the `action = 'DELETE'` rows. If any of them have `message_count > 0`,
those messages will be lost. Decide whether that is acceptable before running
section 2b.

### 2b. Cleanup — run inside a transaction so you can roll back if the result looks wrong

```sql
BEGIN;

DELETE FROM public.chat_sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, brat_slug) id
  FROM public.chat_sessions
  ORDER BY user_id, brat_slug, created_at DESC
);

-- Sanity check: remaining row count should equal the number of distinct
-- (user_id, brat_slug) pairs you intended to keep.
SELECT count(*) FROM public.chat_sessions;

-- If the count looks correct:
COMMIT;

-- If anything looks wrong:
-- ROLLBACK;
```

---

## 3. Add the unique constraint

No data is modified here. The statement will fail if duplicates still exist
(which is the correct behavior — it means section 2 was skipped or incomplete).

```sql
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_user_brat_unique UNIQUE (user_id, brat_slug);
```

---

## 4. Add the message history index

`CONCURRENTLY` means Postgres builds the index without holding a table lock,
so this is safe to run against a live database with active traffic.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_session_created_idx
  ON public.messages (session_id, created_at ASC);
```

Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.
Run it as a standalone statement, not wrapped in `BEGIN/COMMIT`.
