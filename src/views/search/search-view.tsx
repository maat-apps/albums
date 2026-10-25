import { startTransition, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { BottomBar } from "@maat-apps/ui/bottom-bar";
import { Input } from "@maat-apps/ui/input";
import { useSmartBack } from "@maat-apps/ui/smart-back";
import { useAlbums } from "../../hooks/use-albums";
import { useTranslation } from "../../i18n/use-translation";
import { searchAlbums, sortAlbums } from "../../lib/album-utils";
import { AlbumCollection } from "../home/album-collection";

/**
 * "/search": the collection's albums matching what's typed, as a list with
 * each one's status icon on the right. The field sits in the bottom bar,
 * within the thumb's reach; the query lives in the URL, so coming back from
 * an album finds the same results.
 */
export function SearchView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useSmartBack("/");
  const albums = useAlbums();
  const [params, setParams] = useSearchParams();
  const text = params.get("q") ?? "";
  const query = text.trim();
  const found = useMemo(
    () =>
      query ? sortAlbums(searchAlbums(albums, query), "artist", "asc") : [],
    [albums, query],
  );

  function open(id: string) {
    startTransition(() => navigate(`/${encodeURIComponent(id)}`));
  }

  return (
    <div className="mx-auto flex min-h-dvh w-[min(100%,480px)] flex-col gap-5 px-5 pt-27">
      <AppBar
        title={t("searchCollection")}
        backLabel={t("back")}
        onBack={() => startTransition(back)}
      />
      {!query && (
        <p className="text-muted-foreground m-0 text-sm">
          {t("searchCollectionHint")}
        </p>
      )}
      {query && found.length === 0 && (
        <p className="text-muted-foreground m-0">{t("noSearchMatches")}</p>
      )}
      {found.length > 0 && (
        <AlbumCollection
          albums={found}
          viewMode="list"
          label={t("searchResults")}
          showStatus
          onOpen={open}
        />
      )}
      <BottomBar>
        <Input
          type="search"
          autoFocus
          enterKeyHint="search"
          aria-label={t("searchCollection")}
          placeholder={t("searchCollectionPlaceholder")}
          className="h-14 rounded-2xl px-4 text-base"
          value={text}
          onChange={(event) =>
            setParams(event.target.value ? { q: event.target.value } : {}, {
              replace: true,
            })
          }
        />
      </BottomBar>
    </div>
  );
}
