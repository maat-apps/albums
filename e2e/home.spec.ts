import { expect, test } from "@playwright/test";

import { goHome } from "./utils";

test("an empty collection points to the CSV import", async ({ page }) => {
  await goHome(page);
  await expect(
    page.getByRole("heading", { name: "No albums yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import from CSV" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});
