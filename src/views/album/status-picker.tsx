import { Button } from "@maat-apps/ui/button";
import { useTranslation } from "../../i18n/use-translation";
import { ALBUM_STATUSES, type AlbumStatus } from "../../lib/schemas";

/** The three statuses as one-tap buttons. */
export function StatusPicker({
  value,
  onChange,
}: {
  value: AlbumStatus;
  onChange: (status: AlbumStatus) => void;
}) {
  const { t } = useTranslation();
  const label: Record<AlbumStatus, string> = {
    toListen: t("statusToListen"),
    comingBack: t("statusComingBack"),
    notComingBack: t("statusNotComingBack"),
  };
  return (
    <div
      role="group"
      aria-label={t("status")}
      className="grid grid-cols-3 gap-2"
    >
      {ALBUM_STATUSES.map((status) => (
        <Button
          key={status}
          type="button"
          variant={value === status ? "default" : "outline"}
          className="h-auto min-h-11 px-2 py-2 text-sm whitespace-normal"
          aria-pressed={value === status}
          onClick={() => onChange(status)}
        >
          {label[status]}
        </Button>
      ))}
    </div>
  );
}
