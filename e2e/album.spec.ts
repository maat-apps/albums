import { expect, test } from "@playwright/test";

import { goHome } from "./utils";

test("adding, viewing, changing status, editing and deleting an album", async ({
  page,
}) => {
  await goHome(page);

  await page.getByRole("button", { name: "Add album" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Required.")).toHaveCount(2);

  await page.getByLabel("Artist").fill("Test Artist");
  await page.getByLabel("Title").fill("Test Album");
  await page.getByLabel("Year").fill("1999");
  await page.getByLabel("Spotify URL").fill("https://open.spotify.com/album/x");
  await page.getByRole("button", { name: "Save" }).click();

  // Saving lands on the album.
  await expect(
    page.getByRole("heading", { name: "Test Album" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Test Artist · 1999")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in Spotify" }),
  ).toHaveAttribute("href", "https://open.spotify.com/album/x");

  await page.getByRole("button", { name: "Coming back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Coming back", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Edit album" }).click();
  await page.getByLabel("Title").fill("Renamed");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "Renamed" }).first(),
  ).toBeVisible();

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
