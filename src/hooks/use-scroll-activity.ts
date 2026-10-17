import { useEffect, useState } from "react";

/**
 * Whether the page scrolled within the last `idleMs` — the fast scroller
 * shows itself while the collection moves and fades out once it rests.
 */
export function useScrollActivity(idleMs: number): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onScroll() {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), idleMs);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [idleMs]);

  return active;
}
