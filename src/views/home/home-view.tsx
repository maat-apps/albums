import { Gear, Plus } from "@phosphor-icons/react";
import { startTransition, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@maat-apps/ui/button";
import { EmptyState } from "@maat-apps/ui/empty-state";
import { PageHeader, PageTitle } from "@maat-apps/ui/page-header";
import { useAlbums } from "../../hooks/use-albums";
import { useAppSettings } from "../../hooks/use-app-settings";
import { useTranslation } from "../../i18n/use-translation";
import {
  countByStatus,
  filterByStatus,
  sortAlbums,
} from "../../lib/album-utils";
import { setCollectionPrefs } from "../../lib/app-settings";
import { SettingsDrawer } from "../settings/settings-drawer";

import { AlbumCollection } from "./album-collection";
import { SortAndViewControls, StatusFilterChips } from "./collection-controls";

export function HomeView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const albums = useAlbums();
  const { collection: prefs } = useAppSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shown = sortAlbums(
    filterByStatus(albums, prefs.statusFilter),
    prefs.sortKey,
    prefs.sortDirection,
  );

  function open(id: string) {
    startTransition(() => navigate(`/${encodeURIComponent(id)}`));
  }

  // Everything to tap sits in the bottom bar, within the thumb's reach; the
  // top is only the title.
  return (
    <div className="mx-auto flex min-h-dvh w-[min(100%,480px)] flex-col gap-5 px-5 pt-27 pb-[calc(144px+env(safe-area-inset-bottom))]">
      <PageHeader>
        <PageTitle>{t("appName")}</PageTitle>
      </PageHeader>
      {albums.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={{
            label: t("importCsv"),
            onClick: () => setSettingsOpen(true),
            variant: "outline",
          }}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          title={t("noMatchesTitle")}
          description={t("noMatchesDescription")}
        />
      ) : (
        <AlbumCollection
          albums={shown}
          viewMode={prefs.viewMode}
          label={t("collection")}
          onOpen={open}
        />
      )}
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur">
        <div className="mx-auto grid w-[min(100%,480px)] gap-2 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          {albums.length > 0 && (
            <StatusFilterChips
              prefs={prefs}
              counts={countByStatus(albums)}
              onChange={setCollectionPrefs}
            />
          )}
          <div className="flex items-center gap-1">
            {albums.length > 0 && (
              <SortAndViewControls
                prefs={prefs}
                onChange={setCollectionPrefs}
              />
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              className="ml-auto"
              aria-label={t("settings")}
              onClick={() => setSettingsOpen(true)}
            >
              <Gear className="size-5" />
            </Button>
            <Button
              size="icon-lg"
              className="size-11 rounded-2xl"
              aria-label={t("addAlbum")}
              onClick={() => startTransition(() => navigate("/new"))}
            >
              <Plus className="size-6" />
            </Button>
          </div>
        </div>
      </div>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
