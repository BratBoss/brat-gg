import { describe, it, expect } from "vitest";
import { buildContextMessages } from "../context";

type Msg = { role: string; content: string };

const user = (content: string): Msg => ({ role: "user", content });
const asst = (content: string): Msg => ({ role: "assistant", content });

// ── buildContextMessages ──────────────────────────────────────────────────────

describe("buildContextMessages — no summary (trimHistory path)", () => {
  it("returns all messages when under the context limit", () => {
    const msgs = [user("hi"), asst("hello")];
    expect(buildContextMessages(msgs, null, 0)).toEqual(msgs);
  });

  it("trims to the most-recent 50 messages when over the limit", () => {
    const msgs: Msg[] = Array.from({ length: 60 }, (_, i) =>
      i % 2 === 0 ? user(`u${i}`) : asst(`a${i}`)
    );
    const result = buildContextMessages(msgs, null, 0);
    expect(result).toHaveLength(50);
    expect(result[0]).toEqual(msgs[10]);
  });

  it("drops a leading orphaned assistant message after trim", () => {
    // Construct 51 messages where position [0] after trim would be an assistant turn.
    const msgs: Msg[] = [
      asst("orphan"), // will land at index 0 after slicing to 50
      ...Array.from({ length: 50 }, (_, i) =>
        i % 2 === 0 ? user(`u${i}`) : asst(`a${i}`)
      ),
    ];
    // msgs.length = 51 → trim slices to last 50 → starts with asst("orphan")
    const result = buildContextMessages(msgs, null, 0);
    expect(result[0].role).toBe("user");
  });

  it("keeps leading user message untouched", () => {
    const msgs = [user("first"), asst("reply"), user("second")];
    const result = buildContextMessages(msgs, null, 0);
    expect(result[0]).toEqual(user("first"));
  });
});

describe("buildContextMessages — with summary (watermark path)", () => {
  it("slices from (lastSummarizedCount - LIVE_WINDOW) when summary exists", () => {
    // 40 messages total, lastSummarizedCount=30 → watermark = max(0, 30-20) = 10
    const msgs: Msg[] = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0 ? user(`u${i}`) : asst(`a${i}`)
    );
    const result = buildContextMessages(msgs, "some summary", 30);
    expect(result).toHaveLength(30); // msgs.slice(10) = 30 items
    expect(result[0]).toEqual(msgs[10]);
  });

  it("clamps watermark to 0 when lastSummarizedCount <= LIVE_WINDOW", () => {
    const msgs: Msg[] = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? user(`u${i}`) : asst(`a${i}`)
    );
    const result = buildContextMessages(msgs, "some summary", 5);
    expect(result).toHaveLength(10);
  });

  it("drops a leading orphaned assistant message on the watermark path", () => {
    // watermark=1 → sliced starts with asst turn
    const msgs: Msg[] = [
      user("u0"),
      asst("a1"),  // watermark lands here → orphaned assistant at [0]
      user("u2"),
      asst("a3"),
    ];
    // lastSummarizedCount=21 → watermark = max(0, 21-20) = 1 → slice from index 1
    const result = buildContextMessages(msgs, "summary", 21);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("u2");
  });
});
