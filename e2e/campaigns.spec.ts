import { expect, test } from "./fixtures";

test.beforeEach(async ({ loggedIn }) => void loggedIn);

test("create, rename, trash, restore and permanently delete a campaign", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("campaigns");

  await page.getByRole("button", { name: "New campaign" }).click();
  await page.getByPlaceholder("Campaign name").fill("Curse of Strahd");
  await page.getByPlaceholder("Campaign name").press("Enter");
  const card = page.locator("li.card").filter({ hasText: "Curse of Strahd" });
  await expect(card).toBeVisible();

  // Rename through the inline editor; Enter commits.
  await card.hover();
  await card.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Campaign name").fill("Curse of Strahd II");
  await page.getByLabel("Campaign description").fill("Barovia awaits");
  await page.getByLabel("Campaign description").press("Enter");
  const renamed = page.locator("li.card").filter({ hasText: "Curse of Strahd II" });
  await expect(renamed).toContainText("Barovia awaits");

  // Survives a reload.
  await page.reload();
  await expect(renamed).toContainText("Barovia awaits");

  await renamed.hover();
  await renamed.getByRole("button", { name: "Delete" }).click();
  await expect(renamed).toHaveCount(0);

  await page.getByRole("tab", { name: "Recently deleted" }).click();
  const trashed = page.locator("li.card").filter({ hasText: "Curse of Strahd II" });
  await expect(trashed).toContainText("Deleted");
  await trashed.getByRole("button", { name: "Restore" }).click();
  await expect(trashed).toHaveCount(0);
  await page.getByRole("tab", { name: "Campaigns" }).click();
  await expect(renamed).toBeVisible();

  await renamed.hover();
  await renamed.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("tab", { name: "Recently deleted" }).click();
  await trashed.getByRole("button", { name: "Delete forever" }).click();
  await expect(trashed).toHaveCount(0);
  await expect(page.getByText("Deleted campaigns stay here")).toBeVisible();
});

test("escape cancels editing without saving", async ({ page }) => {
  await page.goto("campaigns");
  await page.getByRole("button", { name: "New campaign" }).click();
  await page.getByPlaceholder("Campaign name").fill("Keep me");
  await page.getByPlaceholder("Campaign name").press("Enter");
  const card = page.locator("li.card").filter({ hasText: "Keep me" });
  await card.hover();
  await card.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Campaign name").fill("Changed");
  await page.getByLabel("Campaign name").press("Escape");
  await expect(card).toBeVisible();
  await page.reload();
  await expect(page.locator("li.card").filter({ hasText: "Keep me" })).toBeVisible();
  await expect(page.locator("li.card").filter({ hasText: "Changed" })).toHaveCount(0);
});

test("another user's campaign is not reachable", async ({ page, browser }) => {
  const other = await browser.newContext();
  const { registerViaApi, createCampaign } = await import("./fixtures");
  await registerViaApi(other.request);
  const theirs = await createCampaign(other.request, "Private");
  await other.close();

  await page.goto(`campaigns/${theirs.id}`);
  await expect(page.locator(".graph-canvas__danger")).toBeVisible();
  const res = await page.request.get(`api/campaigns/${theirs.id}`);
  expect(res.status()).toBe(404);
});
