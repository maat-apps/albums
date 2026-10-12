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
  await page.getByRole("button", { name: "Save" }).click();

  // Saving lands on the album.
  await expect(
    page.getByRole("heading", { name: "Test Album" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Test Artist · 1999")).toBeVisible();
  // No Deezer link of its own: Deezer's search instead.
  await expect(
    page.getByRole("link", { name: "Search on Deezer" }),
  ).toHaveAttribute(
    "href",
    "https://www.deezer.com/search/Test%20Artist%20Test%20Album",
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
