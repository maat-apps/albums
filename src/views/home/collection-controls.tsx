import {
  CheckCircle,
  Headphones,
  SortAscending,
  SortDescending,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";

import {
  BottomBarButton,
  BottomBarChip,
  BottomBarChips,
} from "@maat-apps/ui/bottom-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maat-apps/ui/select";
import { useTranslation } from "../../i18n/use-translation";
import type { SortKey } from "../../lib/album-utils";
import type { CollectionPrefs } from "../../lib/app-settings";
import { ALBUM_STATUSES, type AlbumStatus } from "../../lib/schemas";

const SORT_KEYS: SortKey[] = ["artist", "title", "year"];

// Each status's mark, in its own colour: green for coming back, red for
// not, grey for not listened to yet.
const STATUS_ICONS: Record<AlbumStatus, { icon: Icon; className: string }> = {
  toListen: { icon: Headphones, className: "text-muted-foreground" },
  comingBack: { icon: CheckCircle, className: "text-green-600" },
  notComingBack: { icon: XCircle, className: "text-red-600" },
};

type ToolbarProps = {
  prefs: CollectionPrefs;
  onChange: (changes: Partial<CollectionPrefs>) => void;
};

/**
 * One toggle per status, with its count: the collection shows the albums
 * with any status that's on, or every album while none is.
 */
export function StatusFilterChips({
  prefs,
  counts,
  onChange,
}: ToolbarProps & { counts: Record<AlbumStatus, number> }) {
  const { t } = useTranslation();
  const statusLabel: Record<AlbumStatus, string> = {
    toListen: t("statusToListen"),
    comingBack: t("statusComingBack"),
    notComingBack: t("statusNotComingBack"),
  };

  function toggle(status: AlbumStatus) {
    const chosen = prefs.statusFilters;
    onChange({
      statusFilters: chosen.includes(status)
        ? chosen.filter((other) => other !== status)
        : ALBUM_STATUSES.filter(
            (other) => other === status || chosen.includes(other),
          ),
    });
  }

  return (
    <BottomBarChips label={t("filterByStatus")}>
      {ALBUM_STATUSES.map((status) => {
        const { icon: StatusIcon, className } = STATUS_ICONS[status];
        return (
          <BottomBarChip
            key={status}
            pressed={prefs.statusFilters.includes(status)}
            onClick={() => toggle(status)}
          >
            <StatusIcon
              weight="duotone"
              aria-hidden="true"
              className={`size-6 ${className}`}
            />
            <span className="sr-only">{statusLabel[status]}</span>
            <span className="tabular-nums">{counts[status]}</span>
          </BottomBarChip>
        );
      })}
    </BottomBarChips>
  );
}

/** Sort key and direction; remembered in settings. */
export function SortControls({ prefs, onChange }: ToolbarProps) {
  const { t } = useTranslation();
  const sortLabel: Record<SortKey, string> = {
    artist: t("sortArtist"),
    title: t("sortTitle"),
    year: t("sortYear"),
  };
  const ascending = prefs.sortDirection === "asc";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Select
        value={prefs.sortKey}
        onValueChange={(value) => onChange({ sortKey: value as SortKey })}
      >
        <SelectTrigger
          className="h-14 min-w-0 flex-1 rounded-2xl px-4 text-base"
          aria-label={t("sortBy")}
        >
          <SelectValue>{(value) => sortLabel[value as SortKey]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SORT_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {sortLabel[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <BottomBarButton
        label={ascending ? t("sortAscending") : t("sortDescending")}
        onClick={() => onChange({ sortDirection: ascending ? "desc" : "asc" })}
      >
        {ascending ? <SortAscending /> : <SortDescending />}
      </BottomBarButton>
    </div>
  );
}
