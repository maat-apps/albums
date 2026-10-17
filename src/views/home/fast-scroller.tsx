import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useScrollActivity } from "../../hooks/use-scroll-activity";
import type { AlbumGroup } from "../../lib/album-utils";

/** Shown only once the collection is at least this many screens tall. */
const MIN_SCREENS = 4;
/** How long the rail stays after the collection stops moving. */
const IDLE_MS = 1500;
/** The thumb's hit area height, in px (h-14). */
const THUMB_HEIGHT = 56;
/** Gap between the rail and the safe area above / the bottom bar below. */
const RAIL_GAP = 16;
/** A group counts as current once its first album is this close to the top. */
const CURRENT_LINE = 80;

function albumElement(index: number): HTMLElement | null {
  return document.querySelector(`[data-album-index="${index}"]`);
}

function currentGroup(groups: AlbumGroup[]): number {
  // The last groups may never reach the top line: at the very bottom, the
  // rail sits at its end.
  const atBottom =
    window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 1;
  if (atBottom && window.scrollY > 0) return groups.length - 1;
  let current = 0;
  groups.forEach((group, index) => {
    const top = albumElement(group.firstIndex)?.getBoundingClientRect().top;
    if (top !== undefined && top <= CURRENT_LINE) current = index;
  });
  return current;
}

function jumpTo(group: AlbumGroup) {
  const element = albumElement(group.firstIndex);
  if (!element) return;
  window.scrollTo({
    top: element.getBoundingClientRect().top + window.scrollY - RAIL_GAP,
  });
}

/**
 * A rail along the collection's right side, as in Google Photos: it shows
 * while the collection moves, and dragging its thumb jumps from group to
 * group (`groupAlbums`), naming the group in a bubble and buzzing at each
 * change. Kept off the very edge for Android's back gesture and above the
 * bottom bar.
 */
export function FastScroller({
  groups,
  label,
}: {
  groups: AlbumGroup[];
  label: string;
}) {
  const scrolling = useScrollActivity(IDLE_MS);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [current, setCurrent] = useState(0);
  const [longEnough, setLongEnough] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);
  const index = Math.min(current, groups.length - 1);

  useLayoutEffect(() => {
    function measure() {
      setLongEnough(
        document.documentElement.scrollHeight >=
          window.innerHeight * MIN_SCREENS,
      );
      setBarHeight(
        document.querySelector<HTMLElement>("[data-slot=bottom-bar]")
          ?.offsetHeight ?? 0,
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    function follow() {
      if (dragIndex.current === null) setCurrent(currentGroup(groups));
    }
    follow();
    window.addEventListener("scroll", follow, { passive: true });
    return () => window.removeEventListener("scroll", follow);
  }, [groups]);

  if (!longEnough || groups.length < 2) return null;

  function select(next: number) {
    if (next === dragIndex.current) return;
    dragIndex.current = next;
    setCurrent(next);
    if ("vibrate" in navigator) navigator.vibrate(10);
    jumpTo(groups[next]);
  }

  function groupAt(clientY: number): number {
    const rail = railRef.current?.getBoundingClientRect();
    if (!rail) return index;
    const ratio =
      (clientY - rail.top - THUMB_HEIGHT / 2) / (rail.height - THUMB_HEIGHT);
    return Math.round(Math.min(1, Math.max(0, ratio)) * (groups.length - 1));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragIndex.current = index;
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging) select(groupAt(event.clientY));
  }

  function onPointerEnd() {
    dragIndex.current = null;
    setDragging(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: groups.length - 1,
    };
    const next = steps[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const clamped = Math.min(groups.length - 1, Math.max(0, next));
    setCurrent(clamped);
    jumpTo(groups[clamped]);
  }

  const visible = scrolling || dragging || focused;
  const position = index / (groups.length - 1);

  return (
    <div
      ref={railRef}
      data-visible={visible}
      className="pointer-events-none fixed right-4 z-10 w-11 opacity-0 transition-opacity duration-300 data-[visible=true]:opacity-100 motion-reduce:transition-none"
      style={{
        top: `calc(env(safe-area-inset-top) + ${RAIL_GAP}px)`,
        bottom: barHeight + RAIL_GAP,
      }}
    >
      <div className="bg-foreground/15 absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full" />
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={groups.length - 1}
        aria-valuenow={index}
        aria-valuetext={groups[index].label}
        className="absolute inset-x-0 flex h-14 touch-none items-center justify-center outline-none in-data-[visible=true]:pointer-events-auto"
        style={{ top: `calc(${position} * (100% - ${THUMB_HEIGHT}px))` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <span className="bg-foreground h-10 w-1.5 rounded-full" />
        {(dragging || focused) && (
          <span className="bg-primary text-primary-foreground absolute right-14 flex h-14 min-w-14 items-center justify-center rounded-2xl px-4 text-2xl font-semibold whitespace-nowrap tabular-nums shadow-lg">
            {groups[index].label}
          </span>
        )}
      </div>
    </div>
  );
}
