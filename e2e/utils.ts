// Reusable Playwright test helpers — plain functions specs call directly,
// not test.extend() fixtures (hence "utils.ts", not "fixtures.ts" — see
// maat-core/STRUCTURE.md's Testing section for why that naming matters).
import { expect, type Page } from "@playwright/test";

export async function goHome(page: Page) {
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "Albums", exact: true }),
  ).toBeVisible();
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
  await page.keyboard.press("Escape");
}

/**
 * Waits until the collection prefs are persisted to IndexedDB — they're
 * written in the background, so a reload right after a click could beat
 * the write. Store and key names are duplicated by hand: this runs in the
 * page, which can't import from src/.
 */
export async function waitForStoredPrefs(
  page: Page,
  expected: Record<string, string>,
) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<unknown>((resolve) => {
            const request = indexedDB.open("albums");
            request.onsuccess = () => {
              const read = request.result
                .transaction("kv")
                .objectStore("kv")
                .get("albums-settings");
              read.onsuccess = () =>
                resolve(
                  (read.result as { collection?: unknown } | undefined)
                    ?.collection,
                );
            };
          }),
      ),
    )
    .toMatchObject(expected);
}

/**
 * Resolves once the app-lock enrolment has reached IndexedDB. Settings
 * persist in the background, so a reload right after enrolling can lose
 * it and the app comes back unlocked.
 */
export async function waitForStoredLock(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const request = indexedDB.open("albums");
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
              const read = request.result
                .transaction("kv")
                .objectStore("kv")
                .get("albums-settings");
              read.onerror = () => resolve(false);
              read.onsuccess = () =>
                resolve(
                  Boolean(
                    (read.result as { lock?: unknown } | undefined)?.lock,
                  ),
                );
            };
          }),
      ),
    )
    .toBe(true);
}
