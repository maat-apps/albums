import { expect, type Page, test } from "@playwright/test";

import { goHome, importCsv, waitForStoredPrefs } from "./utils";

function titles(page: Page) {
  return page
    .getByRole("region", { name: "Collection" })
    .getByRole("button")
    .allInnerTexts();
}

test("filters by any of the chosen statuses, with counts", async ({ page }) => {
  await goHome(page);
  await importCsv(page);
  const comingBack = page.getByRole("button", { name: /^Coming back\s*1$/ });
  const toListen = page.getByRole("button", { name: /^To listen\s*1$/ });

  await comingBack.click();
  await expect(comingBack).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => titles(page)).toHaveLength(1);
  expect((await titles(page)).join(" ")).toContain("Alpha");

  await toListen.click();
  await expect.poll(() => titles(page)).toHaveLength(2);
  expect((await titles(page)).join(" ")).toContain("Middle");

  await comingBack.click();
  await toListen.click();
  await expect(toListen).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => titles(page)).toHaveLength(3);
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
