import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Album } from "@/lib/schemas";
import type { RepoLocation as RepoFileLocation } from "@maat-apps/core/github";
import { resetIndexedDb } from "../reset-indexeddb";

const LOCATION: RepoFileLocation = {
  owner: "me",
  repo: "albums-data",
  branch: "main",
  path: "albums.json",
  token: "secret-token",
};

const EARLIER = "2026-10-01T10:00:00.000Z";
const LATER = "2026-10-02T10:00:00.000Z";

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: "a1",
    year: 1977,
    artist: "Artist",
    title: "Title",
    status: "toListen",
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

function toBase64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function fromBase64(base64: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)),
  );
}

/**
 * A repository holding one file, answering the contents API. `beforeWrite`
 * runs before a commit lands — e.g. to change the file meanwhile.
 */
function fakeGitHub(initial: string | null, status = 200) {
  const repo = {
    file: initial === null ? null : { text: initial, sha: "v0" },
    commits: 0,
    beforeWrite: undefined as (() => void) | undefined,
    /** Every write races a change. */
    alwaysRace: false,
  };
  const respond = (body: unknown, code = 200) =>
    new Response(JSON.stringify(body), { status: code });

  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      if (status !== 200) return respond({}, status);
      const url = String(input);
      if (!url.includes("/contents/")) return respond({});
      if (init?.method !== "PUT") {
        return repo.file
          ? respond({
              sha: repo.file.sha,
              encoding: "base64",
              content: toBase64(repo.file.text),
            })
          : respond({}, 404);
      }
      repo.beforeWrite?.();
      repo.beforeWrite = undefined;
      if (repo.alwaysRace && repo.file) {
        repo.file = { ...repo.file, sha: `${repo.file.sha}+` };
      }
      const body = JSON.parse(init.body as string) as {
        content: string;
        sha?: string;
      };
      if (body.sha !== repo.file?.sha) return respond({}, 409);
      repo.commits++;
      repo.file = { text: fromBase64(body.content), sha: `v${repo.commits}` };
      return respond({}, 201);
    }),
  );
  return repo;
}

async function testKey() {
  const { deriveKey, randomBytes } = await import("@maat-apps/core/crypto");
  return deriveKey(randomBytes(32), randomBytes(16), "test-data-v1");
}

// Module-level state everywhere, so each test (and each "relaunch") gets a
// fresh module graph over the same IndexedDB.
async function launch({
  encrypting = true,
  key,
}: { encrypting?: boolean; key?: CryptoKey | null } = {}) {
  vi.resetModules();
  const settings = await import("@/lib/app-settings");
  await settings.whenLoaded();
  if (encrypting && !settings.getSettingsSnapshot().lock) {
    settings.setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: true,
      prfSalt: "c2FsdA",
    });
  }
  const { encryptionKey } = await import("@/lib/encryption-key");
  const lockKey = key === undefined ? await testKey() : key;
  if (encrypting && lockKey) encryptionKey.set(lockKey);
  const storage = await import("@/lib/storage");
  if (!encrypting || lockKey) await storage.whenLoaded();
  const sync = await import("@/lib/github-sync");
  return { settings, encryptionKey, storage, sync, key: lockKey };
}

async function storedConnection(): Promise<unknown> {
  const { kvGet } = await import("@/lib/idb-store");
  const { GITHUB_KEY } = await import("@/lib/storage-keys");
  return kvGet(GITHUB_KEY);
}

