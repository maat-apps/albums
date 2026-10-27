import type { SharedBackupOptions } from "@maat-apps/core/share-target";

// Web Share Target (@maat-apps/core/share-target): an installed Albums shows
// up in Android's share sheet (public/manifest.json's `share_target`), so a
// backup can be sent straight from a cloud drive app. The worker
// (src/sw.ts) parks it here; home takes it and asks before importing.
export const SHARED_BACKUP: SharedBackupOptions = {
  baseUrl: import.meta.env.BASE_URL,
  cacheName: "albums-shared-backup",
};
