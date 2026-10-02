import { expect, type Page, test } from "@playwright/test";

import { goHome, importCsv, waitForStoredPrefs } from "./utils";

function titles(page: Page) {
  return page
    .getByRole("region", { name: "Collection" })
    .getByRole("button")
    .allInnerTexts();
}

test("filters by status with counts", async ({ page }) => {
  await goHome(page);
  await importCsv(page);

  await page.getByRole("button", { name: /^Coming back/ }).click();

  await expect(
    page.getByRole("button", { name: /^Coming back\s*1$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await titles(page)).join(" ")).toContain("Alpha");
  expect((await titles(page)).join(" ")).not.toContain("Middle");
});

test("sorts by year both ways, and the choice survives a reload", async ({
  page,
}) => {
  await goHome(page);
  await importCsv(page);

  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Year" }).click();
  await expect.poll(async () => (await titles(page))[0]).toContain("Middle");

  await page.getByRole("button", { name: /^Ascending/ }).click();
  await expect
    .poll(async () => (await titles(page))[0])
    .toContain("Title, With Comma");

  await waitForStoredPrefs(page, { sortKey: "year", sortDirection: "desc" });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveText(
    /Year/,
  );
  await expect(page.getByRole("button", { name: /^Descending/ })).toBeVisible();
});

test("switches between grid and list, remembering the choice", async ({
  page,
}) => {
  await goHome(page);
  await importCsv(page);

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Middle.*1985/ }),
  ).toBeVisible();

  await waitForStoredPrefs(page, { viewMode: "list" });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
