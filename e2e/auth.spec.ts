import { INVITE_CODE } from "../playwright.config";
import { PASSWORD, expect, registerViaApi, test, uniqueEmail } from "./fixtures";

test("redirects to login when signed out, and back to the deep link after login", async ({ page, browser }) => {
  // Make an account in a separate context so this page starts signed out.
  const ctx = await browser.newContext();
  const email = await registerViaApi(ctx.request);
  await ctx.close();

  await page.goto("campaigns");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByRole("tab", { name: "Campaigns" })).toBeVisible();
});

test("register through the form, log out, log back in", async ({ page }) => {
  const email = uniqueEmail("form");
  await page.goto("register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/campaigns$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  // The session is really gone: a reload stays on the login page.
  await page.goto("campaigns");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
});

test("wrong password and wrong invite code show errors", async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const email = await registerViaApi(ctx.request);
  await ctx.close();

  await page.goto("login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();

  await page.goto("register");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Invite code").fill("nope");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText("Invalid invite code")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText("Email already registered")).toBeVisible();
});

test("deep links render the SPA (404.html fallback)", async ({ page, loggedIn }) => {
  void loggedIn;
  const res = await page.goto("campaigns/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.locator(".graph-canvas__danger")).toBeVisible();
});
