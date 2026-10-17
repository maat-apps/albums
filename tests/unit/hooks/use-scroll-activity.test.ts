import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollActivity } from "@/hooks/use-scroll-activity";

describe("useScrollActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function scroll() {
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
  }

  it("is idle until the page scrolls", () => {
    const { result } = renderHook(() => useScrollActivity(1000));
    expect(result.current).toBe(false);
  });

  it("is active while scrolling and idle again once it rests", () => {
    const { result } = renderHook(() => useScrollActivity(1000));
    scroll();
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(600));
    scroll();
    act(() => vi.advanceTimersByTime(600));
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe(false);
  });

  it("stops listening once unmounted", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useScrollActivity(1000));
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
