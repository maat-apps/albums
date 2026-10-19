import { Gear, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { startTransition, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { BottomBar, BottomBarButton } from "@maat-apps/ui/bottom-bar";
import { Button } from "@maat-apps/ui/button";
import { EmptyState } from "@maat-apps/ui/empty-state";
import { PageTitle } from "@maat-apps/ui/page-header";
import { useAlbums } from "../../hooks/use-albums";
import { useAppSettings } from "../../hooks/use-app-settings";
import { useTranslation } from "../../i18n/use-translation";
import {
  countByStatus,
  filterByStatus,
  groupAlbums,
  sortAlbums,
} from "../../lib/album-utils";
import { setCollectionPrefs } from "../../lib/app-settings";
import { SettingsDrawer } from "../settings/settings-drawer";

import { AlbumCollection } from "./album-collection";
import { SortAndViewControls, StatusFilterChips } from "./collection-controls";
import { FastScroller } from "./fast-scroller";

export function HomeView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const albums = useAlbums();
  const { collection: prefs } = useAppSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shown = useMemo(
    () =>
      sortAlbums(
        filterByStatus(albums, prefs.statusFilters),
        prefs.sortKey,
        prefs.sortDirection,
      ),
    [albums, prefs.statusFilters, prefs.sortKey, prefs.sortDirection],
  );

  const groups = useMemo(
    () => groupAlbums(shown, prefs.sortKey),
    [shown, prefs.sortKey],
  );

  function open(id: string) {
    startTransition(() => navigate(`/${encodeURIComponent(id)}`));
  }

  // The collection's controls sit in the bottom bar, within the thumb's
  // reach: sort and view in its main row, the status filters above them.
  // Settings, used rarely, sits next to the title, pinned to the top.
  return (
    <div className="mx-auto flex min-h-dvh w-[min(100%,480px)] flex-col gap-5 px-5">
      <header
        data-slot="home-header"
        className="bg-background sticky top-0 z-10 -mx-5 flex h-27 shrink-0 items-center justify-between gap-4 px-5"
      >
        <PageTitle>{t("appName")}</PageTitle>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={t("settings")}
          onClick={() => setSettingsOpen(true)}
        >
          <Gear className="size-6" />
        </Button>
      </header>
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
      {shown.length > 0 && (
        <FastScroller groups={groups} label={t("jumpToGroup")} />
      )}
      <BottomBar
        above={
          albums.length > 0 && (
            <StatusFilterChips
              prefs={prefs}
              counts={countByStatus(albums)}
              onChange={setCollectionPrefs}
            />
          )
        }
        action={
          <>
            {albums.length > 0 && (
              <BottomBarButton
                label={t("searchCollection")}
                onClick={() => startTransition(() => navigate("/search"))}
              >
                <MagnifyingGlass />
              </BottomBarButton>
            )}
            <BottomBarButton
              label={t("addAlbum")}
              variant="primary"
              onClick={() => startTransition(() => navigate("/new"))}
            >
              <Plus />
            </BottomBarButton>
          </>
        }
      >
        {albums.length > 0 && (
          <SortAndViewControls prefs={prefs} onChange={setCollectionPrefs} />
        )}
      </BottomBar>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
