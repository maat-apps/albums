import { Gear, Plus } from "@phosphor-icons/react";
import { startTransition, useState } from "react";
import { useNavigate } from "react-router";

import { BottomBar, BottomBarButton } from "@maat-apps/ui/bottom-bar";
import { EmptyState } from "@maat-apps/ui/empty-state";
import { PageTitle } from "@maat-apps/ui/page-header";
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

  // Everything to tap sits in the bottom bar, within the thumb's reach: the
  // status filters, used most, in its main row, sort and view above them.
  return (
    <div className="mx-auto flex min-h-dvh w-[min(100%,480px)] flex-col gap-5 px-5 pt-10">
      <PageTitle>{t("appName")}</PageTitle>
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
      <BottomBar
        above={
          albums.length > 0 && (
            <SortAndViewControls prefs={prefs} onChange={setCollectionPrefs} />
          )
        }
        settings={
          <BottomBarButton
            label={t("settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <Gear />
          </BottomBarButton>
        }
        action={
          <BottomBarButton
            label={t("addAlbum")}
            variant="primary"
            onClick={() => startTransition(() => navigate("/new"))}
          >
            <Plus />
          </BottomBarButton>
        }
      >
        {albums.length > 0 && (
          <StatusFilterChips
            prefs={prefs}
            counts={countByStatus(albums)}
            onChange={setCollectionPrefs}
          />
        )}
      </BottomBar>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
