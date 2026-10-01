import { AppLockGate as SharedAppLockGate } from "@maat-apps/ui/app-lock-gate";
import { type ReactNode } from "react";

import { useAppSettings, useSettingsReady } from "../hooks/use-app-settings";
import { useTranslation } from "../i18n/use-translation";
import { appLock } from "../lib/app-lock";

/** @maat-apps/ui's lock screen, wired to this app's lock, settings and copy. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const ready = useSettingsReady();
  const { lock } = useAppSettings();

  return (
    <SharedAppLockGate
      lock={appLock}
      enrolment={lock}
      ready={ready}
      labels={{
        lockedTitle: t("lockedTitle"),
        lockedDescription: t("lockedDescription"),
        unlock: t("unlock"),
        unlockFailed: t("unlockFailed"),
        turnOffLock: t("turnOffLock"),
        eraseDataWarningTitle: t("eraseDataWarningTitle"),
        eraseDataWarningDescription: t("eraseDataWarningDescription"),
        eraseDataConfirm: t("eraseDataConfirm"),
        eraseDataCancel: t("eraseDataCancel"),
      }}
    >
      {children}
    </SharedAppLockGate>
  );
}
