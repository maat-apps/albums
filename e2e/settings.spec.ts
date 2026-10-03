import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { closeSettings, goHome, importCsv, openSettings } from "./utils";

test("switching to Polish translates the app", async ({ page }) => {
  await goHome(page);
  await openSettings(page);

  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "Polski" }).click();

  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await closeSettings(page);
  await expect(
    page.getByRole("heading", { name: "Albumy", exact: true }),
  ).toBeVisible();
});

test("a backup exports and imports by merging", async ({ page }) => {
  await goHome(page);
  await importCsv(page);
  await openSettings(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  const backup = await readFile(await download.path());

  // Importing merges: a backup holding another album adds it and keeps Alpha.
  await page.getByLabel("Import albums").setInputFiles({
    name: "other.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      JSON.stringify({
        app: "albums",
        version: 1,
        exportedAt: "2026-10-02T00:00:00.000Z",
        data: {
          albums: [
            {
              id: "imported-1",
              artist: "Imported Artist",
              title: "Zeta",
              year: 2001,
              status: "toListen",
              createdAt: "2026-10-02T00:00:00.000Z",
              updatedAt: "2026-10-02T00:00:00.000Z",
            },
          ],
        },
      }),
    ),
  });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  // Let the confirmation close first, or Escape lands on it, not Settings.
  await expect(
    page.getByRole("dialog", { name: "Add albums from the backup?" }),
  ).toHaveCount(0);
  await closeSettings(page);

  await expect(page.getByRole("button", { name: /Zeta/ })).toBeVisible();

  // Importing the exported file again changes nothing: both are still there.
  await openSettings(page);
  await page.getByLabel("Import albums").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "text/plain",
    buffer: backup,
  });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  // Let the confirmation close first, or Escape lands on it, not Settings.
  await expect(
    page.getByRole("dialog", { name: "Add albums from the backup?" }),
  ).toHaveCount(0);
  await closeSettings(page);

  await expect(page.getByRole("button", { name: /Alpha/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zeta/ })).toBeVisible();
});
