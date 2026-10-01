import { createInstallPrompt } from "@maat-apps/core/install";

import {
  getSettingsSnapshot,
  markInstalled,
  subscribeToSettings,
} from "../lib/app-settings";

export type { InstallState } from "@maat-apps/core/install";

/** "Install app" state, with the installed flag persisted in app settings. */
export const useInstallPrompt = createInstallPrompt({
  isInstalled: () => getSettingsSnapshot().installed,
  subscribe: subscribeToSettings,
  markInstalled,
});
