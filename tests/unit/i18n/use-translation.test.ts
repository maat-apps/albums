import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The locale store is a module-level singleton; a fresh module per test
// keeps one test's setLocale() from leaking into the next.
async function freshUseTranslation() {
  vi.resetModules();
  return import("@/i18n/use-translation");
}

describe("useTranslation", () => {
  it("translates from the current locale's catalog", async () => {
    const { useTranslation } = await freshUseTranslation();
    const { result } = renderHook(() => useTranslation());

    expect(result.current.locale).toBe("en");
    expect(result.current.t("welcome")).toBe("Welcome");
  });

  it("re-renders after setLocale", async () => {
    const { useTranslation } = await freshUseTranslation();
    const { result } = renderHook(() => useTranslation());

    act(() => result.current.setLocale("en"));

    expect(result.current.t("updateApp")).toBe("Update app");
  });
});
