import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Locator, type Page } from "@playwright/test";
import { expectToolcraftSegmentedControlCellsPreservePadding } from "./performance-control-layout-helpers";
import { expectToolcraftCompoundControlPartOutcome, expectToolcraftMediaLifecycle } from "./browser-state-evidence-helpers";
import { expect, test } from "./toolcraft-product-test";
import {
  proveProductChange,
  openProofSession,
  proveSliders,
  frames,
  waitForNewFrame,
  svgFile,
  acceptanceId,
  proveApplicability,
  settledSignature,
} from "./product-bleed-helpers";

test("browser acceptance: BLEED source", async ({ page }) => {
  const { session } = await openProofSession(page);
  const textVisibleId = await proveApplicability(session, "source.text", "artwork");
  await proveProductChange(page, session, "source.mode", acceptanceId("bleed.source.mode"), async (control) => {
    await control.getByText("Letters", { exact: true }).click();
  });
  await expectToolcraftSegmentedControlCellsPreservePadding(page, "Mode", { requirementId: "bleed.source.mode", target: "source.mode" });
  await expectToolcraftSegmentedControlCellsPreservePadding(page, "Rotate", { requirementId: "bleed.source.rotate", target: "source.rotate" });
  await proveProductChange(page, session, "source.text", textVisibleId, async (control) => {
    await control.locator("textarea").fill("BLEED EVIDENCE");
  });
  await proveProductChange(page, session, "source.rotate", acceptanceId("bleed.source.rotate"), async (control) => {
    await control.getByText("90°", { exact: true }).click();
  });
  await proveSliders(page, session, ["source.shiftX", "source.shiftY"]);
});

test("browser acceptance: BLEED source font", async ({ page }) => {
  const { session } = await openProofSession(page);
  const fontVisibleId = await proveApplicability(session, "source.font", "text");
  const fontId = acceptanceId("bleed.source.font");
  const qualifier = fontVisibleId.slice(fontId.length);
  const closePopover = async (currentPage: Page) => {
    if (await currentPage.getByPlaceholder("Find font").isVisible()) await currentPage.keyboard.press("Escape");
    await expect(currentPage.getByPlaceholder("Find font")).toBeHidden();
  };
  const commitInput = async (control: Locator, currentPage: Page, label: string, value: string) => {
    await closePopover(currentPage);
    const input = control.getByRole("textbox", { name: label });
    await input.fill(value);
    await input.press("Enter");
  };
  await proveProductChange(page, session, "source.font", fontVisibleId, (control, currentPage) => commitInput(control, currentPage, "Font size", "200"));

  const observations = {
    fontId: session.observe((root) => root.querySelector<HTMLElement>('[data-toolcraft-control-target="source.font"] [data-slot=font-picker-trigger-value]')?.textContent?.trim() ?? ""),
    fontWeight: session.observe((root) => root.querySelector<HTMLElement>('[data-toolcraft-control-target="source.font"] [aria-label="Font weight"]')?.textContent?.replace("▼", "").trim() ?? ""),
    fontSize: session.observe((root) => root.querySelector<HTMLInputElement>('[data-toolcraft-control-target="source.font"] [aria-label="Font size"]')?.value ?? ""),
    letterSpacing: session.observe(() => {
      const input = document.querySelector<HTMLInputElement>('input[type="range"][aria-label="Letter spacing"]');
      return input ? Number(input.value) : null;
    }),
    lineHeight: session.observe(() => {
      const input = document.querySelector<HTMLInputElement>('input[type="range"][aria-label="Line height"]');
      return input ? Number(input.value) : null;
    }),
    textCase: session.observe((root) => root.querySelector<HTMLElement>('[data-toolcraft-control-target="source.font"] [aria-label="Text case"]')?.textContent?.replace("▼", "").trim() ?? ""),
    color: session.observe((root) => root.querySelector<HTMLInputElement>('[data-toolcraft-control-target="source.font"] [aria-label="Color hex"]')?.value ?? ""),
    opacity: session.observe((root) => root.querySelector<HTMLInputElement>('[data-toolcraft-control-target="source.font"] [aria-label="Color opacity"]')?.value ?? ""),
  };
  const provePart = async <T,>(part: keyof typeof observations, expected: T, act: (control: Locator, currentPage: Page) => Promise<void>) => {
    await expectToolcraftCompoundControlPartOutcome(
      observations[part] as never,
      session.controlAction("source.font", act),
      expected as never,
      { requirementId: fontId, part: `fontPicker.${part}${qualifier}`, stabilityIntervalMs: 0, stabilitySamples: 2, timeoutMs: 8_000 },
    );
  };
  const pickOption = async (control: Locator, currentPage: Page, label: string, option: string) => {
    await closePopover(currentPage);
    await control.getByRole("combobox", { name: label }).click();
    await currentPage.getByRole("option", { name: option, exact: true }).click();
  };
  const openPicker = async (control: Locator, currentPage: Page) => {
    if (!(await currentPage.getByPlaceholder("Find font").isVisible())) await control.getByRole("button", { name: "Select Font" }).click();
  };

  await provePart("fontWeight", "400", (control, currentPage) => pickOption(control, currentPage, "Font weight", "400"));
  await provePart("fontId", "Inter Tight", async (control, currentPage) => {
    await openPicker(control, currentPage);
    await currentPage.getByPlaceholder("Find font").fill("Inter Tight");
    await currentPage.locator('[data-slot="font-picker-option"]').filter({ hasText: "Inter Tight" }).first().click();
  });
  for (const part of ["letterSpacing", "lineHeight"] as const) {
    const name = part === "letterSpacing" ? "Letter spacing" : "Line height";
    await openPicker(page.locator('[data-toolcraft-control-target="source.font"]'), page);
    const sliderHandle = page.getByRole("slider", { name });
    const { max, min, now } = await sliderHandle.evaluate((node) => {
      const input = node as HTMLInputElement;
      return { max: Number(input.max), min: Number(input.min), now: Number(input.value) };
    });
    const [key, expected] = now === max ? ["Home", min] : ["End", max];
    await provePart(part, expected, async (control, currentPage) => {
      await openPicker(control, currentPage);
      await currentPage.getByRole("slider", { name }).press(key);
    });
  }
  await provePart("fontSize", "300", (control, currentPage) => commitInput(control, currentPage, "Font size", "300"));
  await provePart("textCase", "Uppercase", (control, currentPage) => pickOption(control, currentPage, "Text case", "Uppercase"));
  await provePart("color", "#FF0000", (control, currentPage) => commitInput(control, currentPage, "Color hex", "#FF0000"));
  await provePart("opacity", "80", (control, currentPage) => commitInput(control, currentPage, "Color opacity", "80"));
});

