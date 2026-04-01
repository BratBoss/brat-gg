// Edit system-prompt.md to change Aria's character/behavior.
// This file handles injection only — keep logic here minimal.
//
// Template variables in system-prompt.md:
//   {{USER_NAME}}        — the user's display name
//   {{HISTORY_SUMMARY}}  — reserved for future memory implementation
//   {{CURRENT_DATE}}     — today's date, formatted for readability

import fs from "fs";
import path from "path";

const rawMd = fs.readFileSync(
  path.join(process.cwd(), "src/content/aria/system-prompt.md"),
  "utf-8"
);

// Strip the documentation header (everything up to and including the first ---).
const SEP = "\n---\n";
const firstSep = rawMd.indexOf(SEP);
const TEMPLATE = firstSep !== -1 ? rawMd.slice(firstSep + SEP.length).trimStart() : rawMd;

export function buildAriaSystemPrompt({
  userName,
  currentDate,
  historySummary = null,
}: {
  userName: string | null;
  currentDate: string;
  historySummary?: string | null;
}): string {
  const displayedName = userName?.trim() || "someone who hasn't shared their name yet";

  if (historySummary?.trim()) {
    // Inject the summary with a natural lead-in that fits the surrounding text.
    const historyBlock = `You've spoken with them before. Here's what you remember:\n\n${historySummary.trim()}`;
    return TEMPLATE
      .replace("{{USER_NAME}}", displayedName)
      .replace("{{CURRENT_DATE}}", currentDate)
      .replace("{{HISTORY_SUMMARY}}", historyBlock);
  }

  // No prior history — remove the placeholder cleanly so the surrounding
  // "If there's no prior history..." text still reads naturally.
  return TEMPLATE
    .replace("{{USER_NAME}}", displayedName)
    .replace("{{CURRENT_DATE}}", currentDate)
    .replace("{{HISTORY_SUMMARY}}\n\n", "");
}
