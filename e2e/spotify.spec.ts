import { expect, type Route, test } from "@playwright/test";

import { goHome, importCsv, openSettings } from "./utils";

// The worker would fetch these requests itself, out of page.route's reach.
test.use({ serviceWorkers: "block" });

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
};

// Back to the app from the mocked login page. A page that redirects
// itself, not an HTTP 302: WebKit can't fulfill a navigation with one.
function redirectTo(route: Route, href: string) {
  return route.fulfill({
    contentType: "text/html",
    body: `<script>location.replace(${JSON.stringify(href)})</script>`,
  });
}

// Spotify's login: straight back to the app with a code, as after the
// user agrees.
function authorize(route: Route) {
  const url = new URL(route.request().url());
  const back = new URL(url.searchParams.get("redirect_uri") ?? "");
  back.searchParams.set("code", "made-up-code");
  back.searchParams.set("state", url.searchParams.get("state") ?? "");
  return redirectTo(route, back.href);
}

function token(route: Route) {
  return route.fulfill({
    json: { access_token: "at", expires_in: 3600, refresh_token: "rt" },
    headers: CORS,
  });
}

// A made-up answer: SAMPLE_CSV's "Alpha" on Spotify.
function search(route: Route) {
  if (route.request().method() === "OPTIONS") {
    return route.fulfill({ status: 204, headers: CORS });
  }
  const query = new URL(route.request().url()).searchParams.get("q") ?? "";
  const items = query.includes("Alpha")
    ? [
        {
          id: "sp-alpha",
          name: "Alpha",
          album_type: "album",
          release_date: "1999-03-01",
          artists: [{ name: "Zeta Band" }],
          images: [{ url: "https://i.scdn.co/image/alpha" }],
          external_urls: { spotify: "https://open.spotify.com/album/alpha" },
        },
      ]
    : [];
  return route.fulfill({ json: { albums: { items } }, headers: CORS });
}

test("connects Spotify and fills covers and exact links from it", async ({
  page,
}) => {
  await page.route("https://accounts.spotify.com/authorize**", authorize);
  await page.route("https://accounts.spotify.com/api/token", token);
  await page.route("https://api.spotify.com/v1/search**", search);
  await page.route("https://i.scdn.co/**", (route) =>
    route.fulfill({ body: PNG, contentType: "image/png", headers: CORS }),
  );
  await goHome(page);
  await importCsv(page);

  await openSettings(page);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await page.getByRole("button", { name: "Connect Spotify" }).click();
  await expect(page.getByText("Connected to Spotify")).toBeVisible();

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Found: 1 · To review: 0 · Not found: 2"),
  ).toBeVisible();

  await page.goto("");
  await page.getByRole("button", { name: /Alpha/ }).click();
  await expect(
    page.getByRole("link", { name: "Open in Spotify" }),
  ).toHaveAttribute("href", "https://open.spotify.com/album/alpha");
  await expect(page.locator("img")).toHaveAttribute("src", /^blob:/);

  // Disconnecting goes back to MusicBrainz.
  await page.goto("covers");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Spotify not connected")).toBeVisible();
});

test("a refused Spotify login says so", async ({ page }) => {
  await page.route("https://accounts.spotify.com/authorize**", (route) => {
    const url = new URL(route.request().url());
    const back = new URL(url.searchParams.get("redirect_uri") ?? "");
    back.searchParams.set("error", "access_denied");
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    return redirectTo(route, back.href);
  });
  await goHome(page);

  await openSettings(page);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await page.getByRole("button", { name: "Connect Spotify" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Couldn't connect to Spotify. Try again.",
  );
});
