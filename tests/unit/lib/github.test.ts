import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GitHubError,
  readRepoFile,
  writeRepoFile,
  type RepoFileLocation,
} from "@/lib/github";

const LOCATION: RepoFileLocation = {
  owner: "me",
  repo: "albums-data",
  branch: "main",
  path: "data/albums.json",
  token: "secret",
};

const CONTENTS =
  "https://api.github.com/repos/me/albums-data/contents/data/albums.json";

function base64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("Unexpected request");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readRepoFile", () => {
  it("reads the file's text and version from the branch", async () => {
    const fetchMock = mockFetch(
      json({ sha: "s1", encoding: "base64", content: base64("[]\nżółw") }),
    );

    await expect(readRepoFile(LOCATION)).resolves.toEqual({
      text: "[]\nżółw",
      sha: "s1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${CONTENTS}?ref=main`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
  });

  it("reads a file over 1 MB from its blob", async () => {
    const fetchMock = mockFetch(
      json({ sha: "s1", encoding: "none", content: "" }),
      json({ content: base64("big") }),
    );

    await expect(readRepoFile(LOCATION)).resolves.toEqual({
      text: "big",
      sha: "s1",
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.github.com/repos/me/albums-data/git/blobs/s1",
      expect.anything(),
    );
  });

  it("returns null when the repository exists but the file doesn't", async () => {
    mockFetch(json({}, 404), json({}));
    await expect(readRepoFile(LOCATION)).resolves.toBeNull();
  });

  it("fails when the repository can't be seen", async () => {
    mockFetch(json({}, 404), json({}, 404));
    await expect(readRepoFile(LOCATION)).rejects.toMatchObject({
      kind: "notFound",
    });
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [500, "unexpected"],
  ])("maps a %i to %s", async (status, kind) => {
    mockFetch(json({}, status));
    await expect(readRepoFile(LOCATION)).rejects.toMatchObject({ kind });
  });

  it("fails as a network error when GitHub can't be reached", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    await expect(readRepoFile(LOCATION)).rejects.toEqual(
      new GitHubError("network"),
    );
  });
});

describe("writeRepoFile", () => {
  it("commits the text over the version it replaces", async () => {
    const fetchMock = mockFetch(json({}));

    await writeRepoFile(LOCATION, "[]\n", "s1", "Update");

    expect(fetchMock).toHaveBeenCalledWith(
      CONTENTS,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          message: "Update",
          content: base64("[]\n"),
          branch: "main",
          sha: "s1",
        }),
      }),
    );
  });

  it("creates the file when there's no version to replace", async () => {
    const fetchMock = mockFetch(json({}, 201));

    await writeRepoFile(LOCATION, "[]\n", null, "Create");

    const init = fetchMock.mock.calls[0]?.[1] ?? {};
    expect(JSON.parse(init.body as string)).not.toHaveProperty("sha");
  });

  it("reports a stale version as a conflict", async () => {
    mockFetch(json({}, 409));
    await expect(
      writeRepoFile(LOCATION, "[]\n", "old", "Update"),
    ).rejects.toMatchObject({ kind: "conflict" });
  });

  it("encodes a file too big for one call's arguments", async () => {
    const fetchMock = mockFetch(json({}));
    const text = "x".repeat(200_000);

    await writeRepoFile(LOCATION, text, "s1", "Update");

    const init = fetchMock.mock.calls[0]?.[1] ?? {};
    const { content } = JSON.parse(init.body as string) as { content: string };
    expect(atob(content)).toBe(text);
  });
});
