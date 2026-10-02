import { expect, test } from "@playwright/test";

import { goHome, openSettings, SAMPLE_CSV } from "./utils";

test("importing a CSV adds its albums and skips them on re-import", async ({
  page,
}) => {
  await goHome(page);
  await openSettings(page);
  const file = {
    name: "list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(SAMPLE_CSV),
  };
  const input = page.getByLabel("Import from CSV");

  await input.setInputFiles(file);
  await expect(page.getByText("Imported 3, skipped 0")).toBeVisible();

  await input.setInputFiles(file);
  await expect(page.getByText("Imported 0, skipped 3")).toBeVisible();
});
