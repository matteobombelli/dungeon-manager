const API_PREFIX = "/projects/dungeon-manager/api";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function health(env: Env): Promise<Response> {
  const [d1, r2] = await Promise.all([
    env.DB.prepare("SELECT 1").first().then(() => true, () => false),
    env.BUCKET.list({ limit: 1 }).then(() => true, () => false),
  ]);
  return json({ ok: d1 && r2, d1, r2 });
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith(API_PREFIX)) {
      return env.ASSETS.fetch(request);
    }
    const route = pathname.slice(API_PREFIX.length);
    if (route === "/health" && request.method === "GET") {
      return health(env);
    }
    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
