import { useState } from "react";

import {
  AppSection,
  LanguageSection,
  SecuritySection,
} from "@maat-apps/ui/settings-sections";
import { useInstallPrompt } from "../../hooks/use-install-prompt";
import { useTranslation } from "../../i18n/use-translation";
import { appLock } from "../../lib/app-lock";
import { appSettings } from "../../lib/app-settings";
import { backups } from "../../lib/backup";
import { CollectionSection } from "./settings-collection-section";
import { DataSection } from "./settings-data-section";
import { GitHubSection } from "./settings-github-section";
import { StreamingSection } from "./settings-streaming-section";

// The language, security and app sections are @maat-apps/ui's, as in every
// app; the rest is albums' own.
export function SettingsPanel() {
  const { t, locale, setLocale } = useTranslation();
  const install = useInstallPrompt();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      <LanguageSection
        title={t("language")}
        locale={locale}
        languages={{ pl: "Polski", en: "English" }}
        onLocaleChange={setLocale}
      />
      <CollectionSection />
      <StreamingSection />
      <SecuritySection
        lock={appLock}
        settings={appSettings}
        labels={{
          title: t("sectionSecurity"),
          appLock: t("appLock"),
          appLockDescription: t("appLockDescription"),
          appLockUnsupported: t("appLockUnsupported"),
          appLockFailed: t("appLockFailed"),
          relockAfter: t("relockAfter"),
          relockAfterDescription: t("relockAfterDescription"),
          relockNow: t("relockNow"),
          relock30s: t("relock30s"),
          relockClose: t("relockClose"),
          appLockNotice: t("appLockNotice"),
          appLockEncryptedNotice: t("appLockEncryptedNotice"),
        }}
      />
      <DataSection onStatus={setStatus} />
      <GitHubSection onStatus={setStatus} />
      <AppSection
        install={install}
        updateApp={backups.updateApp}
        restore={{
          snapshot: backups.snapshot,
          labels: {
            title: t("restoreTitle"),
            description: t("restoreDescription"),
            action: t("restoreAction"),
            done: t("restoreDone"),
          },
        }}
        onStatus={setStatus}
        labels={{
          title: t("sectionApp"),
          installApp: t("installApp"),
          installAppDescription: t("installAppDescription"),
          installAppInstalled: t("installAppInstalled"),
          installAppUnavailable: t("installAppUnavailable"),
          installAppAction: t("installAppAction"),
          updateApp: t("updateApp"),
          updateAppDescription: t("updateAppDescription"),
          updateAppAction: t("updateAppAction"),
          updateAppBusy: t("updateAppBusy"),
          updateConfirmTitle: t("updateConfirmTitle"),
          updateConfirmDescription: t("updateConfirmDescription"),
          cancel: t("cancel"),
        }}
      />
      <p aria-live="polite" className="text-muted-foreground px-1 text-sm">
        {status}
      </p>
    </div>
  );
}
