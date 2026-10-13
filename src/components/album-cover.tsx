import { VinylRecord } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { useCoverSrc } from "../hooks/use-cover-src";
import type { Album } from "../lib/schemas";

/**
 * An album's cover — stored locally once loaded (use-cover-src.ts) — a
 * pulsing skeleton while it loads or while `searching` for one, or a
 * placeholder when it has none or it fails to load.
 */
export function AlbumCover({
  album,
  searching = false,
  className,
}: {
  album: Pick<Album, "id" | "coverUrl">;
  /** Whether a lookup is still trying to find the album's cover. */
  searching?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const src = useCoverSrc(album, container);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const shown = src && src !== failedSrc ? src : null;
  const loading =
    !shown && (searching || (album.coverUrl !== undefined && !failedSrc));
  return (
    <div
      ref={container}
      aria-busy={loading}
      className={`bg-muted text-muted-foreground grid aspect-square place-items-center overflow-hidden rounded-none ${loading ? "animate-pulse" : ""} ${className ?? ""}`}
    >
      {shown ? (
        <img
          src={shown}
          alt=""
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedSrc(shown)}
        />
      ) : (
        !loading && <VinylRecord aria-hidden="true" className="size-1/3" />
      )}
    </div>
  );
}
