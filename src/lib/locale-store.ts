import { createLocaleStore } from "@maat-apps/core/locale";

import { keyValueStore } from "./idb-store";
import { LOCALE_KEY } from "./storage-keys";

// The React-free half of i18n: first launch picks the device language (if
// supported), then the stored choice always wins. Add a locale here and a
// matching catalog in src/i18n/.
const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const localeStore = createLocaleStore<Locale>({
  locales: LOCALES,
  fallbackLocale: DEFAULT_LOCALE,
  storage: keyValueStore,
  storageKey: LOCALE_KEY,
});
