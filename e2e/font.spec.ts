import { expect, test } from "@playwright/test";

// Guards maat-core#78: the font has to reach the production build, or the
// app silently falls back to the system font. load() fetches the face and
// rejects (or finds none) when its file is missing.
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
