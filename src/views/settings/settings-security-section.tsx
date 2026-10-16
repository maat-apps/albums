import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maat-apps/ui/select";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { Switch } from "@maat-apps/ui/switch";
import { useAppSettings } from "../../hooks/use-app-settings";
import { useTranslation } from "../../i18n/use-translation";
import { appLock } from "../../lib/app-lock";
import {
  RELOCK_CHOICES,
  type RelockAfter,
  setRelockAfter,
} from "../../lib/app-settings";

const RELOCK_LABELS = {
  now: "relockNow",
  "30s": "relock30s",
  close: "relockClose",
} as const satisfies Record<RelockAfter, string>;

export function SecuritySection() {
  const { t } = useTranslation();
  const { lock, relockAfter } = useAppSettings();
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
      {lock !== null && (
        <SettingsRow
          title={t("relockAfter")}
          description={t("relockAfterDescription")}
          action={
            <Select
              value={relockAfter}
              onValueChange={(value) => {
                const choice = RELOCK_CHOICES.find(
                  (option) => option === value,
                );
                if (choice) setRelockAfter(choice);
              }}
            >
              <SelectTrigger
                className="w-auto min-w-26 text-sm"
                aria-label={t("relockAfter")}
              >
                <SelectValue>
                  {(value: RelockAfter) => t(RELOCK_LABELS[value])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RELOCK_CHOICES.map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    {t(RELOCK_LABELS[choice])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}
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
