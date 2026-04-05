import { describe, it, expect, vi, beforeEach } from "vitest";

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/crypto", () => ({
  decryptMessage: vi.fn(),
  encryptMessage: vi.fn((s: string) => `enc:${s}`),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/summarize", () => ({
  shouldRefreshSummary: vi.fn(),
  getMessagesToSummarize: vi.fn(),
  generateSummary: vi.fn(),
}));

import { decryptMessage, encryptMessage } from "@/lib/crypto";
import { shouldRefreshSummary, getMessagesToSummarize, generateSummary } from "@/lib/summarize";
import { recoverHistorySummary, refreshSummaryIfNeeded } from "../history";

const mockDecrypt = vi.mocked(decryptMessage);
const mockEncrypt = vi.mocked(encryptMessage);
const mockShouldRefresh = vi.mocked(shouldRefreshSummary);
const mockGetMessages = vi.mocked(getMessagesToSummarize);
const mockGenerate = vi.mocked(generateSummary);

beforeEach(() => vi.clearAllMocks());

// ── recoverHistorySummary ─────────────────────────────────────────────────────

describe("recoverHistorySummary", () => {
  it("returns null summary and 0 watermark when no summary stored", () => {
    const result = recoverHistorySummary({
      history_summary: null,
      last_summarized_message_count: 15,
    });
    expect(result).toEqual({ historySummary: null, lastSummarizedCount: 15 });
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it("returns decrypted summary and stored watermark on success", () => {
    mockDecrypt.mockReturnValueOnce("the summary");
    const result = recoverHistorySummary({
      history_summary: "enc:...",
      last_summarized_message_count: 42,
    });
    expect(result).toEqual({ historySummary: "the summary", lastSummarizedCount: 42 });
  });

  it("resets watermark to 0 when summary decryption fails", () => {
    mockDecrypt.mockImplementationOnce(() => { throw new Error("bad decrypt"); });
    const result = recoverHistorySummary({
      history_summary: "enc:corrupt",
      last_summarized_message_count: 30,
    });
    // Summary is discarded; watermark must reset so next summarization rebuilds from scratch.
    expect(result).toEqual({ historySummary: null, lastSummarizedCount: 0 });
  });

  it("defaults watermark to 0 when last_summarized_message_count is null", () => {
    const result = recoverHistorySummary({
      history_summary: null,
      last_summarized_message_count: null,
    });
    expect(result.lastSummarizedCount).toBe(0);
  });
});

// ── refreshSummaryIfNeeded ────────────────────────────────────────────────────

function makeSupabase(updateError: unknown = null) {
  const updateChain = { eq: vi.fn().mockResolvedValue({ error: updateError }) };
  const updateFn = vi.fn().mockReturnValue(updateChain);
  return {
    from: vi.fn().mockReturnValue({ update: updateFn }),
    _updateFn: updateFn,
  };
}

const BASE_ARGS = {
  sessionId: "session-1",
  chatMessages: [{ role: "user", content: "hi" }],
  lastSummarizedCount: 0,
  historySummary: null as string | null,
  decryptedApiKey: "key",
  model: "model",
  companionName: "Aria",
};

describe("refreshSummaryIfNeeded", () => {
  it("returns unchanged state when shouldRefreshSummary is false", async () => {
    mockShouldRefresh.mockReturnValue(false);
    const supabase = makeSupabase();
    const result = await refreshSummaryIfNeeded(supabase as never, BASE_ARGS);
    expect(result).toEqual({ historySummary: null, lastSummarizedCount: 0 });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns unchanged state when getMessagesToSummarize returns empty", async () => {
    mockShouldRefresh.mockReturnValue(true);
    mockGetMessages.mockReturnValue([]);
    const supabase = makeSupabase();
    const result = await refreshSummaryIfNeeded(supabase as never, BASE_ARGS);
    expect(result).toEqual({ historySummary: null, lastSummarizedCount: 0 });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("advances watermark and summary when DB write succeeds", async () => {
    mockShouldRefresh.mockReturnValue(true);
    mockGetMessages.mockReturnValue([{ role: "user", content: "hi" }]);
    mockGenerate.mockResolvedValue("new summary");
    mockEncrypt.mockReturnValue("enc:new summary");
    const supabase = makeSupabase(null); // no DB error

    const args = { ...BASE_ARGS, chatMessages: Array(25).fill({ role: "user", content: "x" }) };
    const result = await refreshSummaryIfNeeded(supabase as never, args);

    expect(result.historySummary).toBe("new summary");
    expect(result.lastSummarizedCount).toBe(25); // advanced to chatMessages.length
  });

  it("does NOT advance watermark when DB write fails", async () => {
    mockShouldRefresh.mockReturnValue(true);
    mockGetMessages.mockReturnValue([{ role: "user", content: "hi" }]);
    mockGenerate.mockResolvedValue("new summary");
    mockEncrypt.mockReturnValue("enc:new summary");
    const supabase = makeSupabase({ message: "db error" }); // DB write fails

    const args = { ...BASE_ARGS, chatMessages: Array(25).fill({ role: "user", content: "x" }) };
    const result = await refreshSummaryIfNeeded(supabase as never, args);

    // Watermark must not advance — in-memory state stays in sync with what's in the DB.
    expect(result).toEqual({ historySummary: null, lastSummarizedCount: 0 });
  });

  it("returns unchanged state and does not throw when generateSummary rejects", async () => {
    mockShouldRefresh.mockReturnValue(true);
    mockGetMessages.mockReturnValue([{ role: "user", content: "hi" }]);
    mockGenerate.mockRejectedValue(new Error("OpenRouter down"));
    const supabase = makeSupabase();

    const result = await refreshSummaryIfNeeded(supabase as never, BASE_ARGS);

    // Failed summary must never block the chat request.
    expect(result).toEqual({ historySummary: null, lastSummarizedCount: 0 });
  });
});
