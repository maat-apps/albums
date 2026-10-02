import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { goHome, importCsv, openSettings } from "./utils";

test("switching to Polish translates the app", async ({ page }) => {
  await goHome(page);
  await openSettings(page);

  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "Polski" }).click();

  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Albumy", exact: true }),
  ).toBeVisible();
});

test("a backup exports and imports back", async ({ page }) => {
  await goHome(page);
  await importCsv(page);
  await openSettings(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  const backup = await readFile(await download.path());

  // Replace the collection with a different one, then restore the backup.
  await page.getByLabel("Import albums").setInputFiles({
    name: "empty.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      JSON.stringify({
        app: "albums",
        version: 1,
        exportedAt: "2026-10-02T00:00:00.000Z",
        data: { albums: [] },
      }),
    ),
  });
  await page.getByRole("button", { name: "Replace" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "No albums yet" }),
  ).toBeVisible();

  await openSettings(page);
  await page.getByLabel("Import albums").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "text/plain",
    buffer: backup,
  });
  await page.getByRole("button", { name: "Replace" }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: /Alpha/ })).toBeVisible();
});
