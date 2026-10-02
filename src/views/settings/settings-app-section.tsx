import { useState, useSyncExternalStore } from "react";

import { Button } from "@maat-apps/ui/button";
import { ConfirmDrawer } from "@maat-apps/ui/confirm-drawer";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { useInstallPrompt } from "../../hooks/use-install-prompt";
import { useTranslation } from "../../i18n/use-translation";
import {
  discardUpdateSnapshot,
  hasNoUpdateSnapshotOnServer,
  hasUpdateSnapshot,
  restoreUpdateSnapshot,
  subscribeToUpdateSnapshot,
  updateApp,
} from "../../lib/app-update";

export function AppSection({
  onStatus,
}: {
  onStatus: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const hasSnapshot = useSyncExternalStore(
    subscribeToUpdateSnapshot,
    hasUpdateSnapshot,
    hasNoUpdateSnapshotOnServer,
  );

  async function restore() {
    if (await restoreUpdateSnapshot()) {
      onStatus(t("restoreDone"));
      await discardUpdateSnapshot();
    }
  }

  return (
    <>
      <SettingsSection title={t("sectionApp")}>
        <SettingsRow
          title={t("installApp")}
          description={
            install.state === "installed"
              ? t("installAppInstalled")
              : install.state === "available"
                ? t("installAppDescription")
                : t("installAppUnavailable")
          }
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              disabled={install.state !== "available"}
              onClick={() => void install.install()}
            >
              {t("installAppAction")}
            </Button>
          }
        />
        <SettingsRow
          title={t("updateApp")}
          description={t("updateAppDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              disabled={updating}
              onClick={() => setConfirmUpdate(true)}
            >
              {updating ? t("updateAppBusy") : t("updateAppAction")}
            </Button>
          }
        />
        {hasSnapshot && (
          <SettingsRow
            title={t("restoreTitle")}
            description={t("restoreDescription")}
            action={
              <Button
                variant="outline"
                className="min-h-10.5 px-4"
                onClick={() => void restore()}
              >
                {t("restoreAction")}
              </Button>
            }
          />
        )}
      </SettingsSection>
      <ConfirmDrawer
        open={confirmUpdate}
        onOpenChange={setConfirmUpdate}
        title={t("updateConfirmTitle")}
        description={t("updateConfirmDescription")}
        cancelLabel={t("cancel")}
        confirmLabel={t("updateAppAction")}
        onConfirm={() => {
          setConfirmUpdate(false);
          setUpdating(true);
          void updateApp();
        }}
      />
    </>
  );
}
