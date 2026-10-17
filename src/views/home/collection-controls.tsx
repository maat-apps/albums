import {
  ListBullets,
  SortAscending,
  SortDescending,
  SquaresFour,
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
import type { SortKey, StatusFilter } from "../../lib/album-utils";
import type { CollectionPrefs } from "../../lib/app-settings";

const FILTERS: StatusFilter[] = [
  "all",
  "toListen",
  "comingBack",
  "notComingBack",
];
const SORT_KEYS: SortKey[] = ["artist", "title", "year"];

type ToolbarProps = {
  prefs: CollectionPrefs;
  onChange: (changes: Partial<CollectionPrefs>) => void;
};

/** One chip per status, with its count; remembered in settings. */
export function StatusFilterChips({
  prefs,
  counts,
  onChange,
}: ToolbarProps & { counts: Record<StatusFilter, number> }) {
  const { t } = useTranslation();
  const statusLabel: Record<StatusFilter, string> = {
    all: t("statusAll"),
    toListen: t("statusToListen"),
    comingBack: t("statusComingBack"),
    notComingBack: t("statusNotComingBack"),
  };

  return (
    <BottomBarChips label={t("filterByStatus")}>
      {FILTERS.map((filter) => (
        <BottomBarChip
          key={filter}
          pressed={prefs.statusFilter === filter}
          onClick={() => onChange({ statusFilter: filter })}
        >
          {statusLabel[filter]}
          <span className="opacity-70">{counts[filter]}</span>
        </BottomBarChip>
      ))}
    </BottomBarChips>
  );
}

/** Sort key and direction, grid or list; remembered in settings. */
export function SortAndViewControls({ prefs, onChange }: ToolbarProps) {
  const { t } = useTranslation();
  const sortLabel: Record<SortKey, string> = {
    artist: t("sortArtist"),
    title: t("sortTitle"),
    year: t("sortYear"),
  };
  const ascending = prefs.sortDirection === "asc";
  const grid = prefs.viewMode === "grid";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Select
        value={prefs.sortKey}
        onValueChange={(value) => onChange({ sortKey: value as SortKey })}
      >
        <SelectTrigger
          className="h-14 min-w-0 flex-1 rounded-2xl text-base"
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
      <BottomBarButton
        label={grid ? t("viewGrid") : t("viewList")}
        onClick={() => onChange({ viewMode: grid ? "list" : "grid" })}
      >
        {grid ? <SquaresFour /> : <ListBullets />}
      </BottomBarButton>
    </div>
  );
}
