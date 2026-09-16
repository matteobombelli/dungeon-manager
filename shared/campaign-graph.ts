import { z } from "zod";
import { NodeColorSchema } from "./color";

export const CAMPAIGN_GRAPH_LIMITS = { maxScenes: 500, maxLinks: 1000, maxLabel: 200 } as const;

export const ScenePositionSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  color: NodeColorSchema.default(null),
});
export type ScenePosition = z.infer<typeof ScenePositionSchema>;

export const SceneLinkSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().max(CAMPAIGN_GRAPH_LIMITS.maxLabel),
});

// Links are directed: A -> B and B -> A are distinct, only the same ordered pair twice is a duplicate.
export const CampaignGraphSchema = z
  .object({
    scenes: z.array(ScenePositionSchema).max(CAMPAIGN_GRAPH_LIMITS.maxScenes),
    links: z.array(SceneLinkSchema).max(CAMPAIGN_GRAPH_LIMITS.maxLinks),
  })
  .superRefine((graph, ctx) => {
    const sceneIds = new Set<string>();
    graph.scenes.forEach((scene, i) => {
      if (sceneIds.has(scene.id)) {
        ctx.addIssue({ code: "custom", path: ["scenes", i, "id"], message: "Duplicate scene id" });
      }
      sceneIds.add(scene.id);
    });
    const linkIds = new Set<string>();
    const pairs = new Set<string>();
    graph.links.forEach((link, i) => {
      if (linkIds.has(link.id)) {
        ctx.addIssue({ code: "custom", path: ["links", i, "id"], message: "Duplicate link id" });
      }
      linkIds.add(link.id);
      if (!sceneIds.has(link.source)) {
        ctx.addIssue({ code: "custom", path: ["links", i, "source"], message: "Unknown source scene" });
      }
      if (!sceneIds.has(link.target)) {
        ctx.addIssue({ code: "custom", path: ["links", i, "target"], message: "Unknown target scene" });
      }
      if (link.source === link.target) {
        ctx.addIssue({ code: "custom", path: ["links", i], message: "Self-link" });
      }
      const pair = JSON.stringify([link.source, link.target]);
      if (pairs.has(pair)) {
        ctx.addIssue({ code: "custom", path: ["links", i], message: "Duplicate link" });
      }
      pairs.add(pair);
    });
  });
export type CampaignGraph = z.infer<typeof CampaignGraphSchema>;
