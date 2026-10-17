import { expect, test } from "@playwright/test";

import { goHome, openSettings, waitForStoredLock } from "./utils";

// Wiring only: the app's enrolment persists and its gate renders. The lock
// screen's own behavior (escape hatch, erase warning) is tested in
// @maat-apps/ui, the lock logic in @maat-apps/core.
test.describe("app lock", () => {
  test("enrolling turns the lock on and unlocking with the same authenticator works", async ({
    page,
  }) => {
    // Playwright's native virtual WebAuthn authenticator, installed before
    // navigation so the app's real create()/get() calls succeed against it.
    await page.context().credentials.install();
    await goHome(page);
    await openSettings(page);

    const lockSwitch = page.getByRole("switch", { name: "App lock" });
    await expect(lockSwitch).toBeEnabled();
    await lockSwitch.click();
    await expect(lockSwitch).toBeChecked();

    await expect(page.getByText("After leaving the app.")).toBeVisible();

    // Enrolling counts as unlocked, but that's per-session memory — a
    // reload locks again, and the lock screen prompts by itself.
    await waitForStoredLock(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Unlock" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Albums", exact: true }),
    ).toBeVisible();
  });
});
