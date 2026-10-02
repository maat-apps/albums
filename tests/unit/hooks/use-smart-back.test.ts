import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import { useSmartBack } from "@/hooks/use-smart-back";

function useSmartBackWithLocation(fallback: string) {
  return { back: useSmartBack(fallback), location: useLocation() };
}

// No JSX here: the router wrapper is built with createElement.
function renderAt(
  initialEntries: string[],
  initialIndex: number,
  fallback: string,
) {
  return renderHook(() => useSmartBackWithLocation(fallback), {
    wrapper: ({ children }) =>
      createElement(MemoryRouter, { initialEntries, initialIndex }, children),
  });
}

describe("useSmartBack", () => {
  it('replaces to the fallback on a fresh/deep-linked load (location.key is "default")', () => {
    const { result } = renderAt(["/n1"], 0, "/");
    expect(result.current.location.key).toBe("default");

    act(() => result.current.back());

    expect(result.current.location.pathname).toBe("/");
  });

  it("pops real history when the current location was pushed within the app", () => {
    const { result } = renderAt(["/", "/n1"], 1, "/");
    expect(result.current.location.key).not.toBe("default");

    act(() => result.current.back());

    expect(result.current.location.pathname).toBe("/");
  });
});
