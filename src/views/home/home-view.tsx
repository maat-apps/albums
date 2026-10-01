import { useEffect, useState } from "react";

import { useAppSettings } from "../../hooks/use-app-settings";
import { useInstallPrompt } from "../../hooks/use-install-prompt";
import { useTranslation } from "../../i18n/use-translation";
import { appLock } from "../../lib/app-lock";
import { updateApp } from "../../lib/app-update";

// A starting point, not a destination — this app's real Settings screen
// (once it has one) is where install/update actions like these normally
// live; see trainer's or routines' own settings-app-section.tsx and
// settings-security-section.tsx for that pattern once this app is past its
// first view.
export function HomeView() {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  const [updating, setUpdating] = useState(false);
  const { lock } = useAppSettings();
  const [lockSupported, setLockSupported] = useState(false);
  const [lockError, setLockError] = useState(false);

  useEffect(() => {
    let active = true;
    void appLock.isSupported().then((supported) => {
      if (active) setLockSupported(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggleAppLock() {
    setLockError(false);
    if (lock) {
      appLock.disable();
      return;
    }
    try {
      await appLock.enrol();
    } catch {
      // Cancelling the platform prompt lands here too; leave the lock off.
      setLockError(true);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center gap-6 p-8 text-center">
      <h1 className="text-xl">{t("welcome")}</h1>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span>
            {install.state === "installed"
              ? t("installAppInstalled")
              : install.state === "available"
                ? t("installAppDescription")
                : t("installAppUnavailable")}
          </span>
          <button
            type="button"
            className="border-input rounded-lg border px-4 py-2 disabled:opacity-50"
            disabled={install.state !== "available"}
            onClick={() => void install.install()}
          >
            {t("installAppAction")}
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <span>
            {lockSupported ? t("appLockDescription") : t("appLockUnsupported")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={lock !== null}
            className="border-input rounded-lg border px-4 py-2 disabled:opacity-50"
            disabled={!lockSupported}
            onClick={() => void toggleAppLock()}
          >
            {t("appLock")}
          </button>
          {lockError && <span role="alert">{t("appLockFailed")}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <span>{t("updateAppDescription")}</span>
          <button
            type="button"
            className="border-input rounded-lg border px-4 py-2 disabled:opacity-50"
            disabled={updating}
            onClick={() => {
              setUpdating(true);
              void updateApp();
            }}
          >
            {updating ? t("updateAppBusy") : t("updateAppAction")}
          </button>
        </div>
      </div>
    </main>
  );
}
