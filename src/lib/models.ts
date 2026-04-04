// Shared source of truth for allowed chat models.
// Imported by both the settings UI (client) and the settings API route (server).
export const MODELS = [
  { value: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast (default)" },
  { value: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
] as const;

export type ModelValue = (typeof MODELS)[number]["value"];

export const ALLOWED_MODELS: string[] = MODELS.map((m) => m.value);
