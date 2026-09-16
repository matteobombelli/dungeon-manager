import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_GRAPH_LIMITS,
  CampaignGraphSchema,
  type ScenePosition,
} from "../../shared/campaign-graph";

function scene(id: string, color: unknown = null): unknown {
  return { id, x: 0, y: 0, color };
}

function graph(scenes: unknown[], links: unknown[] = []): unknown {
  return { scenes, links };
}

describe("CampaignGraphSchema", () => {
  it("accepts a valid graph", () => {
    const result = CampaignGraphSchema.safeParse(
      graph([scene("a"), scene("b")], [{ id: "l1", source: "a", target: "b", label: "leads to" }]),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a six-digit hex colour", () => {
    const result = CampaignGraphSchema.safeParse(graph([scene("a", "#aabbcc")]));
    expect(result.success).toBe(true);
    expect(result.data?.scenes[0].color).toBe("#aabbcc");
  });

  it("rejects a colour that is not six-digit hex", () => {
    expect(CampaignGraphSchema.safeParse(graph([scene("a", "red")])).success).toBe(false);
    expect(CampaignGraphSchema.safeParse(graph([scene("a", "#abc")])).success).toBe(false);
  });

  it("defaults an omitted colour to null", () => {
    const result = CampaignGraphSchema.safeParse(graph([{ id: "a", x: 1, y: 2 }]));
    expect(result.success).toBe(true);
    expect(result.data?.scenes[0]).toEqual({ id: "a", x: 1, y: 2, color: null } satisfies ScenePosition);
  });

  it("accepts the scene limit but rejects one more", () => {
    const scenes = Array.from({ length: CAMPAIGN_GRAPH_LIMITS.maxScenes }, (_, i) => scene(`s${i}`));
    expect(CampaignGraphSchema.safeParse(graph(scenes)).success).toBe(true);
    expect(CampaignGraphSchema.safeParse(graph([...scenes, scene("extra")])).success).toBe(false);
  });

  it("rejects duplicate scene ids", () => {
    const result = CampaignGraphSchema.safeParse(graph([scene("a"), scene("a")]));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Duplicate scene id")).toBe(true);
  });

  it("rejects a self-link", () => {
    const result = CampaignGraphSchema.safeParse(
      graph([scene("a")], [{ id: "l1", source: "a", target: "a", label: "" }]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Self-link")).toBe(true);
  });

  it("keeps both directions of a pair but rejects the same directed pair twice", () => {
    const both = graph(
      [scene("a"), scene("b")],
      [
        { id: "l1", source: "a", target: "b", label: "there" },
        { id: "l2", source: "b", target: "a", label: "back" },
      ],
    );
    expect(CampaignGraphSchema.safeParse(both).success).toBe(true);

    const twice = graph(
      [scene("a"), scene("b")],
      [
        { id: "l1", source: "a", target: "b", label: "" },
        { id: "l2", source: "a", target: "b", label: "again" },
      ],
    );
    const result = CampaignGraphSchema.safeParse(twice);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Duplicate link")).toBe(true);
  });

  it("rejects a link pointing at a missing scene", () => {
    const result = CampaignGraphSchema.safeParse(
      graph([scene("a")], [{ id: "l1", source: "a", target: "ghost", label: "" }]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Unknown target scene")).toBe(true);
  });
});
