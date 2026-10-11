import { API_PREFIX } from "../shared/api";
import { sweepAssets } from "./asset-sweep";
import { json } from "./http";
import { registerAssetRoutes } from "./routes/assets";
import { registerAuthRoutes } from "./routes/auth";
import { registerCampaignRoutes } from "./routes/campaigns";
import { registerSceneRoutes } from "./routes/scenes";
import { Router } from "./router";

const router = new Router();

router.get("/health", async (c) => {
  const [d1, r2] = await Promise.all([
    c.env.DB.prepare("SELECT 1").first().then(() => true, () => false),
    c.env.BUCKET.list({ limit: 1 }).then(() => true, () => false),
  ]);
  return json({ ok: d1 && r2, d1, r2 });
});

registerAuthRoutes(router);
registerCampaignRoutes(router);
registerSceneRoutes(router);
registerAssetRoutes(router);

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith(API_PREFIX)) {
      return env.ASSETS.fetch(request);
    }
    return router.handle(request, env, ctx);
  },

  // Daily (wrangler.jsonc triggers): deletes uploads no scene has referenced for the grace period.
  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(
      sweepAssets(env, controller.scheduledTime).then(({ deleted }) => {
        if (deleted > 0) console.log(`asset sweep: deleted ${deleted}`);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
