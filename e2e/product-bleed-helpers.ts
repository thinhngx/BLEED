import { type Download, type Locator, type Page } from "@playwright/test";

import { appAcceptance, appControlSectionInventory, getToolcraftControlApplicabilityCases, getToolcraftApplicabilityRequirementId } from "../src/app/app-acceptance";
import { appSchema } from "../src/app/app-schema";
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect } from "./toolcraft-product-test";

/** Shared BLEED browser-acceptance helpers; evidence is attached only by the protected helpers these call. */
export const canvasSelector = 'canvas[data-bleed-product=""]';

export type ProofSession = Awaited<ReturnType<typeof createToolcraftBrowserProofSession>>;

/** Minimum stability windows allowed by the protected helpers; software GL makes each raster capture expensive. */
export const quickStability = {
  baselineStabilityIntervalMs: 0,
  baselineStabilitySamples: 2,
  stabilityIntervalMs: 0,
  stabilitySamples: 2,
} as const;

export async function proveProductChange(
  page: Page,
  session: ProofSession,
  target: string,
  requirementId: string,
  action: (control: Locator, page: Page) => Promise<void>,
): Promise<void> {
  const canvas = page.locator(canvasSelector);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction(target, async (control, currentPage) => {
      await action(control, currentPage);
      await settle(canvas);
    }),
    { requirementId, selector: canvasSelector, timeoutMs: 10_000, ...quickStability },
  );
}

/** 0° and 360° are the same angle, so wrapping sliders (and ones whose maximum blanks the artwork) move one page instead. */
export function farKeyFor(target: string): string {
  return /\.(angle|lightAngle|amount|threshold)$/u.test(target) ? "PageUp" : "End";
}

export async function openProofSession(page: Page): Promise<{ canvas: Locator; session: ProofSession }> {
  await page.goto("/");
  const session = await createToolcraftBrowserProofSession(page);
  const canvas = await openBleed(page, { fast: true, navigate: false });
  return { canvas, session };
}

export async function proveSliders(page: Page, session: ProofSession, targets: readonly string[]): Promise<void> {
  for (const target of targets) {
    await proveProductChange(page, session, target, `bleed.${target}`, async (control) => {
      await control.getByRole("slider").press(farKeyFor(target));
    });
  }
}

export async function openBleed(page: Page, options: { fast?: boolean; navigate?: boolean } = {}): Promise<Locator> {
  if (options.navigate !== false) await page.goto("/");
  const canvas = page.locator(canvasSelector);
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-bleed-frame-count")), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await expect(canvas).not.toHaveAttribute("data-bleed-failure", /.+/u);
  if (options.fast) {
    // Software GL is slow at the default render scale; drop to the minimum for per-control checks.
    const before = await frames(canvas);
    await (await getToolcraftControlFieldByTarget(page, "canvas.renderScale")).getByRole("slider").press("Home");
    await waitForNewFrame(canvas, before);
    await settle(canvas);
  }
  return canvas;
}

export async function frames(canvas: Locator): Promise<number> {
  return Number((await canvas.getAttribute("data-bleed-frame-count")) ?? 0);
}

export async function waitForNewFrame(canvas: Locator, before: number): Promise<void> {
  await expect.poll(() => frames(canvas), { timeout: 30_000 }).toBeGreaterThan(before);
  await expect(canvas).not.toHaveAttribute("data-bleed-failure", /.+/u);
}

/** Cheap pixel signature: hash of a downsampled copy of the rendered canvas. */
export async function signature(canvas: Locator): Promise<string> {
  return canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement;
    const small = document.createElement("canvas");
    small.width = 96;
    small.height = 64;
    const context = small.getContext("2d");
    if (!context) return "none";
    context.drawImage(element, 0, 0, 96, 64);
    const { data } = context.getImageData(0, 0, 96, 64);
    let hash = 2_166_136_261;
    for (let index = 0; index < data.length; index += 1) {
      hash = Math.imul(hash ^ (data[index] ?? 0), 16_777_619) >>> 0;
    }
    return `${element.width}x${element.height}:${hash}`;
  });
}

/** Wait until the render frame counter stops advancing, then hash the pixels. */
export async function settle(canvas: Locator): Promise<string> {
  let previous = -1;
  let quiet = 0;
  await expect
    .poll(
      async () => {
        const count = await frames(canvas);
        quiet = count === previous ? quiet + 1 : 0;
        previous = count;
        return quiet >= 2 && count > 0;
      },
      { intervals: [120], timeout: 20_000 },
    )
    .toBe(true);
  return signature(canvas);
}