test("browser acceptance: BLEED source artwork", async ({ page }) => {
  const { canvas, session } = await openProofSession(page);
  const channelVisibleId = await proveApplicability(session, "source.artChannel", "artwork");
  const fitVisibleId = await proveApplicability(session, "source.artFit", "artwork");
  const before = await frames(canvas);
  await page.locator('[data-toolcraft-control-target="source.artwork"] input[type="file"]').setInputFiles(svgFile);
  await waitForNewFrame(canvas, before);
  await settledSignature(canvas);
  await proveProductChange(page, session, "source.artChannel", channelVisibleId, async (control, currentPage) => {
    await control.getByRole("combobox").click();
    await currentPage.getByRole("option", { name: "Inverted luminance", exact: true }).click();
  });
  await proveProductChange(page, session, "source.artFit", fitVisibleId, async (control) => {
    await control.getByRole("slider").press("End");
  });
});

test("browser acceptance: BLEED source media", async ({ page }) => {
  const { canvas, session } = await openProofSession(page);
  const fontFile = {
    buffer: readFileSync(join(process.cwd(), "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")),
    mimeType: "font/woff2",
    name: "inter-latin.woff2",
  };
  const fontFileObservation = session.observe((root) => {
    const names = [...root.querySelectorAll('[data-toolcraft-control-target="source.fontFile"] button[aria-label^="Remove "]')]
      .map((button) => (button.getAttribute("aria-label") ?? "").slice("Remove ".length));
    const source = document.querySelector<HTMLCanvasElement>('canvas[data-bleed-product=""]');
    const small = document.createElement("canvas");
    small.width = 96;
    small.height = 64;
    const context = small.getContext("2d");
    if (!source || !context) return { itemIds: names, outputSignature: "none" };
    context.drawImage(source, 0, 0, 96, 64);
    const { data } = context.getImageData(0, 0, 96, 64);
    let hash = 2_166_136_261;
    for (let index = 0; index < data.length; index += 1) hash = Math.imul(hash ^ (data[index] ?? 0), 16_777_619) >>> 0;
    return { itemIds: names, outputSignature: `${source.width}x${source.height}:${hash}` };
  });
  const artworkObservation = session.observe((root) => {
    const names = [...root.querySelectorAll('[data-toolcraft-control-target="source.artwork"] button[aria-label^="Remove "]')]
      .map((button) => (button.getAttribute("aria-label") ?? "").slice("Remove ".length));
    const source = document.querySelector<HTMLCanvasElement>('canvas[data-bleed-product=""]');
    const small = document.createElement("canvas");
    small.width = 96;
    small.height = 64;
    const context = small.getContext("2d");
    if (!source || !context) return { itemIds: names, outputSignature: "none" };
    context.drawImage(source, 0, 0, 96, 64);
    const { data } = context.getImageData(0, 0, 96, 64);
    let hash = 2_166_136_261;
    for (let index = 0; index < data.length; index += 1) hash = Math.imul(hash ^ (data[index] ?? 0), 16_777_619) >>> 0;
    return { itemIds: names, outputSignature: `${source.width}x${source.height}:${hash}` };
  });
  /** Upload once to learn the deterministic output, remove it, then prove the upload reaches exactly that output again. */
  const proveUpload = async (
    target: string,
    requirementId: string,
    file: { buffer: Buffer; mimeType: string; name: string },
    observation: typeof fontFileObservation,
  ) => {
    const field = page.locator(`[data-toolcraft-control-target="${target}"]`);
    const upload = async (input: Locator) => {
      const start = await frames(canvas);
      await input.setInputFiles(file);
      await waitForNewFrame(canvas, start);
      await settledSignature(canvas);
    };
    await upload(field.locator('input[type="file"]'));
    const expected = { itemIds: [file.name], outputSignature: await settledSignature(canvas) };
    await field.getByRole("button", { name: `Remove ${file.name}` }).click();
    await expect(field.getByRole("button", { name: `Remove ${file.name}` })).toHaveCount(0);
    await settledSignature(canvas);
    await expectToolcraftMediaLifecycle(
      observation,
      session.controlAction(target, (control) => upload(control.locator('input[type="file"]'))),
      expected,
      { requirementId, stabilityIntervalMs: 0, stabilitySamples: 2, timeoutMs: 20_000 },
    );
  };
  const fontFileId = await proveApplicability(session, "source.fontFile", "text");
  await proveUpload("source.fontFile", fontFileId, fontFile, fontFileObservation);
  const artworkId = await proveApplicability(session, "source.artwork", "artwork");
  await proveUpload("source.artwork", artworkId, svgFile, artworkObservation);
});
