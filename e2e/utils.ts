// Reusable Playwright test helpers — plain functions specs call directly,
// not test.extend() fixtures (hence "utils.ts", not "fixtures.ts" — see
// maat-core/STRUCTURE.md's Testing section for why that naming matters).
import type { Page } from "@playwright/test";

export async function goHome(page: Page) {
  await page.goto("");
}
