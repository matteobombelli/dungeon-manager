import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relativeTime } from "../../src/components/relativeTime";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const ago = (seconds: number) => NOW - seconds * 1000;

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("says just now under a minute", () => {
    expect(relativeTime(ago(30))).toBe("just now");
  });

  it("never rounds up into the next unit's size", () => {
    expect(relativeTime(ago(59 * 60 + 40))).toMatch(/59 minutes ago/);
    expect(relativeTime(ago(23.6 * 3600))).toMatch(/23 hours ago/);
    expect(relativeTime(ago(6.6 * 86400))).toMatch(/6 days ago/);
  });

  it("switches unit at the boundary", () => {
    expect(relativeTime(ago(3600))).toMatch(/1 hour ago/);
    expect(relativeTime(ago(86400))).toMatch(/yesterday|1 day ago/);
  });
});
