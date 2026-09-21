import { describe, expect, it } from "vitest";
import { GRAPH_LIMITS, GraphSchema, type GraphNode } from "../../shared/graph";
import { NODE_TYPES } from "../../shared/nodes/registry";

function node(id: string): GraphNode {
  return { id, type: "character", x: 0, y: 0, color: null, data: NODE_TYPES.character.defaultData() };
}

function graph(nodes: GraphNode[]): unknown {
  return { nodes };
}

describe("GraphSchema", () => {
  it("accepts a valid graph", () => {
    const result = GraphSchema.safeParse(graph([node("a"), node("b")]));
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

  it("rejects node data that does not match its type", () => {
    const result = GraphSchema.safeParse(graph([{ id: "a", type: "statblock", x: 0, y: 0, color: null, data: { name: "Goblin" } }]));
    expect(result.success).toBe(false);
  });

  it("round-trips a group node with children", () => {
    const data = {
      name: "Ambush",
      nodes: [
        { id: "c1", type: "character", x: 10, y: 20, color: null, data: NODE_TYPES.character.defaultData() },
        { id: "c2", type: "event", x: 0, y: 0, color: "#AABBCC", data: NODE_TYPES.event.defaultData() },
      ],
    };
    const result = GraphSchema.safeParse(graph([{ ...node("g"), type: "group", data }]));
    expect(result.success).toBe(true);
    expect(result.data?.nodes[0].data).toEqual(data);
  });

  it("rejects a group nested inside a group node", () => {
    const data = {
      name: "Outer",
      nodes: [{ id: "g2", type: "group", x: 0, y: 0, color: null, data: NODE_TYPES.group.defaultData() }],
    };
    const result = GraphSchema.safeParse(graph([{ ...node("g"), type: "group", data }]));
    expect(result.success).toBe(false);
  });

  it("ignores an edges key left over from v1.2", () => {
    const result = GraphSchema.safeParse({ nodes: [node("a")], edges: [{ id: "e", source: "a", target: "a" }] });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("edges");
  });
});
