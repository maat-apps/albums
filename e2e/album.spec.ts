import { expect, test } from "@playwright/test";

import { answerLookupsEmpty, goHome, importCsv } from "./utils";

// The worker would fetch the search and covers itself, out of page.route's
// reach.
test.use({ serviceWorkers: "block" });

const CORS = { "access-control-allow-origin": "*" };

test("adding an album found on MusicBrainz", async ({ page }) => {
  await answerLookupsEmpty(page);
  await page.route("https://musicbrainz.org/ws/2/release-group/**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("query");
    const found = query?.includes("zeta")
      ? [
          {
            id: "rg-new",
            title: "Made-up Debut",
            "first-release-date": "2003-02-01",
            "primary-type": "Album",
            "artist-credit": [{ name: "Zeta Band" }],
          },
          {
            id: "rg-alpha",
            title: "Alpha",
            "first-release-date": "1999-01-01",
            "primary-type": "Album",
            "artist-credit": [{ name: "Zeta Band" }],
          },
        ]
      : [];
    return route.fulfill({ json: { "release-groups": found }, headers: CORS });
  });
  await page.route("https://coverartarchive.org/**", (route) =>
    route.fulfill({ status: 404, headers: CORS }),
  );
  await goHome(page);
  await importCsv(page);

  await page.getByRole("button", { name: "Add album" }).click();
  await page.getByLabel("Search MusicBrainz").fill("nothing like it");
  await expect(page.getByText("Nothing found.")).toBeVisible();

  await page.getByLabel("Search MusicBrainz").fill("zeta");
  const results = page.getByRole("list", { name: "Search results" });
  // Already imported: marked, and tapping it opens the one in the collection.
  await expect(
    results.getByRole("button", { name: /Alpha.*In your collection/ }),
  ).toBeVisible();

  await results.getByRole("button", { name: /Made-up Debut/ }).click();
  await expect(
    page.getByRole("heading", { name: "Made-up Debut" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Zeta Band · 2003")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "To listen", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Back skips the search: the album replaced it.
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Albums", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Made-up Debut")).toBeVisible();
});

test("adding by hand, viewing, changing status, editing and deleting an album", async ({
  page,
}) => {
  await answerLookupsEmpty(page);
  await goHome(page);

  await page.getByRole("button", { name: "Add album" }).click();
  await page.getByRole("button", { name: "Not there? Add it by hand" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Required.")).toHaveCount(2);

  await page.getByLabel("Artist").fill("Test Artist");
  await page.getByLabel("Title").fill("Test Album");
  await page.getByLabel("Year").fill("1999");
  await page.getByRole("button", { name: "Save" }).click();

  // Saving lands on the album.
  await expect(
    page.getByRole("heading", { name: "Test Album" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Test Artist · 1999")).toBeVisible();
  // No Deezer link yet: no button.
  await expect(page.getByRole("link", { name: "Open in Deezer" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Coming back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Coming back", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Edit album" }).click();
  await page.getByLabel("Title").fill("Renamed");
  await page.getByLabel("Deezer URL").fill("deezer.com/album/1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Use a full https:// link.")).toBeVisible();
  await page.getByLabel("Deezer URL").fill("https://www.deezer.com/album/1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "Renamed" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in Deezer" }),
  ).toHaveAttribute("href", "https://www.deezer.com/album/1");

  await page.getByRole("button", { name: "Edit album" }).click();
  await page.getByRole("button", { name: "Delete album" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No albums yet" }),
  ).toBeVisible();
});

test("a stale link shows a way back", async ({ page }) => {
  await page.goto("does-not-exist");
  await expect(
    page.getByText("This album doesn't exist any more."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to the collection" }).click();
  await expect(
    page.getByRole("heading", { name: "Albums", exact: true }),
  ).toBeVisible();
});
