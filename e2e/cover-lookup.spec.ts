import { expect, type Page, type Route, test } from "@playwright/test";

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

const DEEZER_COVER =
  "https://cdn-images.dzcdn.net/images/cover/alpha/1000x1000.jpg";

function deezerAlbum(id: number, title: string, artist: string) {
  return {
    id,
    title,
    link: `https://www.deezer.com/album/${id}`,
    cover_xl: DEEZER_COVER,
    md5_image: "alpha",
    record_type: "album",
    artist: { name: artist },
  };
}

// Made-up answers for SAMPLE_CSV's made-up albums, tried first: a sure match
// (cover and link) for "Alpha", only another artist for "Middle", nothing
// for the third.
function deezer(route: Route) {
  const query = new URL(route.request().url()).searchParams.get("q") ?? "";
  const data = query.includes('album:"Alpha"')
    ? [deezerAlbum(1, "Alpha", "Zeta Band")]
    : query.includes('album:"Middle"')
      ? [deezerAlbum(2, "Middle", "Someone Else")]
      : [];
  return route.fulfill({ json: { data, total: data.length }, headers: CORS });
}

// MusicBrainz, for what Deezer didn't match: again only another artist for
// "Middle", nothing for the rest.
function musicBrainz(route: Route) {
  const query = new URL(route.request().url()).searchParams.get("query") ?? "";
  const groups = query.includes("Middle")
    ? [releaseGroup("rg-middle", "Middle", "Someone Else", "1990-01-01")]
    : [];
  return route.fulfill({ json: { "release-groups": groups }, headers: CORS });
}

// Nothing on iTunes, the fallback after MusicBrainz.
function iTunes(route: Route) {
  return route.fulfill({ json: { results: [] }, headers: CORS });
}

async function mockServices(page: Page) {
  await page.route("https://api.deezer.com/search/album**", deezer);
  await page.route("https://itunes.apple.com/search**", iTunes);
  await page.route(
    "https://musicbrainz.org/ws/2/release-group/**",
    musicBrainz,
  );
  const png = (route: Route) =>
    route.fulfill({ body: PNG, contentType: "image/png", headers: CORS });
  await page.route("https://coverartarchive.org/**", png);
  await page.route("https://cdn-images.dzcdn.net/**", png);
}

test("finds covers and Deezer links for imported albums and lets the user pick the unsure ones", async ({
  page,
}) => {
  await mockServices(page);
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
  // Deezer's candidate first, then MusicBrainz's.
  const matches = page
    .getByRole("list", { name: "Matches" })
    .getByRole("button", { name: /Middle/ });
  await expect(matches).toHaveCount(2);
  await matches.first().click();
  await expect(page.getByRole("list", { name: /^To review/ })).toHaveCount(0);

  await page.goto("");
  await page.getByRole("button", { name: /Middle/ }).click();
  await expect(
    page.getByRole("heading", { name: "Middle", level: 2 }),
  ).toBeVisible();
  await expect(page.locator("img")).toHaveAttribute("src", /^blob:/);
  await expect(
    page.getByRole("link", { name: "Open in Deezer" }),
  ).toHaveAttribute("href", "https://www.deezer.com/album/2");

  await page.goto("");
  await page.getByRole("button", { name: /Alpha/ }).click();
  await expect(
    page.getByRole("link", { name: "Open in Deezer" }),
  ).toHaveAttribute("href", "https://www.deezer.com/album/1");
});

test("an album without a cover offers to find one", async ({ page }) => {
  await mockServices(page);
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

test("names each service that couldn't be reached", async ({ page }) => {
  await page.route("https://api.deezer.com/**", (route) => route.abort());
  await page.route("https://musicbrainz.org/**", (route) =>
    route.fulfill({ status: 503, headers: CORS }),
  );
  await page.route("https://itunes.apple.com/**", (route) => route.abort());
  await goHome(page);
  await importCsv(page);

  await page.getByRole("button", { name: /Title, With Comma/ }).click();
  await page.getByRole("button", { name: "Find a cover" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Deezer: couldn't connect.");
  await expect(alert).toContainText("MusicBrainz: too many requests");
  await expect(alert).toContainText("iTunes: couldn't connect.");
});
