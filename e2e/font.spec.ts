import { expect, test } from "@playwright/test";

// Wiring only: the app imports @maat-apps/ui/font, so Outfit's files reach
// its production build (maat-core#78). The font module itself is tested in
// @maat-apps/ui's browser tests.
test("renders in Outfit", async ({ page }) => {
  await page.goto("");
  const loadedFaces = await page.evaluate(() =>
    document.fonts
      .load('16px "Outfit Variable"')
      .then((faces) => faces.length)
      .catch(() => 0),
  );
  expect(loadedFaces).toBeGreaterThan(0);
});
