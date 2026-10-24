import { AlbumCover } from "../../components/album-cover";
import { StatusIcon } from "../../components/status-icon";
import type { ViewMode } from "../../lib/app-settings";
import type { Album } from "../../lib/schemas";

/** Two columns of covers, artist and title under each. */
function AlbumGrid({
  albums,
  onOpen,
}: {
  albums: Album[];
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-4 p-0">
      {albums.map((album, index) => (
        <li key={album.id} data-album-index={index}>
          <button
            type="button"
            className="grid w-full gap-1.5 text-left"
            onClick={() => onOpen(album.id)}
          >
            <AlbumCover album={album} />
            <span className="grid min-w-0 text-sm leading-tight">
              <span className="truncate font-semibold">{album.title}</span>
              <span className="text-muted-foreground truncate">
                {album.artist}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One row per album: thumbnail, title, artist and year — plus its status's
 * icon at the right edge with `showStatus`.
 */
function AlbumList({
  albums,
  showStatus,
  onOpen,
}: {
  albums: Album[];
  showStatus: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {albums.map((album, index) => (
        <li key={album.id} data-album-index={index}>
          <button
            type="button"
            className="hover:bg-muted flex w-full items-center gap-3 rounded-lg p-1.5 text-left"
            onClick={() => onOpen(album.id)}
          >
            <AlbumCover album={album} className="size-14 shrink-0" />
            <span className="grid min-w-0 flex-1 text-sm leading-tight">
              <span className="truncate font-semibold">{album.title}</span>
              <span className="text-muted-foreground truncate">
                {album.artist}
              </span>
            </span>
            {album.year !== null && (
              <span className="text-muted-foreground text-sm tabular-nums">
                {album.year}
              </span>
            )}
            {showStatus && (
              <StatusIcon status={album.status} className="size-6 shrink-0" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AlbumCollection({
  albums,
  viewMode,
  label,
  showStatus = false,
  onOpen,
}: {
  albums: Album[];
  viewMode: ViewMode;
  label: string;
  showStatus?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section aria-label={label}>
      {viewMode === "grid" ? (
        <AlbumGrid albums={albums} onOpen={onOpen} />
      ) : (
        <AlbumList albums={albums} showStatus={showStatus} onOpen={onOpen} />
      )}
    </section>
  );
}
