# Dungeon Manager

Graph-based scene builder for DnD campaigns. Live at
https://apps.matteob.dev/projects/dungeon-manager

Built with **Vite + React + TypeScript**, deployed as a single Cloudflare Worker with
static assets, a **D1** database (`dungeon-manager`) and an **R2** bucket (`dungeon-manager-prod`).

## Develop

```bash
npm install
echo REGISTRATION_SECRET=dev-invite > .dev.vars   # invite code for registration
npm run dev      # migrate local D1 + vite build + wrangler dev: http://localhost:8787/projects/dungeon-manager/
npm run dev:ui   # vite with HMR, proxies /projects/dungeon-manager/api to wrangler dev on :8787
npm run typecheck
npm run types    # regenerate worker-configuration.d.ts after editing wrangler.jsonc or .dev.vars
```

`wrangler dev` uses local D1/R2 simulations under `.wrangler/state`. `.dev.vars` (gitignored) holds
`REGISTRATION_SECRET`, the invite code `POST api/auth/register` requires.

## Database

Migrations live in `migrations/` and are applied by migration number: `0001_init`, `0002_campaign_graph`
(scene positions and links), `0003_colors` (`scenes.color`, `nodes.color`).

```bash
npm run db:migration -- <name>   # create migrations/NNNN_<name>.sql
npm run db:migrate:local         # apply to the local simulation
```

`npm run deploy` applies pending migrations to the remote database before deploying.

## Test

```bash
npm test         # vite build + vitest run (the Workers pool needs ./dist)
npm run test:watch
```

Two Vitest projects: `unit` (`test/unit/`, plain node) and `worker` (`test/worker/`, running inside
the Workers runtime via `@cloudflare/vitest-plugin`, with migrations applied per test file and
`.dev.vars` loaded from `wrangler.jsonc`).

## Deploy

```bash
wrangler secret put REGISTRATION_SECRET   # once, before the first deploy
npm run deploy                            # vite build + remote migrations + wrangler deploy
```

## Routing

- `apps.matteob.dev` is a Cloudflare Tunnel to the home server (Caddy). A Worker route
  `apps.matteob.dev/projects/dungeon-manager*` (in `wrangler.jsonc`) intercepts only this path
  prefix; every other path on that host still reaches the tunnel.
- Vite builds with `base: /projects/dungeon-manager/` into `dist/projects/dungeon-manager/`, and
  wrangler serves `./dist` as static assets, so asset paths match request paths without rewriting.
- The Worker (`worker/index.ts`) only runs first for `/projects/dungeon-manager/api/*`
  (`assets.run_worker_first`). `GET api/health` pings D1 and R2.
- The `spa-404` Vite plugin emits `404.html` next to `index.html`, which Workers Assets
  (`not_found_handling: "404-page"`) serves for deep links, so the SPA router renders them.
- A campaign is one page: `/campaigns/:id` and `/campaigns/:id/scenes/:sceneId` render the same
  `CampaignWorkspace`. The campaign canvas stays mounted underneath and the scene zooms in as a
  layer on top; scene graphs load lazily (prefetched on hover) and are cached for the page's life.
  `/scenes/:id` only redirects into the workspace.

## Model

A campaign is a directed graph of scenes (links such as "leads to"). Each scene is an undirected
graph of objects: Map (square), Event (circle), Stat Block (hexagon), Character (pill), Music
(octagon) and Custom prefab nodes (diamond). Every scene and node can carry its own colour
(`color`, a hex fill, or null for the type's pastel); a custom hex is not theme-aware, so a colour
picked in light mode is the same hex in dark mode. Nodes stay where the user drops them: the
d3-force simulation only places newly added nodes, everything else is pinned. Adding a node type:
one module in `shared/nodes/`, one entry in `src/nodes/shapes.ts`, and a card + editor folder
registered in `src/nodes/registry.tsx`.

Stat block, character and event editors are made of removable sections (`hiddenSections` on the
node data; hidden sections keep their data). Custom nodes edit their own field list (text, number,
image) and can be saved as, or update, a prefab. Music nodes play an uploaded audio file through
one `<audio>` element per campaign page.

## Assets

`POST api/assets` takes the raw file as the body with its `Content-Type`. Images (`image/png`,
`image/jpeg`, `image/webp`, `image/gif`) are capped at 10 MB, audio (`audio/mpeg`, `audio/ogg`,
`audio/wav`, `audio/x-wav`, `audio/mp4`, `audio/x-m4a`, `audio/aac`, `audio/webm`, `audio/flac`)
at 30 MB; over the cap answers 413, an unlisted type 415. `GET api/assets/:id` is owner-scoped,
immutable-cached with ETag/304, and supports byte ranges (`Accept-Ranges: bytes`, 206 with
`Content-Range`, 416 past the end) so `<audio>` can seek.

## Structure

```
src/        React app: routes/ (pages), workspace/ (one-page campaign: layers, scene cache),
            campaign-graph/ (directed scene graph), scene-editor/ (undirected object graph),
            nodes/ (one folder per node type: shape + card + editor, EditorSection for
            removable sections), map-editor/, audio/ (shared player), physics/ (d3-force
            placement of new nodes), autosave/, components/, styles.css + graph-canvas.css
shared/     Schemas and types imported by both the worker and the app
worker/     Worker fetch handler (API routes, D1/R2 bindings)
migrations/ D1 schema migrations
test/       unit/ (node) and worker/ (Workers runtime) Vitest projects
wrangler.jsonc  Worker name, route, assets, D1/R2 bindings
worker-configuration.d.ts  generated by `wrangler types`
```
