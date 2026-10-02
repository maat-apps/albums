import { type RefObject, useEffect, useState } from "react";

import { loadCover } from "../lib/cover-store";
import type { Album } from "../lib/schemas";

/**
 * The `src` to show for an album's cover: a local object URL once it's
 * stored (cover-store.ts), the remote URL when it can't be stored, `null`
 * while loading or with no cover. Loads only once the element scrolls into
 * view — a collection can hold well over a thousand albums.
 */
export function useCoverSrc(
  album: Pick<Album, "id" | "coverUrl">,
  elementRef: RefObject<Element | null>,
): string | null {
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  const [loaded, setLoaded] = useState<{ url: string; src: string } | null>(
    null,
  );

  useEffect(() => {
    const element = elementRef.current;
    if (visible || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, elementRef]);

  const url = album.coverUrl;
  useEffect(() => {
    if (!visible || !url) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void loadCover({ id: album.id, coverUrl: url }).then((blob) => {
      if (cancelled) return;
      if (blob) objectUrl = URL.createObjectURL(blob);
      setLoaded({ url, src: objectUrl ?? url });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, album.id, url]);

  return loaded && loaded.url === url ? loaded.src : null;
}
