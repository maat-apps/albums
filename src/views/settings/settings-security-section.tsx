import { useEffect, useState } from "react";

import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { Switch } from "@maat-apps/ui/switch";
import { useAppSettings } from "../../hooks/use-app-settings";
import { useTranslation } from "../../i18n/use-translation";
import { appLock } from "../../lib/app-lock";

export function SecuritySection() {
  const { t } = useTranslation();
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

  async function toggleAppLock(enabled: boolean) {
    setLockError(false);
    if (!enabled) {
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
    <SettingsSection title={t("sectionSecurity")}>
      <SettingsRow
        title={t("appLock")}
        description={
          lockSupported ? t("appLockDescription") : t("appLockUnsupported")
        }
        action={
          <Switch
            checked={lock !== null}
            disabled={!lockSupported}
            aria-label={t("appLock")}
            onCheckedChange={(checked) => void toggleAppLock(checked)}
          />
        }
      />
      {lockError && (
        <p role="alert" className="text-destructive px-1 text-xs">
          {t("appLockFailed")}
        </p>
      )}
      {lock !== null && (
        <p className="text-muted-foreground px-1 text-xs">
          {lock.encryptionSupported
            ? t("appLockEncryptedNotice")
            : t("appLockNotice")}
        </p>
      )}
    </SettingsSection>
  );
}
