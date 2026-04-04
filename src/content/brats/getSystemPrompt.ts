// Brat-aware system prompt resolver.
//
// The chat route calls getSystemPromptBuilder(brat_slug) to obtain the correct
// prompt builder for the active companion. This keeps the route decoupled from
// any companion-specific import and makes adding a new companion a one-line
// registry entry here (once its prompt file and builder exist).
//
// Unsupported slugs return null — callers must handle that case explicitly
// rather than silently falling back to any default companion.

import { buildAriaSystemPrompt } from "@/content/aria/buildSystemPrompt";
import { buildMarcySystemPrompt } from "@/content/marcy/buildSystemPrompt";

/**
 * Parameters every companion prompt builder must accept.
 * Mirrors the existing Aria builder signature so it can be registered directly.
 */
export type PromptBuilderParams = {
  userName: string | null;
  currentDate: string;
  historySummary?: string | null;
};

export type PromptBuilder = (params: PromptBuilderParams) => string;

/**
 * Registry: maps brat slug → prompt builder.
 * Add a new entry here once a companion has a real system-prompt.md and builder.
 */
const PROMPT_BUILDERS: Record<string, PromptBuilder> = {
  aria: buildAriaSystemPrompt,
  marcy: buildMarcySystemPrompt,
};

/**
 * Returns the prompt builder for the given brat slug, or null if the slug
 * is not registered. Callers must treat null as an error — do not fall back
 * silently to another companion.
 */
export function getSystemPromptBuilder(bratSlug: string): PromptBuilder | null {
  return PROMPT_BUILDERS[bratSlug] ?? null;
}
