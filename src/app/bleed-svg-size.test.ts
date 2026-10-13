import { describe, expect, it } from "vitest";

import { sizeBleedSvg } from "./bleed-render";

describe("sizeBleedSvg", () => {
  it("gives a viewBox-only SVG a 4096px natural size on its long side", () => {
    const out = sizeBleedSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><path d="M0 0h1"/></svg>');
    expect(out).toContain('width="4096"');
    expect(out).toContain('height="2048"');
    expect(out).toContain('viewBox="0 0 200 100"');
  });

  it("replaces existing size attributes and derives a viewBox when missing", () => {
    const out = sizeBleedSvg('<svg width="50px" height="100" xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    expect(out).toMatch(/^<svg width="2048" height="4096" viewBox="0 0 50 100"/u);
    expect(out).not.toContain('"50px"');
  });

  it("leaves SVGs without measurable size untouched", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="100%"><rect/></svg>';
    expect(sizeBleedSvg(source)).toBe(source);
  });
});
