import {
  ListBullets,
  SortAscending,
  SortDescending,
  SquaresFour,
} from "@phosphor-icons/react";

import { Button } from "@maat-apps/ui/button";
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
    <div
      role="group"
      aria-label={t("filterByStatus")}
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4"
    >
      {FILTERS.map((filter) => (
        <Button
          key={filter}
          variant={prefs.statusFilter === filter ? "default" : "outline"}
          className="h-11 shrink-0 rounded-xl"
          aria-pressed={prefs.statusFilter === filter}
          onClick={() => onChange({ statusFilter: filter })}
        >
          {statusLabel[filter]}
          <span className="opacity-70">{counts[filter]}</span>
        </Button>
      ))}
    </div>
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
          className="h-11 min-w-0 flex-1 text-base"
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
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-11 shrink-0"
        aria-label={ascending ? t("sortAscending") : t("sortDescending")}
        onClick={() => onChange({ sortDirection: ascending ? "desc" : "asc" })}
      >
        {ascending ? <SortAscending /> : <SortDescending />}
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-11 shrink-0"
        aria-label={grid ? t("viewGrid") : t("viewList")}
        onClick={() => onChange({ viewMode: grid ? "list" : "grid" })}
      >
        {grid ? <SquaresFour /> : <ListBullets />}
      </Button>
    </div>
  );
}
