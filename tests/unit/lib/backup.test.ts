import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Album } from "@/lib/schemas";
import { resetIndexedDb } from "../reset-indexeddb";

const album: Album = {
  id: "a1",
  year: 1977,
  artist: "Artist",
  title: "Title",
  status: "comingBack",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

async function freshBackup() {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  const backup = await import("@/lib/backup");
  return { storage, backup };
}

beforeEach(async () => {
  await resetIndexedDb();
});

describe("backup", () => {
  it("round-trips the albums through a backup file", async () => {
    const { storage, backup } = await freshBackup();
    storage.saveAlbum(album);
    const text = JSON.stringify(backup.createBackup());
    storage.replaceAllAlbums([]);

    backup.applyBackup(backup.parseBackup(text));

    expect(storage.getAlbumsSnapshot()).toHaveLength(1);
  });

  it("rejects another app's backup and non-JSON text", async () => {
    const { backup } = await freshBackup();
    const other = JSON.stringify({
      app: "notes",
      version: 1,
      exportedAt: "now",
      data: {},
    });

    expect(() => backup.parseBackup(other)).toThrow(backup.BackupError);
    expect(() => backup.parseBackup("nope")).toThrow(backup.BackupError);
  });

  it("treats missing data as no albums", async () => {
    const { backup } = await freshBackup();
    const parsed = backup.parseBackupValue({
      app: "albums",
      version: 1,
      exportedAt: "now",
    });
    expect(parsed.data.albums).toEqual([]);
  });

  it("names the file after the app and date", async () => {
    const { backup } = await freshBackup();
    expect(backup.backupFileName(new Date(2026, 9, 1))).toBe(
      "albums-backup-2026-10-01.txt",
    );
  });

  it("hands the browser a backup file", async () => {
    const { backup } = await freshBackup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let downloaded = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download;
    });

    backup.downloadBackup();

    expect(downloaded).toMatch(/^albums-backup-\d{4}-\d{2}-\d{2}\.txt$/);
    vi.restoreAllMocks();
  });
});
