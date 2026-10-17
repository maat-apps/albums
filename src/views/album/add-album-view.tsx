import { VinylRecord } from "@phosphor-icons/react";
import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { Button } from "@maat-apps/ui/button";
import { Input } from "@maat-apps/ui/input";
import { useSmartBack } from "@maat-apps/ui/smart-back";
import { useAlbums } from "../../hooks/use-albums";
import { useTranslation } from "../../i18n/use-translation";
import { releaseGroupToAlbum } from "../../lib/album-form";
import { sameAlbum } from "../../lib/album-utils";
import {
  coverThumbnailUrl,
  RateLimitedError,
  searchReleaseGroupsByText,
  type ReleaseGroup,
} from "../../lib/musicbrainz";
import { saveAlbum } from "../../lib/storage";

// MusicBrainz allows about one request a second: typing waits this long
// before searching.
const TYPING_PAUSE_MS = 600;
const MIN_QUERY_LENGTH = 2;

type Search =
  | { state: "loading" }
  | { state: "failed"; rateLimited: boolean }
  | { state: "done"; groups: ReleaseGroup[] };

/** A result's cover from the archive; reports when the archive has none. */
function ResultCover({ id, onMissing }: { id: string; onMissing: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="bg-muted text-muted-foreground grid size-16 shrink-0 place-items-center overflow-hidden rounded-none">
      {failed ? (
        <VinylRecord aria-hidden="true" className="size-1/3" />
      ) : (
        <img
          src={coverThumbnailUrl(id)}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => {
            setFailed(true);
            onMissing();
          }}
        />
      )}
    </span>
  );
}

/**
 * "/new": add an album by searching MusicBrainz — tapping a result adds it
 * with its cover and year, or opens it when it's already in the collection.
 */
export function AddAlbumView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useSmartBack("/");
  const albums = useAlbums();
  const [text, setText] = useState("");
  // Tagged with the query it answers, so a stale answer reads as loading.
  const [answer, setAnswer] = useState<{ query: string; search: Search }>();
  const [missingCovers, setMissingCovers] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const query = text.trim();
  const searchable = query.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchReleaseGroupsByText(query, controller.signal).then(
        (groups) => setAnswer({ query, search: { state: "done", groups } }),
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setAnswer({
            query,
            search: {
              state: "failed",
              rateLimited: error instanceof RateLimitedError,
            },
          });
        },
      );
    }, TYPING_PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const search: Search =
    answer?.query === query ? answer.search : { state: "loading" };

  function open(id: string) {
    // Adding is a forward step: the album replaces the search in history.
    startTransition(() =>
      navigate(`/${encodeURIComponent(id)}`, { replace: true }),
    );
  }

  function add(group: ReleaseGroup) {
    const existing = albums.find((album) => sameAlbum(album, group));
    if (existing) {
      open(existing.id);
      return;
    }
    const album = releaseGroupToAlbum(group);
    saveAlbum(
      missingCovers.has(group.id) ? { ...album, coverUrl: undefined } : album,
    );
    open(album.id);
  }

  function markMissingCover(id: string) {
    setMissingCovers((current) => new Set(current).add(id));
  }

  return (
    <div className="mx-auto grid min-h-dvh w-[min(100%,480px)] content-start gap-5 px-5 pt-27 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <AppBar
        title={t("addAlbum")}
        backLabel={t("back")}
        onBack={() => startTransition(back)}
      />
      <Input
        type="search"
        autoFocus
        enterKeyHint="search"
        aria-label={t("searchAlbum")}
        placeholder={t("searchAlbumPlaceholder")}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {!searchable && (
        <p className="text-muted-foreground m-0 text-sm">
          {t("searchAlbumHint")}
        </p>
      )}
      {searchable && search.state === "loading" && (
        <p className="text-muted-foreground m-0">{t("searching")}</p>
      )}
      {searchable && search.state === "failed" && (
        <p className="text-destructive m-0" role="alert">
          {t(search.rateLimited ? "sourceRateLimited" : "sourceUnreachable", {
            source: "MusicBrainz",
          })}
        </p>
      )}
      {searchable && search.state === "done" && search.groups.length === 0 && (
        <p className="text-muted-foreground m-0">{t("noCandidates")}</p>
      )}
      {searchable && search.state === "done" && search.groups.length > 0 && (
        <ul
          className="m-0 grid list-none gap-1 p-0"
          aria-label={t("searchResults")}
        >
          {search.groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center gap-3 rounded-lg p-1.5 text-left"
                onClick={() => add(group)}
              >
                <ResultCover
                  id={group.id}
                  onMissing={() => markMissingCover(group.id)}
                />
                <span className="grid min-w-0 flex-1 text-sm leading-tight">
                  <span className="font-semibold break-words">
                    {group.title}
                  </span>
                  <span className="text-muted-foreground break-words">
                    {group.artist}
                    {group.year !== null && ` · ${group.year}`}
                    {group.primaryType && ` · ${group.primaryType}`}
                  </span>
                  {albums.some((album) => sameAlbum(album, group)) && (
                    <span className="text-primary text-xs font-medium">
                      {t("inCollection")}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        onClick={() => startTransition(() => navigate("/new/manual"))}
      >
        {t("addManually")}
      </Button>
    </div>
  );
}
