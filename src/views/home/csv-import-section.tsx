import { useRef, useState, type ChangeEvent } from "react";

import { useAlbums } from "../../hooks/use-albums";
import { useTranslation } from "../../i18n/use-translation";
import { countByStatus } from "../../lib/album-utils";
import {
  importAlbumsFromCsv,
  type CsvImportResult,
} from "../../lib/csv-import";
import { addAlbums, getAlbumsSnapshot } from "../../lib/storage";

// "Import from CSV" (PRODUCT.md): the chosen file is read on the device and
// never leaves it. Lives on the starter view until the Settings drawer
// (issue #6) gives it a permanent home in the Data section.
export function CsvImportSection() {
  const { t } = useTranslation();
  const albums = useAlbums();
  const counts = countByStatus(albums);
  const fileInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [failed, setFailed] = useState(false);

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setResult(null);
    setFailed(false);
    try {
      const imported = importAlbumsFromCsv(
        await file.text(),
        getAlbumsSnapshot(),
      );
      addAlbums(imported.albums);
      setResult(imported);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span>
        {t("albumCounts", {
          all: counts.all,
          toListen: counts.toListen,
          comingBack: counts.comingBack,
          notComingBack: counts.notComingBack,
        })}
      </span>
      <button
        type="button"
        className="border-input rounded-lg border px-4 py-2"
        onClick={() => fileInput.current?.click()}
      >
        {t("importCsvAction")}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        aria-label={t("importCsvAction")}
        className="hidden"
        onChange={(event) => void importFile(event)}
      />
      <span aria-live="polite">
        {result &&
          t("importCsvSummary", {
            imported: result.albums.length,
            skipped: result.skipped,
            invalid: result.invalid,
          })}
        {failed && t("importCsvFailed")}
      </span>
    </div>
  );
}
