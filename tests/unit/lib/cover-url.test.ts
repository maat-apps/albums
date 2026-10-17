import { describe, expect, it } from "vitest";

import { largerCoverUrl } from "@/lib/cover-url";

describe("largerCoverUrl", () => {
  it.each([
    [
      "https://coverartarchive.org/release-group/x/front-250",
      "https://coverartarchive.org/release-group/x/front-1200",
    ],
    [
      "https://coverartarchive.org/release/x/front-500",
      "https://coverartarchive.org/release/x/front-1200",
    ],
    [
      "https://coverartarchive.org/release/x/front",
      "https://coverartarchive.org/release/x/front-1200",
    ],
    [
      "https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg",
      "https://is1-ssl.mzstatic.com/image/thumb/Music/x/1200x1200bb.jpg",
    ],
    [
      "https://is1-ssl.mzstatic.com/image/thumb/Music/x/100x100.png",
      "https://is1-ssl.mzstatic.com/image/thumb/Music/x/1200x1200bb.png",
    ],
  ])("asks for %s at 1200px", (url, larger) => {
    expect(largerCoverUrl(url)).toBe(larger);
  });

  it.each([
    "https://coverartarchive.org/release-group/x/front-1200",
    "https://is1-ssl.mzstatic.com/image/thumb/Music/x/3000x3000bb.jpg",
    "https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg",
    "https://example.com/600x600bb.jpg",
  ])("leaves %s as it is", (url) => {
    expect(largerCoverUrl(url)).toBe(url);
  });
});
