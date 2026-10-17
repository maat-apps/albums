import { expect, test } from "@playwright/test";

import { goHome, importCsv } from "./utils";

// Made-up rows only: four albums for each artist letter A–T, enough for a
// collection many screens tall.
const LONG_CSV = [
  "Rok,Artysta,Tytuł,WRACAM?",
  ..."ABCDEFGHIJKLMNOPQRST"
    .split("")
    .flatMap((letter) =>
      [1, 2, 3, 4].map((n) => `2000,${letter}rtist,${letter} Record ${n},`),
    ),
].join("\n");

const rail = (page: import("@playwright/test").Page) =>
  page.getByRole("slider", { name: "Jump to" });

test("shows no rail for a short collection", async ({ page }) => {
  await goHome(page);
  await importCsv(page);

  await expect(page.getByText("Middle")).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
});

test("jumps between artist letters from the rail", async ({ page }) => {
  await goHome(page);
  await importCsv(page, LONG_CSV);

  await expect(rail(page)).toHaveAttribute("aria-valuetext", "A");

  await rail(page).focus();
  await page.keyboard.press("End");
  await expect(rail(page)).toHaveAttribute("aria-valuetext", "T");
  await expect(page.getByText("T Record 1")).toBeInViewport();

  await page.keyboard.press("ArrowUp");
  await expect(rail(page)).toHaveAttribute("aria-valuetext", "S");
  await expect(page.getByText("S Record 1")).toBeInViewport();
});

test("dragging the thumb moves through the groups", async ({ page }) => {
  await goHome(page);
  await importCsv(page, LONG_CSV);
  await page.mouse.wheel(0, 200);
  await expect(rail(page)).toBeVisible();

  const thumb = await rail(page).boundingBox();
  if (!thumb) throw new Error("no thumb");
  const x = thumb.x + thumb.width / 2;
  await page.mouse.move(x, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, thumb.y + 400, { steps: 10 });

  await expect(rail(page)).not.toHaveAttribute("aria-valuetext", "A");
  const group = await rail(page).getAttribute("aria-valuetext");
  await expect(page.getByText(`${group} Record 1`)).toBeInViewport();
  await page.mouse.up();
});