export const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#000"/></svg>';
export const svgFile = { buffer: Buffer.from(svg), mimeType: "image/svg+xml", name: "dot.svg" };

export function acceptanceId(id: string): string {
  if (!appAcceptance.some((item) => item.id === id)) throw new Error(`Missing acceptance entry ${id}.`);
  return id;
}

export function selectMode(session: ProofSession, value: string) {
  return session.controlAction("source.mode", async (control) => {
    await control.getByText(value === "text" ? "Letters" : "Artwork", { exact: true }).click();
  });
}

/** Proves every applicability case for the target, finishing in `finalMode`; returns the visible-case requirement id. */
export async function proveApplicability(session: ProofSession, target: string, finalMode: "artwork" | "text"): Promise<string> {
  const entry = appAcceptance.find((item) => item.target === target);
  if (!entry) throw new Error(`Missing acceptance entry for ${target}.`);
  const cases = [...getToolcraftControlApplicabilityCases({ schema: appSchema, sectionInventory: appControlSectionInventory, target })]
    .sort((left, right) => Number(left.selectorValue === finalMode) - Number(right.selectorValue === finalMode));
  for (const applicabilityCase of cases) {
    await expectToolcraftControlApplicabilityState(session, selectMode(session, String(applicabilityCase.selectorValue)), applicabilityCase, {
      baseRequirementId: entry.id,
    });
  }
  const visible = cases.find((item) => item.expectation === "visible");
  if (!visible) throw new Error(`No visible applicability case for ${target}.`);
  return getToolcraftApplicabilityRequirementId(entry.id, visible);
}

/** Settle twice in a row with the same pixels, so asynchronous font/artwork decoding has finished. */
export async function settledSignature(canvas: Locator): Promise<string> {
  let previous = await settle(canvas);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await canvas.page().waitForTimeout(250);
    const next = await settle(canvas);
    if (next === previous) return next;
    previous = next;
  }
  return previous;
}

export const blackRgba = [0, 0, 0, 255] as const;
/** Golden 2K PNG of the default BLEED letters (deterministic: identical hash across repeated finite and Infinity exports). */
export const default2kExport = {
  bounds: { height: 0.34375, width: 0.984375, x: 0.015625, y: 0.3125 },
  height: 1365,
  pixels: [
    { rgba: blackRgba, xRatio: 0.5 / 64, yRatio: 0.5 / 64 },
    { rgba: [232, 232, 232, 255], xRatio: 26.5 / 64, yRatio: 32.5 / 64 },
    { rgba: [239, 239, 239, 255], xRatio: 8.5 / 64, yRatio: 32.5 / 64 },
    { rgba: blackRgba, xRatio: 56.5 / 64, yRatio: 32.5 / 64 },
  ],
  width: 2048,
} as const;

export async function chooseOption(page: Page, target: string, option: string): Promise<void> {
  await (await getToolcraftControlFieldByTarget(page, target)).getByRole("combobox").click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function clickExport(page: Page): Promise<Download> {
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: /^Export (PNG|JPG)/u }).click();
  return download;
}

export async function switchTo(field: Locator, on: boolean): Promise<void> {
  const control = field.getByRole("switch");
  if (((await control.getAttribute("aria-checked")) === "true") !== on) await control.click();
  await expect(control).toHaveAttribute("aria-checked", String(on));
}

export async function panViewport(page: Page): Promise<void> {
  const viewport = page.getByRole("application", { name: "Canvas viewport" });
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Canvas viewport has no geometry.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await viewport.focus();
  await page.keyboard.down("Space");
  try {
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 24, { steps: 4 });
  } finally {
    await page.mouse.up();
    await page.keyboard.up("Space");
  }
}

export function observeViewport(session: ProofSession) {
  return session.observe(() => {
    const world = document.querySelector("[data-toolcraft-canvas-world]");
    const output = document.querySelector<HTMLCanvasElement>('canvas[data-bleed-product=""]');
    return {
      offsetX: Number(world?.getAttribute("data-toolcraft-canvas-offset-x") ?? Number.NaN),
      offsetY: Number(world?.getAttribute("data-toolcraft-canvas-offset-y") ?? Number.NaN),
      outputHeight: output?.height ?? 0,
      outputWidth: output?.width ?? 0,
      zoom: Number.parseFloat(world?.getAttribute("data-toolcraft-canvas-zoom") ?? "NaN"),
    };
  });
}

export async function outputSize(canvas: Locator): Promise<{ outputHeight: number; outputWidth: number }> {
  return canvas.evaluate((node) => ({ outputHeight: (node as HTMLCanvasElement).height, outputWidth: (node as HTMLCanvasElement).width }));
}
