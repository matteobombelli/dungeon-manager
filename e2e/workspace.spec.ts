import type { Page } from "@playwright/test";
import { createCampaign, createScene, expect, test, waitForSaved } from "./fixtures";

test.beforeEach(async ({ loggedIn }) => void loggedIn);

const campaignLayer = (page: Page) => page.locator('[data-layer="campaign"]');
const sceneLayer = (page: Page) => page.locator('[data-layer="scene"]');
const groupLayer = (page: Page) => page.locator('[data-layer="group"]');
const card = (layer: ReturnType<typeof sceneLayer>, title: string) =>
  layer.locator(".react-flow__node").filter({ hasText: title });

async function addNode(layer: ReturnType<typeof sceneLayer>, label: string) {
  await layer.getByRole("button", { name: "Add node" }).click();
  await layer.getByRole("menuitem", { name: label }).click();
}

test("add a scene, rename it, and it persists", async ({ page }) => {
  const c = await createCampaign(page.request, "Workspace");
  await page.goto(`campaigns/${c.id}`);
  await campaignLayer(page).getByRole("button", { name: "Add scene" }).click();
  const name = page.getByLabel("Scene name");
  await expect(name).toBeFocused();
  await name.fill("The Tavern");
  await name.press("Enter");
  await expect(card(campaignLayer(page), "The Tavern")).toBeVisible();
  await waitForSaved(page);

  await page.reload();
  await expect(card(campaignLayer(page), "The Tavern")).toBeVisible();
});

test("open a scene, add and edit an event, autosave survives reload", async ({ page }) => {
  const c = await createCampaign(page.request, "Events");
  const s = await createScene(page.request, c.id, "Crossroads");
  await page.goto(`campaigns/${c.id}`);
  await card(campaignLayer(page), "Crossroads").dblclick();
  await expect(page).toHaveURL(new RegExp(`/scenes/${s.id}$`));

  await addNode(sceneLayer(page), "Event");
  await sceneLayer(page).getByLabel("Title").fill("Ambush");
  await sceneLayer(page).getByRole("textbox", { name: "Description" }).fill("Goblins leap from the bushes");
  await expect(card(sceneLayer(page), "Ambush")).toBeVisible();
  await waitForSaved(page);

  // Server copy is what we typed.
  const res = await page.request.get(`api/scenes/${s.id}`);
  const { graph } = await res.json();
  expect(graph.nodes).toHaveLength(1);
  expect(graph.nodes[0].data).toMatchObject({ title: "Ambush", description: "Goblins leap from the bushes" });

  await page.reload();
  await expect(card(sceneLayer(page), "Ambush")).toBeVisible();

  // Escape clears the selection first, then closes the scene layer.
  await card(sceneLayer(page), "Ambush").click();
  await page.locator("body").press("Escape");
  await page.locator("body").press("Escape");
  await expect(page).toHaveURL(new RegExp(`/campaigns/${c.id}$`));
  // The card miniature now shows the node.
  await expect(card(campaignLayer(page), "Crossroads").getByLabel("1 node")).toBeVisible();
});

test("every node type can be added and saved", async ({ page }) => {
  const c = await createCampaign(page.request, "All types");
  const s = await createScene(page.request, c.id, "Zoo");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  const labels = ["Map", "Event", "Stat Block", "Character", "Music", "Custom", "Group"];
  for (const label of labels) {
    await addNode(sceneLayer(page), label);
  }
  await expect(sceneLayer(page).locator(".react-flow__node")).toHaveCount(labels.length);
  await waitForSaved(page);
  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  expect(graph.nodes.map((n: { type: string }) => n.type).sort()).toEqual(
    ["character", "custom", "event", "group", "map", "music", "statblock"]
  );
});

