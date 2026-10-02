import { type ChangeEvent, useRef } from "react";

import { Button } from "@maat-apps/ui/button";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { useTranslation } from "../../i18n/use-translation";
import { importAlbumsFromCsv } from "../../lib/csv-import";
import { addAlbums, getAlbumsSnapshot } from "../../lib/storage";

// "Import from CSV" (PRODUCT.md): the chosen file is read on the device and
// never leaves it. Albums already in the collection are skipped.
export function DataSection({
  onStatus,
}: {
  onStatus: (message: string | null) => void;
}) {
  const { t } = useTranslation();
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
    <SettingsSection title={t("sectionData")}>
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
    </SettingsSection>
  );
}
