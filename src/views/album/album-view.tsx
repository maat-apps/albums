import {
  AppleLogo,
  Equalizer,
  ImageSquare,
  PencilSimple,
  SpotifyLogo,
  type Icon,
} from "@phosphor-icons/react";
import { startTransition, useLayoutEffect } from "react";
import { useNavigate, useParams } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { Button, buttonVariants } from "@maat-apps/ui/button";
import { useSmartBack } from "@maat-apps/ui/smart-back";
import { AlbumCover } from "../../components/album-cover";
import { MissingAlbum } from "../../components/missing-album";
import { useAlbumLookup } from "../../hooks/use-album-lookup";
import { useAlbum, useAlbumsReady } from "../../hooks/use-albums";
import { useAppSettings } from "../../hooks/use-app-settings";
import { useTranslation } from "../../i18n/use-translation";
import { setStatus } from "../../lib/storage";
import { linkTo, type StreamingService } from "../../lib/streaming";

import { StatusPicker } from "./status-picker";

// Each service's mark: Phosphor has Spotify's and Apple's; Deezer's
// equalizer bars stand in for its logo.
const SERVICE_ICONS: Record<StreamingService, Icon> = {
  deezer: Equalizer,
  spotify: SpotifyLogo,
  appleMusic: AppleLogo,
};

const OPEN_LABELS = {
  deezer: "openInDeezer",
  spotify: "openInSpotify",
  appleMusic: "openInAppleMusic",
} as const satisfies Record<StreamingService, string>;

/**
 * "/:id": one album — its cover, details, status and a link to the user's
 * streaming service, all on one screen without scrolling: the cover takes
 * the room the rest leaves, as the largest square that fits. A missing
 * cover or link is looked up as soon as it opens.
 */
export function AlbumView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const ready = useAlbumsReady();
  const album = useAlbum(id);
  const back = useSmartBack("/");
  const { streamingService } = useAppSettings();
  const searching = useAlbumLookup(album);

  // The page scroll carries over from the collection; this screen fits
  // without scrolling, so it starts at the top with the whole cover.
  useLayoutEffect(() => window.scrollTo(0, 0), [id]);

  if (!album) return ready ? <MissingAlbum /> : null;
  const link = linkTo(album, streamingService);
  const ServiceIcon = SERVICE_ICONS[streamingService];

  return (
    <div className="mx-auto flex h-dvh w-[min(100%,480px)] flex-col gap-5 px-5 pt-27 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <AppBar
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
      {/* A square size container as wide as the column, shrinking when the
          rest needs the height: the cover is the largest square inside. */}
      <div className="[container-type:size] grid aspect-square min-h-0 w-full place-items-center">
        <AlbumCover
          album={album}
          searching={searching && !album.coverUrl}
          className="size-[min(100cqw,100cqh)]"
        />
      </div>
      <div className="grid gap-1">
        <h2 className="font-heading m-0 line-clamp-2 text-2xl font-semibold break-words">
          {album.title}
        </h2>
        <p className="text-muted-foreground m-0 line-clamp-2 text-lg break-words">
          {album.artist}
          {album.year !== null && ` · ${album.year}`}
        </p>
      </div>
      <StatusPicker
        value={album.status}
        onChange={(status) => setStatus(album.id, status)}
      />
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <ServiceIcon aria-hidden="true" /> {t(OPEN_LABELS[streamingService])}
        </a>
      ) : (
        searching && (
          // Where the link's button will be, while it's looked for.
          <span
            data-testid="link-skeleton"
            aria-hidden="true"
            className={`${buttonVariants({ variant: "outline", size: "lg" })} bg-muted animate-pulse border-transparent text-transparent`}
          >
            {t(OPEN_LABELS[streamingService])}
          </span>
        )
      )}
      {!album.coverUrl && !searching && (
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