test("undo and redo a node addition", async ({ page }) => {
  const c = await createCampaign(page.request, "History");
  const s = await createScene(page.request, c.id, "Undo");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Character");
  const nodes = sceneLayer(page).locator(".react-flow__node");
  await expect(nodes).toHaveCount(1);
  await waitForSaved(page);
  const undo = page.getByRole("button", { name: "Undo" }).filter({ visible: true });
  const redo = page.getByRole("button", { name: "Redo" }).filter({ visible: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(nodes).toHaveCount(0);
  await redo.click();
  await expect(nodes).toHaveCount(1);
  // Keyboard too, once focus is off any input.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(nodes).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(nodes).toHaveCount(1);
});

test("copy and paste nodes gives fresh ids", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const c = await createCampaign(page.request, "Clipboard");
  const s = await createScene(page.request, c.id, "Copy");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Event");
  await sceneLayer(page).getByLabel("Title").fill("Original");
  await card(sceneLayer(page), "Original").click();
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(card(sceneLayer(page), "Original")).toHaveCount(2);
  await waitForSaved(page);
  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  expect(graph.nodes).toHaveLength(2);
  expect(new Set(graph.nodes.map((n: { id: string }) => n.id)).size).toBe(2);
});

test("delete key removes the selected node", async ({ page }) => {
  const c = await createCampaign(page.request, "Delete");
  const s = await createScene(page.request, c.id, "Del");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Custom");
  const nodes = sceneLayer(page).locator(".react-flow__node");
  await expect(nodes).toHaveCount(1);
  await nodes.first().click();
  await page.keyboard.press("Delete");
  await expect(nodes).toHaveCount(0);
  await waitForSaved(page);
  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  expect(graph.nodes).toHaveLength(0);
});

test("typing Backspace in an editor input does not delete the node", async ({ page }) => {
  const c = await createCampaign(page.request, "Typing");
  const s = await createScene(page.request, c.id, "Type");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Event");
  const title = sceneLayer(page).getByLabel("Title");
  await title.fill("abc");
  await title.press("Backspace");
  await title.press("Delete");
  await expect(title).toHaveValue("ab");
  await expect(sceneLayer(page).locator(".react-flow__node")).toHaveCount(1);
});

test("groups: open, add a child, close, and the child persists inside the group", async ({ page }) => {
  const c = await createCampaign(page.request, "Groups");
  const s = await createScene(page.request, c.id, "Hall");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Group");
  await sceneLayer(page).getByLabel("Name").fill("Guards");
  await card(sceneLayer(page), "Guards").dblclick();
  await expect(page).toHaveURL(/\/groups\//);
  // Groups do not nest.
  await groupLayer(page).getByRole("button", { name: "Add node" }).click();
  await expect(groupLayer(page).getByRole("menuitem", { name: "Group" })).toHaveCount(0);
  await groupLayer(page).getByRole("menuitem", { name: "Stat Block" }).click();
  await expect(groupLayer(page).locator(".react-flow__node")).toHaveCount(1);
  await page.locator("body").press("Escape");
  await page.locator("body").press("Escape");
  await expect(page).toHaveURL(new RegExp(`/scenes/${s.id}$`));
  await expect(card(sceneLayer(page), "Guards").getByLabel("1 node")).toBeVisible();
  await waitForSaved(page);

  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  expect(graph.nodes).toHaveLength(1);
  expect(graph.nodes[0].type).toBe("group");
  expect(graph.nodes[0].data.nodes).toHaveLength(1);
  expect(graph.nodes[0].data.nodes[0].type).toBe("statblock");
});

test("link two scenes by dragging the handle, label it, and it persists", async ({ page }) => {
  const c = await createCampaign(page.request, "Links");
  await createScene(page.request, c.id, "Start", 0, 0);
  await createScene(page.request, c.id, "End", 500, 0);
  await page.goto(`campaigns/${c.id}`);
  const start = card(campaignLayer(page), "Start");
  const end = card(campaignLayer(page), "End");
  await expect(end).toBeVisible();
  await start.hover();
  const handle = start.locator(".node-card__handle");
  const from = await handle.boundingBox();
  const to = await end.boundingBox();
  if (!from || !to) throw new Error("no boxes");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  const edges = campaignLayer(page).locator(".react-flow__edge");
  await expect(edges).toHaveCount(1);
  await waitForSaved(page);

  const { links } = await (await page.request.get(`api/campaigns/${c.id}`)).json();
  expect(links).toHaveLength(1);

  // Scene steps: the open scene offers the next one.
  await start.dblclick();
  await expect(page.getByRole("button", { name: /End/ }).first()).toBeVisible();
});

test("deleting a scene from its panel removes it after confirm", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  const c = await createCampaign(page.request, "Delete scene");
  await createScene(page.request, c.id, "Doomed");
  await page.goto(`campaigns/${c.id}`);
  await card(campaignLayer(page), "Doomed").click();
  await page.getByRole("button", { name: "Delete scene" }).click();
  await expect(card(campaignLayer(page), "Doomed")).toHaveCount(0);
  const { scenes } = await (await page.request.get(`api/campaigns/${c.id}`)).json();
  expect(scenes).toHaveLength(0);
});

test("old /scenes/:id links redirect into the workspace", async ({ page }) => {
  const c = await createCampaign(page.request, "Redirect");
  const s = await createScene(page.request, c.id, "Old link");
  await page.goto(`scenes/${s.id}`);
  await expect(page).toHaveURL(new RegExp(`/campaigns/${c.id}/scenes/${s.id}$`));
});

test("no console errors on a typical session", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    // Deep links are served by 404.html (Workers Assets has no SPA mode for a sub-path), so the
    // document itself legitimately reports a 404.
    if (m.type() === "error" && !(m.text().includes("404") && m.location().url.includes("/campaigns/"))) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await createCampaign(page.request, "Console");
  const s = await createScene(page.request, c.id, "Quiet");
  await page.goto(`campaigns/${c.id}`);
  await card(campaignLayer(page), "Quiet").dblclick();
  for (const label of ["Event", "Stat Block", "Character", "Custom", "Music", "Map"]) await addNode(sceneLayer(page), label);
  await waitForSaved(page);
  await page.locator("body").press("Escape");
  await page.locator("body").press("Escape");
  await expect(page).toHaveURL(new RegExp(`/campaigns/${c.id}$`));
  void s;
  expect(errors).toEqual([]);
});

