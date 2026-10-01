import { createTranslation } from "@maat-apps/core/i18n";

import { localeStore } from "../lib/locale-store";

import en from "./en.json";

/**
 * `{ locale, setLocale, t }` — no provider; the locale store is a singleton.
 * `t()` only accepts keys present in every catalog.
 */
export const useTranslation = createTranslation(localeStore, { en });
