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

  await page.getByRole("button", { name: /^Grid/ }).click();
  await expect(
    page.getByRole("button", { name: /Middle.*1985/ }),
  ).toBeVisible();

  await waitForStoredPrefs(page, { viewMode: "list" });
  await page.reload();
  await expect(page.getByRole("button", { name: /^List/ })).toBeVisible();
});

test("searches the collection, keeping the results after opening one", async ({
  page,
}) => {
  await goHome(page);
  await importCsv(page);

  await page.getByRole("button", { name: "Search the collection" }).click();
  const field = page.getByRole("searchbox", { name: "Search the collection" });
  await field.fill("zeta 1999");
  const results = page.getByRole("region", { name: "Search results" });
  await expect(results.getByRole("button")).toHaveCount(1);
  await expect(results).toContainText("Alpha");

  await results.getByRole("button", { name: /Alpha/ }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(field).toHaveValue("zeta 1999");

  await field.fill("nothing like it");
  await expect(page.getByText("No albums match.")).toBeVisible();
});