test("save status returns to clean when an edit is undone before the debounce", async ({ page }) => {
  const c = await createCampaign(page.request, "Settle");
  const s = await createScene(page.request, c.id, "Settle");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Custom");
  // Delete it straight away, before the layout settles and the save fires.
  await sceneLayer(page).locator(".react-flow__node").first().click();
  await page.keyboard.press("Delete");
  await expect(sceneLayer(page).locator(".react-flow__node")).toHaveCount(0);
  await waitForSaved(page);
});

test("campaign undo keeps working after a scene is added", async ({ page }) => {
  const c = await createCampaign(page.request, "Undo campaign");
  // Off the origin: a scene at 0,0 counts as unplaced and is laid out on load, which would make
  // the drag below part of the initial state rather than a step.
  await createScene(page.request, c.id, "Mover", 100, 100);
  await page.goto(`campaigns/${c.id}`);
  const mover = card(campaignLayer(page), "Mover");
  await expect(mover).toBeVisible();
  await waitForSaved(page);
  await page.waitForTimeout(800); // the camera's fit animation
  const before = await mover.boundingBox();
  if (!before) throw new Error("no box");
  // Step 1: move the scene.
  await page.mouse.move(before.x + 20, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 220, before.y + 160, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const moved = await mover.boundingBox();
  expect(Math.abs(moved!.x - before.x)).toBeGreaterThan(100);
  const undo = page.getByRole("button", { name: "Undo" }).filter({ visible: true });
  await expect(undo).toBeEnabled();
  // Step 2: add a scene (created on the server, so undo cannot take it away).
  await campaignLayer(page).getByRole("button", { name: "Add scene" }).click();
  await page.getByLabel("Scene name").press("Escape");
  await expect(campaignLayer(page).locator(".react-flow__node")).toHaveCount(2);
  await page.waitForTimeout(3500); // the new scene's layout settles
  await page.locator(".react-flow__pane").first().click({ position: { x: 5, y: 5 } });
  // The first undo lands on the scene addition (a no-op on screen); the next must undo the move.
  await undo.click();
  await page.waitForTimeout(300);
  await undo.click();
  await expect
    .poll(async () => Math.abs((await mover.boundingBox())!.x - before.x), { timeout: 5000 })
    .toBeLessThan(5);
  await expect(page.getByRole("button", { name: "Redo" }).filter({ visible: true })).toBeEnabled();
});

test("a custom field label cleared to retype does not break saving", async ({ page }) => {
  const c = await createCampaign(page.request, "Labels");
  const s = await createScene(page.request, c.id, "Labels");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Custom");
  const label = sceneLayer(page).getByLabel("Label");
  await label.fill("");
  await waitForSaved(page);
  await expect(page.locator(".save-dot--error")).toHaveCount(0);
  await label.fill("Loot");
  await waitForSaved(page);
  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  expect(graph.nodes[0].data.fields[0].label).toBe("Loot");
  // Leaving it empty puts the last label back.
  await label.fill("");
  await label.blur();
  await expect(label).toHaveValue("Loot");
});

test("number fields can be cleared and retyped", async ({ page }) => {
  const c = await createCampaign(page.request, "Numbers");
  const s = await createScene(page.request, c.id, "Numbers");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Event");
  await sceneLayer(page).getByRole("button", { name: "Add check" }).click();
  const dc = sceneLayer(page).getByLabel("DC");
  await dc.fill("15");
  await dc.press("Backspace");
  await dc.press("Backspace");
  await expect(dc).toHaveValue("");
  await dc.pressSequentially("8");
  await expect(dc).toHaveValue("8");
  await waitForSaved(page);
  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  expect(graph.nodes[0].data.checks[0].dc).toBe(8);
});

test("Backspace inside the map editor does not delete the map node", async ({ page }) => {
  const c = await createCampaign(page.request, "Map");
  const s = await createScene(page.request, c.id, "Map");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Map");
  const nodes = sceneLayer(page).locator(".react-flow__node");
  await nodes.first().dblclick();
  const dialog = page.getByRole("dialog", { name: "Map editor" });
  await expect(dialog).toBeVisible();
  // Paint a stroke so the draft has something to lose, then press Backspace with focus on a button.
  const canvas = dialog.locator("canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 40, { steps: 5 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Paint" }).click();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await expect(dialog).toBeVisible();
  await expect(nodes).toHaveCount(1);
  await dialog.getByRole("button", { name: "Apply" }).click();
});

