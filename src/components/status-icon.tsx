import {
  CheckCircle,
  Headphones,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";

import { useTranslation } from "../i18n/use-translation";
import type { AlbumStatus } from "../lib/schemas";

// Each status's mark, in its own colour: green for coming back, red for
// not, grey for not listened to yet.
const STATUS_ICONS: Record<AlbumStatus, { icon: Icon; className: string }> = {
  toListen: { icon: Headphones, className: "text-muted-foreground" },
  comingBack: { icon: CheckCircle, className: "text-green-600" },
  notComingBack: { icon: XCircle, className: "text-red-600" },
};

/** A status's duotone icon, named for screen readers. */
export function StatusIcon({
  status,
  className = "",
}: {
  status: AlbumStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const label: Record<AlbumStatus, string> = {
    toListen: t("statusToListen"),
    comingBack: t("statusComingBack"),
    notComingBack: t("statusNotComingBack"),
  };
  const { icon: Mark, className: colour } = STATUS_ICONS[status];
  return (
    <>
      <Mark
        weight="duotone"
        aria-hidden="true"
        className={`${colour} ${className}`}
      />
      <span className="sr-only">{label[status]}</span>
    </>
  );
}
