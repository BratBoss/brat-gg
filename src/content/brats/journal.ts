// Brat-aware journal content resolver.
//
// Each companion's journal entries live in src/content/{slug}/journal.json.
// This registry maps slug → entries so dynamic pages stay companion-agnostic.
//
// Add a new entry here once a companion has a journal.json.

import ariaJournal from "@/content/aria/journal.json";
import marcyJournal from "@/content/marcy/journal.json";

export type JournalEntry = {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  body: string;
  status?: string;
};

const JOURNAL_MAP: Record<string, JournalEntry[]> = {
  aria: ariaJournal as JournalEntry[],
  marcy: marcyJournal as JournalEntry[],
};

/**
 * Returns the journal entries for the given brat slug, or null if not registered.
 */
export function getBratJournal(slug: string): JournalEntry[] | null {
  return JOURNAL_MAP[slug] ?? null;
}
