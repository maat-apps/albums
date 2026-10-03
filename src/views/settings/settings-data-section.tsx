import { startTransition, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";

import { Button } from "@maat-apps/ui/button";
import { ConfirmDrawer } from "@maat-apps/ui/confirm-drawer";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { useTranslation } from "../../i18n/use-translation";
import {
  downloadBackup,
  mergeBackup,
  parseBackup,
  shareBackup,
  type Backup,
} from "../../lib/backup";
import { importAlbumsFromCsv } from "../../lib/csv-import";
import { addAlbums, getAlbumsSnapshot } from "../../lib/storage";

// Backups (export/import) and "Import from CSV" (PRODUCT.md). Files are read
// on the device and never leave it; a CSV import skips albums already in the
// collection, a backup import replaces everything after a confirmation.
export function DataSection({
  onStatus,
}: {
  onStatus: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const csvInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<Backup | null>(null);

  async function exportBackup() {
    onStatus(null);
    const result = await shareBackup();
    if (result === "shared") {
      onStatus(t("exportShared"));
    } else if (result === "unavailable") {
      downloadBackup();
      onStatus(t("exportDone"));
    }
    // "cancelled" — the user dismissed the share sheet; nothing to report.
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onStatus(null);
    try {
      setPendingBackup(parseBackup(await file.text()));
    } catch {
      onStatus(t("importFailed"));
    }
  }

  function confirmBackup() {
    if (!pendingBackup) return;
    mergeBackup(pendingBackup);
    setPendingBackup(null);
    onStatus(t("importDone"));
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-picking the same file after a failed attempt.
    event.target.value = "";
    if (!file) return;
    onStatus(null);
    try {
      const result = importAlbumsFromCsv(
        await file.text(),
        getAlbumsSnapshot(),
      );
      addAlbums(result.albums);
      onStatus(
        t("importCsvSummary", {
          imported: result.albums.length,
          skipped: result.skipped,
          invalid: result.invalid,
        }),
      );
    } catch {
      onStatus(t("importCsvFailed"));
    }
  }

  return (
    <>
      <SettingsSection title={t("sectionData")}>
        <SettingsRow
          title={t("exportData")}
          description={t("exportDataDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => void exportBackup()}
            >
              {t("exportAction")}
            </Button>
          }
        />
        <SettingsRow
          title={t("importData")}
          description={t("importDataDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => backupInput.current?.click()}
            >
              {t("importAction")}
            </Button>
          }
        />
        <input
          ref={backupInput}
          type="file"
          accept="application/json,.json,text/plain,.txt"
          aria-label={t("importData")}
          className="hidden"
          onChange={(event) => void chooseBackup(event)}
        />
        <SettingsRow
          title={t("importCsv")}
          description={t("importCsvDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => csvInput.current?.click()}
            >
              {t("importAction")}
            </Button>
          }
        />
        <input
          ref={csvInput}
          type="file"
          accept=".csv,text/csv"
          aria-label={t("importCsv")}
          className="hidden"
          onChange={(event) => void importCsv(event)}
        />
        <SettingsRow
          title={t("findCovers")}
          description={t("findCoversDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => startTransition(() => navigate("/covers"))}
            >
              {t("openAction")}
            </Button>
          }
        />
        <p className="text-muted-foreground px-1 text-xs">
          {t("coversNotice")}
        </p>
      </SettingsSection>
      <ConfirmDrawer
        open={pendingBackup !== null}
        onOpenChange={(open) => !open && setPendingBackup(null)}
        title={t("importTitle")}
        description={t("importDescription")}
        cancelLabel={t("cancel")}
        confirmLabel={t("importConfirm")}
        onConfirm={confirmBackup}
      />
    </>
  );
}
