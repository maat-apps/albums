import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("splits plain rows and fields", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps commas, quotes and line breaks inside quoted fields", () => {
    expect(parseCsv('"x, y","say ""hi""","two\nlines"')).toEqual([
      ["x, y", 'say "hi"', "two\nlines"],
    ]);
  });

  it("handles CRLF, a BOM, a trailing newline and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n\r\nc,\r\n")).toEqual([
      ["a", "b"],
      ["c", ""],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("is empty for empty text", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
