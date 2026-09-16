import { describe, expect, it } from "vitest";
import {
  GRAPH_LIMITS,
  GraphSchema,
  canonicalEdge,
  normaliseEdges,
  type Graph,
  type GraphNode,
} from "../../shared/graph";
import { NODE_TYPES } from "../../shared/nodes/registry";

function node(id: string): GraphNode {
  return { id, type: "character", x: 0, y: 0, color: null, data: NODE_TYPES.character.defaultData() };
}

function graph(nodes: GraphNode[], edges: Graph["edges"] = []): unknown {
  return { nodes, edges };
}

describe("GraphSchema", () => {
  it("accepts a valid graph", () => {
    const result = GraphSchema.safeParse(
      graph([node("a"), node("b")], [{ id: "e1", source: "a", target: "b", label: "leads to" }]),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a six-digit hex node colour", () => {
    const result = GraphSchema.safeParse(graph([{ ...node("a"), color: "#AABBCC" }]));
    expect(result.success).toBe(true);
    expect(result.data?.nodes[0].color).toBe("#AABBCC");
  });

  it("rejects a colour that is not six-digit hex", () => {
    expect(GraphSchema.safeParse(graph([{ ...node("a"), color: "red" }])).success).toBe(false);
    expect(GraphSchema.safeParse(graph([{ ...node("a"), color: "#abc" }])).success).toBe(false);
  });

  it("defaults an omitted node colour to null", () => {
    const result = GraphSchema.safeParse({
      nodes: [{ id: "a", type: "character", x: 0, y: 0, data: NODE_TYPES.character.defaultData() }],
      edges: [],
    });
    expect(result.success).toBe(true);
    expect(result.data?.nodes[0].color).toBeNull();
  });

  it("accepts the node limit but rejects one more", () => {
    const nodes = Array.from({ length: GRAPH_LIMITS.maxNodes }, (_, i) => node(`n${i}`));
    expect(GraphSchema.safeParse(graph(nodes)).success).toBe(true);
    expect(GraphSchema.safeParse(graph([...nodes, node("extra")])).success).toBe(false);
  });

  it("rejects duplicate node ids", () => {
    const result = GraphSchema.safeParse(graph([node("a"), node("a")]));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Duplicate node id")).toBe(true);
  });

  it("rejects duplicate edge ids", () => {
    const edges = [
      { id: "e1", source: "a", target: "b", label: "" },
      { id: "e1", source: "b", target: "c", label: "" },
    ];
    const result = GraphSchema.safeParse(graph([node("a"), node("b"), node("c")], edges));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Duplicate edge id")).toBe(true);
  });

  it("canonicalises edges so source comes before target", () => {
    const result = GraphSchema.safeParse(
      graph([node("a"), node("b")], [{ id: "e1", source: "b", target: "a", label: "beside" }]),
    );
    expect(result.success).toBe(true);
    expect(result.data?.edges).toEqual([{ id: "e1", source: "a", target: "b", label: "beside" }]);
  });

  it("rejects a self-loop", () => {
    const result = GraphSchema.safeParse(graph([node("a")], [{ id: "e1", source: "a", target: "a", label: "" }]));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Self-loop")).toBe(true);
  });

  it("rejects the same pair in reverse", () => {
    const edges = [
      { id: "e1", source: "a", target: "b", label: "" },
      { id: "e2", source: "b", target: "a", label: "" },
    ];
    const result = GraphSchema.safeParse(graph([node("a"), node("b")], edges));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Duplicate edge")).toBe(true);
  });

  it("rejects an edge pointing at a missing node", () => {
    const result = GraphSchema.safeParse(
      graph([node("a")], [{ id: "e1", source: "a", target: "ghost", label: "" }]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === "Unknown target node")).toBe(true);
  });

  it("rejects node data that does not match its type", () => {
    const result = GraphSchema.safeParse(graph([{ id: "a", type: "statblock", x: 0, y: 0, color: null, data: { name: "Goblin" } }]));
    expect(result.success).toBe(false);
  });

  it("rejects a label over the limit", () => {
    const label = "x".repeat(GRAPH_LIMITS.maxLabel + 1);
    const result = GraphSchema.safeParse(graph([node("a"), node("b")], [{ id: "e1", source: "a", target: "b", label }]));
    expect(result.success).toBe(false);
  });
});

describe("canonicalEdge", () => {
  it("swaps the endpoints only when target sorts first", () => {
    expect(canonicalEdge({ id: "e1", source: "b", target: "a", label: "x" })).toEqual({
      id: "e1",
      source: "a",
      target: "b",
      label: "x",
    });
    const already = { id: "e1", source: "a", target: "b", label: "x" };
    expect(canonicalEdge(already)).toBe(already);
  });
});

describe("normaliseEdges", () => {
  it("canonicalises, drops self-loops and keeps the first of a duplicate pair", () => {
    const edges = [
      { id: "e1", source: "b", target: "a", label: "kept" },
      { id: "e2", source: "a", target: "b", label: "dropped" },
      { id: "e3", source: "c", target: "c", label: "loop" },
      { id: "e4", source: "b", target: "c", label: "also kept" },
    ];
    expect(normaliseEdges(edges)).toEqual([
      { id: "e1", source: "a", target: "b", label: "kept" },
      { id: "e4", source: "b", target: "c", label: "also kept" },
    ]);
  });

  it("leaves an already normalised list alone", () => {
    const edges = [{ id: "e1", source: "a", target: "b", label: "" }];
    expect(normaliseEdges(edges)).toEqual(edges);
  });
});
