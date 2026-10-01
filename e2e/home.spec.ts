import { expect, test } from "@playwright/test";

import { goHome } from "./utils";

// A minimal smoke test so `npm run test:e2e` has something to run against
// the freshly scaffolded app, before any real screens exist — replace with
// real specs as views are built.
test("home screen renders", async ({ page }) => {
  await goHome(page);
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
});
