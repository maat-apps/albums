import { VinylRecord } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { useCoverSrc } from "../hooks/use-cover-src";
import type { Album } from "../lib/schemas";

/**
 * An album's cover — stored locally once loaded (use-cover-src.ts) — or a
 * placeholder when it has none, it's still loading, or it fails to load.
 */
export function AlbumCover({
  album,
  className,
}: {
  album: Pick<Album, "id" | "coverUrl">;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const src = useCoverSrc(album, container);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const shown = src && src !== failedSrc ? src : null;
  return (
    <div
      ref={container}
      className={`bg-muted text-muted-foreground grid aspect-square place-items-center overflow-hidden rounded-md ${className ?? ""}`}
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
        <VinylRecord aria-hidden="true" className="size-1/3" />
      )}
    </div>
  );
}
