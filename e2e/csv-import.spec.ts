import { expect, test } from "@playwright/test";

import { goHome } from "./utils";

// Made-up rows only — no personal list is ever committed to this repo.
const csv = [
  "Rok,Artysta,Tytuł,WRACAM?",
  "1999,Test Artist,First Album,GREEN",
  '2001,"Band, The","Title, With Comma",RED',
  "2005,Someone,Unheard,",
].join("\n");

test("importing a CSV adds its albums and skips them on re-import", async ({
  page,
}) => {
  await goHome(page);
  const file = {
    name: "list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  };
  const input = page.getByLabel("Import from CSV");

  await input.setInputFiles(file);
  await expect(page.getByText("Imported 3, skipped 0")).toBeVisible();
  await expect(
    page.getByText("3 albums: 1 to listen, 1 coming back, 1 not coming back."),
  ).toBeVisible();

  await input.setInputFiles(file);
  await expect(page.getByText("Imported 0, skipped 3")).toBeVisible();
});
