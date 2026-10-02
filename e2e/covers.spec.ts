import { expect, test } from "@playwright/test";

import { goHome } from "./utils";

const COVER_URL = "https://coverartarchive.org/release/e2e/front-250";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// The service worker would fetch the cover itself, out of page.route's
// reach; this spec is about the IndexedDB copy, not the worker's cache.
test.use({ serviceWorkers: "block" });

test("stores a cover once and shows it offline after a reload", async ({
  page,
}) => {
  let requests = 0;
  await page.route(COVER_URL, (route) => {
    requests++;
    return route.fulfill({
      body: PNG,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    });
  });

  await goHome(page);
  await page.getByRole("button", { name: "Add album" }).click();
  await page.getByLabel("Artist", { exact: true }).fill("Made-up Artist");
  await page.getByLabel("Title", { exact: true }).fill("Made-up Title");
  await page.getByLabel("Cover image URL").fill(COVER_URL);
  await page.getByRole("button", { name: "Save" }).click();

  const cover = page.locator("img");
  await expect(cover).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => requests).toBe(1);

  await page.unroute(COVER_URL);
  await page.route(COVER_URL, (route) => route.abort());
  await page.reload();

  await expect(cover).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);
});
