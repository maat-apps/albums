import { updateApp as updateAppWith } from "@maat-apps/core/update";

// Settings' "Update app": the service worker never takes over on its own, so
// a new deploy waits until this runs. Once the app keeps data worth keeping,
// pass a pre-update snapshot built on its backup format (createUpdateSnapshot
// from @maat-apps/core/update, as routines and trainer do).

/** Activates the waiting worker, drops every cache, reloads. */
export function updateApp(): Promise<void> {
  return updateAppWith();
}
