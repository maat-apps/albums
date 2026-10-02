import { VinylRecord } from "@phosphor-icons/react";
import { useState } from "react";

import type { Album } from "../lib/schemas";

/**
 * An album's cover, or a placeholder when it has none or it fails to load.
 * Lazy-loaded: a collection can hold well over a thousand albums.
 */
export function AlbumCover({
  album,
  className,
}: {
  album: Pick<Album, "coverUrl">;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url =
    album.coverUrl && album.coverUrl !== failedUrl ? album.coverUrl : null;
  return (
    <div
      className={`bg-muted text-muted-foreground grid aspect-square place-items-center overflow-hidden rounded-md ${className ?? ""}`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <VinylRecord aria-hidden="true" className="size-1/3" />
      )}
    </div>
  );
}