beforeEach(async () => {
  await resetIndexedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connecting", () => {
  it("is refused without a lock that encrypts", async () => {
    fakeGitHub("[]\n");
    const { sync } = await launch({ encrypting: false });

    expect(sync.canConnectGitHub()).toBe(false);
    await expect(sync.connectGitHub(LOCATION)).rejects.toBeInstanceOf(
      sync.GitHubSyncError,
    );
    expect(await storedConnection()).toBeUndefined();
  });

  it("stores the connection encrypted only", async () => {
    fakeGitHub("[]\n");
    const { sync } = await launch();

    await sync.connectGitHub(LOCATION);

    expect(sync.getGitHubConnection()).toEqual({ ...LOCATION, syncedIds: [] });
    const { isEncryptedBlob } = await import("@maat-apps/core/crypto");
    const stored = await storedConnection();
    expect(isEncryptedBlob(stored)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("secret-token");
  });

  it("isn't saved when GitHub rejects the token", async () => {
    fakeGitHub("[]\n", 401);
    const { sync } = await launch();

    await expect(sync.connectGitHub(LOCATION)).rejects.toMatchObject({
      kind: "unauthorized",
    });
    expect(sync.getGitHubConnection()).toBeNull();
  });

  it("is read back after a relaunch and unlock", async () => {
    fakeGitHub("[]\n");
    const first = await launch();
    await first.sync.connectGitHub(LOCATION);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const { sync } = await launch({ key: first.key });
    await sync.whenGitHubLoaded();

    expect(sync.getGitHubConnection()).toEqual({ ...LOCATION, syncedIds: [] });
  });

  it("isn't read without an encrypting lock", async () => {
    const { sync } = await launch({ encrypting: false });
    await sync.whenGitHubLoaded();
    expect(sync.getGitHubConnection()).toBeNull();
  });

  it("notifies subscribers and disconnects", async () => {
    fakeGitHub("[]\n");
    const { sync } = await launch();
    const listener = vi.fn();
    const unsubscribe = sync.subscribeToGitHub(listener);

    await sync.connectGitHub(LOCATION);
    await sync.disconnectGitHub();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(sync.getGitHubConnection()).toBeNull();
    expect(sync.getServerGitHubConnection()).toBeNull();
    expect(await storedConnection()).toBeUndefined();
  });
});

describe("the lock's rewrite", () => {
  it("re-encrypts the connection under the current key", async () => {
    fakeGitHub("[]\n");
    const { sync } = await launch();
    await sync.connectGitHub(LOCATION);

    await sync.rewriteGitHubConnection();

    expect(sync.getGitHubConnection()).toEqual({ ...LOCATION, syncedIds: [] });
  });

  it("deletes the connection once the lock is off", async () => {
    fakeGitHub("[]\n");
    const { settings, encryptionKey, sync } = await launch();
    await sync.connectGitHub(LOCATION);

    settings.setLockEnrolment(null);
    encryptionKey.set(null);
    await sync.rewriteGitHubConnection();

    expect(sync.getGitHubConnection()).toBeNull();
    expect(await storedConnection()).toBeUndefined();
  });
});

describe("syncWithGitHub", () => {
  it("needs a connection", async () => {
    const { sync } = await launch();
    await expect(sync.syncWithGitHub()).rejects.toBeInstanceOf(
      sync.GitHubSyncError,
    );
  });

  it("brings both sides together and remembers what was synced", async () => {
    const { formatAlbumsFile } = await import("@/lib/albums-file");
    const remoteAlbum = album({ id: "r1", artist: "Remote" });
    const repo = fakeGitHub(formatAlbumsFile([remoteAlbum]));
    const { storage, sync } = await launch();
    const localAlbum = album({ id: "l1", artist: "Local" });
    storage.replaceAllAlbums([localAlbum]);
    await sync.connectGitHub(LOCATION);

    const result = await sync.syncWithGitHub();

    expect(result).toEqual({ added: 1, updated: 0, removed: 0, pushed: true });
    expect(storage.getAlbumsSnapshot()).toEqual([remoteAlbum, localAlbum]);
    expect(repo.file?.text).toBe(formatAlbumsFile([localAlbum, remoteAlbum]));
    expect(sync.getGitHubConnection()?.syncedIds).toEqual(["r1", "l1"]);
  });

  it("changes nothing when both sides already agree", async () => {
    const { formatAlbumsFile } = await import("@/lib/albums-file");
    const repo = fakeGitHub(formatAlbumsFile([album()]));
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([album()]);
    await sync.connectGitHub(LOCATION);

    const result = await sync.syncWithGitHub();

    expect(result).toEqual({ added: 0, updated: 0, removed: 0, pushed: false });
    expect(repo.commits).toBe(0);
  });

  it("creates the file when the repository doesn't have it", async () => {
    const repo = fakeGitHub(null);
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([album()]);
    await sync.connectGitHub(LOCATION);

    const result = await sync.syncWithGitHub();

    expect(result.pushed).toBe(true);
    expect(repo.file?.text).toContain('"id": "a1"');
  });

  it("starts over once when the file changes on GitHub meanwhile", async () => {
    const { formatAlbumsFile } = await import("@/lib/albums-file");
    const repo = fakeGitHub(formatAlbumsFile([album()]));
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([
      album({ status: "comingBack", updatedAt: LATER }),
    ]);
    await sync.connectGitHub(LOCATION);
    await sync.syncWithGitHub();
    // The repository's own workflow fills in a cover while this one writes.
    storage.replaceAllAlbums([
      album({ status: "notComingBack", updatedAt: "2026-10-03T00:00:00.000Z" }),
    ]);
    repo.beforeWrite = () => {
      repo.file = {
        text: formatAlbumsFile([
          album({
            status: "comingBack",
            updatedAt: LATER,
            coverUrl: "https://example.com/c.jpg",
          }),
        ]),
        sha: "workflow",
      };
    };

    const result = await sync.syncWithGitHub();

    expect(result.pushed).toBe(true);
    expect(storage.getAlbumsSnapshot()[0]).toMatchObject({
      status: "notComingBack",
      coverUrl: "https://example.com/c.jpg",
    });
  });

  it("gives up when the file keeps changing", async () => {
    const repo = fakeGitHub("[]\n");
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([album()]);
    await sync.connectGitHub(LOCATION);
    repo.alwaysRace = true;

    await expect(sync.syncWithGitHub()).rejects.toMatchObject({
      kind: "conflict",
    });
    expect(repo.commits).toBe(0);
  });

  it("changes nothing when the file has albums it can't read", async () => {
    const repo = fakeGitHub(JSON.stringify([{ title: "No id" }]));
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([album()]);
    await sync.connectGitHub(LOCATION);

    const { AlbumsFileError } = await import("@/lib/albums-file");
    await expect(sync.syncWithGitHub()).rejects.toBeInstanceOf(AlbumsFileError);
    expect(repo.commits).toBe(0);
    expect(storage.getAlbumsSnapshot()).toEqual([album()]);
  });
});

describe("automatic sync", () => {
  const FAST = { delayMs: 10, resumeAfterMs: 0 };

  it("doesn't touch GitHub without a connection", async () => {
    fakeGitHub("[]\n");
    const { sync } = await launch();

    const stop = sync.startAutoSync(FAST);
    await sync.whenGitHubLoaded();
    await new Promise((resolve) => setTimeout(resolve, 30));
    stop();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("syncs on launch, then shortly after each change, and not otherwise", async () => {
    const { formatAlbumsFile } = await import("@/lib/albums-file");
    const repo = fakeGitHub("[]\n");
    const first = await launch();
    first.storage.replaceAllAlbums([album()]);
    await first.sync.connectGitHub(LOCATION);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const { storage, sync } = await launch({ key: first.key });
    const stop = sync.startAutoSync(FAST);
    await vi.waitFor(() =>
      expect(repo.file?.text).toBe(formatAlbumsFile([album()])),
    );

    const changed = album({ status: "comingBack", updatedAt: LATER });
    storage.replaceAllAlbums([changed]);
    await vi.waitFor(() =>
      expect(repo.file?.text).toBe(formatAlbumsFile([changed])),
    );
    await vi.waitFor(() =>
      expect(sync.getGitHubSyncStatus().syncing).toBe(false),
    );
    const commits = repo.commits;
    await new Promise((resolve) => setTimeout(resolve, 50));
    stop();

    expect(repo.commits).toBe(commits);
  });

  it("syncs right after connecting", async () => {
    const repo = fakeGitHub(null);
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([album()]);
    const stop = sync.startAutoSync(FAST);

    await sync.connectGitHub(LOCATION);

    await vi.waitFor(() => expect(repo.file?.text).toContain('"id": "a1"'));
    stop();
  });

  it("keeps an album changed during a sync and sends it next", async () => {
    const { formatAlbumsFile } = await import("@/lib/albums-file");
    const remote = album({ id: "r1", artist: "Remote" });
    const repo = fakeGitHub(formatAlbumsFile([remote]));
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([album()]);
    await sync.connectGitHub(LOCATION);
    const edited = album({ status: "comingBack", updatedAt: LATER });
    repo.beforeWrite = () => storage.replaceAllAlbums([edited]);

    const stop = sync.startAutoSync(FAST);

    await vi.waitFor(() =>
      expect(repo.file?.text).toBe(formatAlbumsFile([edited, remote])),
    );
    await vi.waitFor(() =>
      expect(storage.getAlbumsSnapshot()).toEqual([remote, edited]),
    );
    stop();
  });

  it("keeps a failure for Settings and clears it once a sync works", async () => {
    const repo = fakeGitHub("[]\n");
    const { storage, sync } = await launch();
    storage.replaceAllAlbums([album()]);
    await sync.connectGitHub(LOCATION);
    repo.alwaysRace = true;

    const stop = sync.startAutoSync(FAST);
    await vi.waitFor(() =>
      expect(sync.getGitHubSyncStatus().error).toMatchObject({
        kind: "conflict",
      }),
    );

    repo.alwaysRace = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() =>
      expect(sync.getGitHubSyncStatus()).toEqual({
        syncing: false,
        error: null,
      }),
    );
    stop();
    expect(sync.getServerGitHubSyncStatus()).toEqual({
      syncing: false,
      error: null,
    });
  });

  it("notifies subscribers and shares a running sync", async () => {
    fakeGitHub("[]\n");
    const { sync } = await launch();
    await sync.connectGitHub(LOCATION);
    const listener = vi.fn();
    const unsubscribe = sync.subscribeToGitHubSync(listener);

    const [a, b] = [sync.syncWithGitHub(), sync.syncWithGitHub()];
    expect(a).toBe(b);
    await a;
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
