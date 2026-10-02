import { Gear, Plus } from "@phosphor-icons/react";
import { startTransition, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@maat-apps/ui/button";
import { EmptyState } from "@maat-apps/ui/empty-state";
import { FabButton } from "@maat-apps/ui/fab-button";
import { PageHeader } from "@maat-apps/ui/page-header";
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
import { CollectionToolbar } from "./collection-toolbar";

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

  return (
    <div className="mx-auto flex min-h-dvh w-[min(100%,480px)] flex-col gap-5 px-5 pt-27 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <PageHeader>
        <h1 className="font-heading m-0 text-3xl leading-[1.05] font-bold tracking-tight">
          {t("appName")}
        </h1>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={t("settings")}
          onClick={() => setSettingsOpen(true)}
        >
          <Gear className="size-6" />
        </Button>
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
      ) : (
        <>
          <CollectionToolbar
            prefs={prefs}
            counts={countByStatus(albums)}
            onChange={setCollectionPrefs}
          />
          {shown.length === 0 ? (
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
        </>
      )}
      <FabButton
        className="fixed right-[max(20px,calc((100vw-480px)/2+20px))] bottom-[calc(20px+env(safe-area-inset-bottom))] z-20"
        ariaLabel={t("addAlbum")}
        onClick={() => startTransition(() => navigate("/new"))}
      >
        <Plus className="size-6" />
      </FabButton>
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
