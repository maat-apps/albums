import { expect, type Route, test } from "@playwright/test";

import { goHome, importCsv, openSettings } from "./utils";

// The worker would fetch these requests itself, out of page.route's reach.
test.use({ serviceWorkers: "block" });

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const CORS = { "access-control-allow-origin": "*" };

function releaseGroup(id: string, title: string, artist: string, date: string) {
  return {
    id,
    title,
    "first-release-date": date,
    "primary-type": "Album",
    "artist-credit": [{ name: artist }],
  };
}

// Made-up answers for SAMPLE_CSV's made-up albums: a sure match for
// "Alpha", only another artist for "Middle", nothing for the third.
function musicBrainz(route: Route) {
  const query = new URL(route.request().url()).searchParams.get("query") ?? "";
  const groups = query.includes("Alpha")
    ? [releaseGroup("rg-alpha", "Alpha", "Zeta Band", "1999-01-01")]
    : query.includes("Middle")
      ? [releaseGroup("rg-middle", "Middle", "Someone Else", "1990-01-01")]
      : [];
  return route.fulfill({ json: { "release-groups": groups }, headers: CORS });
}

// Nothing on iTunes, the fallback after MusicBrainz.
function iTunes(route: Route) {
  return route.fulfill({ json: { results: [] }, headers: CORS });
}

test("finds covers for imported albums and lets the user pick the unsure ones", async ({
  page,
}) => {
  await page.route("https://itunes.apple.com/search**", iTunes);
  await page.route(
    "https://musicbrainz.org/ws/2/release-group/**",
    musicBrainz,
  );
  await page.route("https://coverartarchive.org/**", (route) =>
    route.fulfill({ body: PNG, contentType: "image/png", headers: CORS }),
  );
  await goHome(page);
  await importCsv(page);

  await openSettings(page);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText("Albums left to search: 3")).toBeVisible();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Found: 1 · To review: 1 · Not found: 1"),
  ).toBeVisible({ timeout: 30_000 });

  const toReview = page.getByRole("list", { name: "To review (1)" });
  await toReview.getByRole("button", { name: /Middle/ }).click();
  await page
    .getByRole("list", { name: "Matches" })
    .getByRole("button", { name: /Middle/ })
    .click();
  await expect(page.getByRole("list", { name: /^To review/ })).toHaveCount(0);

  await page.goto("");
  await page.getByRole("button", { name: /Middle/ }).click();
  await expect(
    page.getByRole("heading", { name: "Middle", level: 2 }),
  ).toBeVisible();
  await expect(page.locator("img")).toHaveAttribute("src", /^blob:/);
  await expect(
    page.getByRole("link", { name: "Search on Spotify" }),
  ).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\/search\//);
});

test("an album without a cover offers to find one", async ({ page }) => {
  await page.route("https://itunes.apple.com/search**", iTunes);
  await page.route(
    "https://musicbrainz.org/ws/2/release-group/**",
    musicBrainz,
  );
  await goHome(page);
  await importCsv(page);

  await page.getByRole("button", { name: /Title, With Comma/ }).click();
  await page.getByRole("button", { name: "Find a cover" }).click();

  await expect(page.getByText("Nothing found.")).toBeVisible();
  await page.getByRole("button", { name: "None of these" }).click();
  // Back on the album it was opened from.
  await expect(
    page.getByRole("button", { name: "Find a cover" }),
  ).toBeVisible();
});
