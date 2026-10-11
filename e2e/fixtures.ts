import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { INVITE_CODE } from "../playwright.config";

export const API = "api";

let counter = 0;
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${counter++}@example.test`;
}

export const PASSWORD = "correct-horse-battery";

/** Registers through the API; the cookie lands in the request context (and the page, which shares it). */
export async function registerViaApi(request: APIRequestContext, email = uniqueEmail()): Promise<string> {
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, inviteCode: INVITE_CODE },
  });
  expect(res.status(), await res.text()).toBe(201);
  return email;
}

export async function createCampaign(request: APIRequestContext, name: string): Promise<{ id: string }> {
  const res = await request.post(`${API}/campaigns`, { data: { name, description: "" } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).campaign;
}

export async function createScene(
  request: APIRequestContext,
  campaignId: string,
  name: string,
  x = 0,
  y = 0
): Promise<{ id: string }> {
  const res = await request.post(`${API}/campaigns/${campaignId}/scenes`, { data: { name, x, y } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).scene;
}

/** Waits until every save dot in the toolbar reads "Saved" or "Up to date". */
export async function waitForSaved(page: Page) {
  await expect(page.getByRole("status").filter({ visible: true }).first()).toHaveAttribute(
    "aria-label",
    /Saved|Up to date/,
    { timeout: 10_000 }
  );
}

export const test = base.extend<{ loggedIn: { email: string } }>({
  loggedIn: async ({ page }, use) => {
    const email = await registerViaApi(page.request);
    await use({ email });
  },
});

export { expect };