test("the map editor paints, applies, and the cells persist", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  const c = await createCampaign(page.request, "Paint");
  const s = await createScene(page.request, c.id, "Paint");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Map");
  await sceneLayer(page).locator(".react-flow__node").first().dblclick();
  const dialog = page.getByRole("dialog", { name: "Map editor" });
  const canvas = dialog.locator("canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 5, { steps: 10 });
  await page.mouse.up();
  // Apply writes the draft to the node and closes the editor.
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toHaveCount(0);
  await waitForSaved(page);
  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  expect(graph.nodes[0].data.cells.some((v: number) => v > 0)).toBe(true);
});

test("clearing the map's column count does not crop the map", async ({ page }) => {
  const c = await createCampaign(page.request, "Cols");
  const s = await createScene(page.request, c.id, "Cols");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Map");
  await sceneLayer(page).locator(".react-flow__node").first().dblclick();
  const dialog = page.getByRole("dialog", { name: "Map editor" });
  const cols = dialog.getByLabel("Columns");
  const before = await cols.inputValue();
  await cols.fill("");
  await cols.blur();
  await expect(cols).toHaveValue(before);
});

test("holding Ctrl+V pastes once", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const c = await createCampaign(page.request, "Repeat");
  const s = await createScene(page.request, c.id, "Repeat");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Character");
  const nodes = sceneLayer(page).locator(".react-flow__node");
  await nodes.first().click();
  await page.keyboard.press("ControlOrMeta+c");
  // A held key: one real keydown followed by auto-repeats.
  await page.evaluate(() => {
    const mod = navigator.platform.includes("Mac") ? { metaKey: true } : { ctrlKey: true };
    for (let i = 0; i < 6; i++)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", repeat: i > 0, bubbles: true, ...mod }));
  });
  await expect(nodes).toHaveCount(2);
});

test("changing the map's cell size rescales its pen strokes", async ({ page }) => {
  const c = await createCampaign(page.request, "Rescale");
  const s = await createScene(page.request, c.id, "Rescale");
  await page.goto(`campaigns/${c.id}/scenes/${s.id}`);
  await addNode(sceneLayer(page), "Map");
  await sceneLayer(page).locator(".react-flow__node").first().dblclick();
  const dialog = page.getByRole("dialog", { name: "Map editor" });
  await dialog.getByRole("button", { name: "Pen" }).click();
  const box = (await dialog.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 90, { steps: 6 });
  await page.mouse.up();
  const cell = dialog.getByLabel("Cell px");
  const before = Number(await cell.inputValue());
  await cell.fill(String(before / 2));
  await cell.blur();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await waitForSaved(page);

  const { graph } = await (await page.request.get(`api/scenes/${s.id}`)).json();
  const data = graph.nodes[0].data;
  expect(data.cellSize).toBe(before / 2);
  expect(data.strokes).toHaveLength(1);
  // The first point was drawn at ~(40, 40) map px (zoom 1), so it now sits at ~(20, 20).
  const [x0, y0] = data.strokes[0].points;
  expect(Math.abs(x0 - 20)).toBeLessThan(3);
  expect(Math.abs(y0 - 20)).toBeLessThan(3);
});
