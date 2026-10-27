import { startTransition, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router";

import { Button } from "@maat-apps/ui/button";
import { SettingsRow } from "@maat-apps/ui/settings-primitives";
import { DataSection as SharedDataSection } from "@maat-apps/ui/settings-sections";
import { useTranslation } from "../../i18n/use-translation";
import { backups, mergeBackup } from "../../lib/backup";
import { importAlbumsFromCsv } from "../../lib/csv-import";
import { applyImport, getAlbumsSnapshot } from "../../lib/storage";

// Backups (export/import, @maat-apps/ui's DataSection) and this app's own
// rows: "Import from CSV" and "Find covers" (PRODUCT.md). Files are read on
// the device and never leave it; a CSV import adds new albums and updates
// the status of those already in the collection, a backup import merges
// after a confirmation.
export function DataSection({
  onStatus,
}: {
  onStatus: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const csvInput = useRef<HTMLInputElement>(null);

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
      applyImport(result.albums, result.updated);
      onStatus(
        t("importCsvSummary", {
          imported: result.albums.length,
          updated: result.updated.length,
          skipped: result.skipped,
          invalid: result.invalid,
        }),
      );
    } catch {
      onStatus(t("importCsvFailed"));
    }
  }

  return (
    <SharedDataSection
      backups={backups}
      onImport={mergeBackup}
      onStatus={onStatus}
      labels={{
        title: t("sectionData"),
        exportData: t("exportData"),
        exportDataDescription: t("exportDataDescription"),
        exportAction: t("exportAction"),
        exportShared: t("exportShared"),
        exportDone: t("exportDone"),
        importData: t("importData"),
        importDataDescription: t("importDataDescription"),
        importAction: t("importAction"),
        importFailed: t("importFailed"),
        importTitle: t("importTitle"),
        importDescription: t("importDescription"),
        importConfirm: t("importConfirm"),
        importDone: t("importDone"),
        cancel: t("cancel"),
      }}
    >
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
      <p className="text-muted-foreground px-1 text-xs">{t("coversNotice")}</p>
    </SharedDataSection>
  );
}
