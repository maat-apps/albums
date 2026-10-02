import { ImageSquare, PencilSimple, SpotifyLogo } from "@phosphor-icons/react";
import { startTransition } from "react";
import { useNavigate, useParams } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { Button, buttonVariants } from "@maat-apps/ui/button";
import { useSmartBack } from "@maat-apps/ui/smart-back";
import { AlbumCover } from "../../components/album-cover";
import { MissingAlbum } from "../../components/missing-album";
import { useAlbum, useAlbumsReady } from "../../hooks/use-albums";
import { useTranslation } from "../../i18n/use-translation";
import { spotifySearchUrl } from "../../lib/cover-lookup";
import { setStatus } from "../../lib/storage";

import { StatusPicker } from "./status-picker";

/** "/:id": one album — its cover, details, status and Spotify link. */
export function AlbumView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const ready = useAlbumsReady();
  const album = useAlbum(id);
  const back = useSmartBack("/");

  if (!album) return ready ? <MissingAlbum /> : null;

  return (
    <div className="mx-auto grid min-h-dvh w-[min(100%,480px)] content-start gap-5 px-5 pt-27 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <AppBar
        title={album.title}
        backLabel={t("back")}
        onBack={() => startTransition(back)}
        action={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t("editAlbum")}
            onClick={() =>
              startTransition(() =>
                navigate(`/${encodeURIComponent(album.id)}/edit`),
              )
            }
          >
            <PencilSimple className="size-6" />
          </Button>
        }
      />
      <AlbumCover album={album} className="w-full" />
      <div className="grid gap-1">
        <h2 className="font-heading m-0 text-2xl font-semibold break-words">
          {album.title}
        </h2>
        <p className="text-muted-foreground m-0 text-lg break-words">
          {album.artist}
          {album.year !== null && ` · ${album.year}`}
        </p>
      </div>
      <StatusPicker
        value={album.status}
        onChange={(status) => setStatus(album.id, status)}
      />
      <a
        href={album.spotifyUrl ?? spotifySearchUrl(album)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        <SpotifyLogo aria-hidden="true" />{" "}
        {t(album.spotifyUrl ? "openInSpotify" : "searchOnSpotify")}
      </a>
      {!album.coverUrl && (
        <Button
          variant="outline"
          size="lg"
          onClick={() =>
            startTransition(() =>
              navigate(`/covers/${encodeURIComponent(album.id)}`),
            )
          }
        >
          <ImageSquare aria-hidden="true" /> {t("findCover")}
        </Button>
      )}
    </div>
  );
}
