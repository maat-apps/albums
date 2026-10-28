// Reusable Playwright test helpers — plain functions specs call directly,
// not test.extend() fixtures (hence "utils.ts", not "fixtures.ts" — see
// maat-core/STRUCTURE.md's Testing section for why that naming matters).
import { readStored } from "@maat-apps/config/playwright";
import { expect, type Page } from "@playwright/test";

export async function goHome(page: Page) {
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "Albums", exact: true }),
  ).toBeVisible();
}

/**
 * Closes the settings drawer and waits until no dialog is left — a click
 * right after Escape can land on a drawer that's still closing.
 */
export async function closeSettings(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

export async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
}

// Made-up rows only — no personal list is ever committed to this repo.
export const SAMPLE_CSV = [
  "Rok,Artysta,Tytuł,WRACAM?",
  "1999,Zeta Band,Alpha,GREEN",
  '2001,"Band, The","Title, With Comma",RED',
  "1985,Another Artist,Middle,",
].join("\n");

/** Imports `csv` through Settings → Data and closes the drawer. */
export async function importCsv(page: Page, csv = SAMPLE_CSV) {
  await openSettings(page);
  await page.getByLabel("Import from CSV").setInputFiles({
    name: "list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/^Imported \d+/)).toBeVisible();
  await closeSettings(page);
}

/** The stored settings record (written in the background). */
function storedSettings(page: Page) {
  return readStored(page, "albums", "albums-settings") as Promise<
    { collection?: unknown; lock?: unknown } | undefined
  >;
}

/**
 * Waits until the collection prefs are persisted to IndexedDB — they're
 * written in the background, so a reload right after a click could beat
 * the write.
 */
export async function waitForStoredPrefs(
  page: Page,
  expected: Record<string, string>,
) {
  await expect
    .poll(async () => (await storedSettings(page))?.collection)
    .toMatchObject(expected);
}

/**
 * Resolves once the app-lock enrolment has reached IndexedDB. Settings
 * persist in the background, so a reload right after enrolling can lose
 * it and the app comes back unlocked.
 */
export async function waitForStoredLock(page: Page) {
  await expect
    .poll(async () => Boolean((await storedSettings(page))?.lock))
    .toBe(true);
}

/**
 * Answers every cover/link lookup with nothing found, so a spec that opens
 * an album — which looks it up by itself — never reaches the real services.
 */
export async function answerLookupsEmpty(page: Page) {
  const cors = { "access-control-allow-origin": "*" };
  await page.route("https://musicbrainz.org/**", (route) =>
    route.fulfill({ json: { "release-groups": [] }, headers: cors }),
  );
  await page.route("https://itunes.apple.com/**", (route) =>
    route.fulfill({ json: { results: [] }, headers: cors }),
  );
}
