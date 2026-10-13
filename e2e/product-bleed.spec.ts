import { type Download, type Locator } from "@playwright/test";
import { appControlSectionInventory, getToolcraftControlApplicabilityCases, getToolcraftApplicabilityRequirementId } from "../src/app/app-acceptance";
import { appSchema } from "../src/app/app-schema";
import { expectToolcraftControlApplicabilityState } from "./browser-control-applicability-evidence";
import { expectToolcraftExportedArtifact } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftBackgroundOutputSemantics, expectToolcraftFiniteBackgroundMediaStacking } from "./browser-background-output-evidence";
import { expectToolcraftInfinityCanvasBackgroundEvidence, expectToolcraftInfinityCanvasImageExportEvidence, expectToolcraftInfinityCanvasModeEvidence, observeInfinityCanvas, observeInfinityCanvasBackground } from "./browser-infinity-canvas-evidence";
import { expectToolcraftImageExportArtifact } from "./browser-media-export-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftDiscreteSliderMarkers } from "./performance-control-layout-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expectToolcraftViewportSideEffect } from "./browser-state-evidence-helpers";
import { expect, expectToolcraftCanvasRenderScaleEvidence, test } from "./toolcraft-product-test";
import {
  canvasSelector,
  quickStability,
  proveProductChange,
  openProofSession,
  proveSliders,
  openBleed,
  frames,
  waitForNewFrame,
  settle,
  acceptanceId,
  settledSignature,
  blackRgba,
  default2kExport,
  chooseOption,
  clickExport,
  switchTo,
  panViewport,
  observeViewport,
  outputSize,
} from "./product-bleed-helpers";

test("browser acceptance: BLEED inflate", async ({ page }) => {
  const { session } = await openProofSession(page);
  await proveSliders(page, session, [
    "inflate.core", "inflate.dome", "inflate.edge", "inflate.emboss",
    "inflate.embossSoftness", "inflate.amount", "inflate.threshold",
  ]);
});

test("browser acceptance: BLEED shading", async ({ page }) => {
  const { session } = await openProofSession(page);
  await proveSliders(page, session, [
    "shading.lightAngle", "shading.light", "shading.normal", "shading.rim",
    "shading.warp", "shading.warpScale", "shading.ambient",
  ]);
  await proveProductChange(page, session, "shading.invert", "bleed.shading.invert", async (control) => {
    await control.getByRole("switch").click();
  });
});

test("browser acceptance: BLEED grain", async ({ page }) => {
  const { session } = await openProofSession(page);
  await proveSliders(page, session, ["grain.amount", "grain.scale", "grain.bias", "grain.dither", "grain.seed"]);
  await proveProductChange(page, session, "grain.mode", "bleed.grain.mode", async (control, currentPage) => {
    await control.getByRole("combobox").click();
    await currentPage.getByRole("option", { name: "Bayer 8×8" }).click();
  });
  await proveProductChange(page, session, "grain.actions", "bleed.grain.actions", async (control) => {
    await control.getByRole("button", { name: "New seed" }).click();
  });
});

test("browser acceptance: BLEED dissolve", async ({ page }) => {
  const { session } = await openProofSession(page);
  await proveSliders(page, session, ["dissolve.amount", "dissolve.angle", "dissolve.softness"]);
});

test("browser acceptance: BLEED presets", async ({ page }) => {
  const { canvas, session } = await openProofSession(page);
  const list = page.locator('[data-toolcraft-control-target="presets.library"]');
  await expect(list).not.toContainText("{");
  const razor = list.getByRole("button", { name: "Razor", exact: true });
  await proveProductChange(page, session, "presets.library", "bleed.presets.library", async () => {
    await razor.click();
    await expect(razor).toHaveAttribute("aria-pressed", "true");
  });
  await expect(list.getByTitle("Edited since loading")).toHaveCount(0);
  const before = await frames(canvas);
  await (await getToolcraftControlFieldByTarget(page, "dissolve.angle")).getByRole("slider").press("PageUp");
  await waitForNewFrame(canvas, before);
  await settle(canvas);
  await expect(list.getByTitle("Edited since loading")).toBeVisible();

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("presets.actions", async (control) => {
      await control.getByRole("button", { name: "Save current" }).click();
      await expect(list.getByRole("button", { name: "My look", exact: true })).toHaveAttribute("aria-pressed", "true");
    }),
    { requirementId: "bleed.presets.actions", selector: '[data-bleed-preset-list=""]', timeoutMs: 10_000, ...quickStability },
  );
  await list.getByRole("button", { name: "Rename My look" }).click();
  const field = list.getByRole("textbox", { name: "Rename My look" });
  await field.fill("Wet ink");
  await field.press("Enter");
  await expect(list.getByRole("button", { name: "Wet ink", exact: true })).toBeVisible();
  await list.getByRole("button", { name: "Overwrite Wet ink with current settings" }).click();
  await list.getByRole("button", { name: "Delete Wet ink" }).click();
  await expect(list.getByRole("button", { name: "Wet ink", exact: true })).toHaveCount(0);
  await list.getByRole("button", { name: "Delete Razor" }).click();
  await expect(razor).toHaveCount(0);
  await page.getByRole("button", { name: "Restore factory" }).click();
  await expect(razor).toBeVisible();
});

test("browser acceptance: BLEED background", async ({ page }) => {
  const { canvas, session } = await openProofSession(page);
  await chooseOption(page, "export.image.resolution", "2K");
  const include = page.locator('[data-toolcraft-control-target="export.includeBackground"]');
  const infinity = page.locator('[data-toolcraft-control-target="canvas.infinity"]');
  const inspectPng = (download: Download, backgroundRgba: readonly [number, number, number, number]) =>
    inspectToolcraftImageDownload({ backgroundRgba, download, page });

  // Infinity viewport adopts the runtime background colour and drops it when excluded.
  await switchTo(infinity, true);
  await settle(canvas);
  const infinite = await observeInfinityCanvasBackground(page);
  await switchTo(include, false);
  await expect.poll(async () => (await observeInfinityCanvasBackground(page)).backgroundEnabled).toBe(false);
  const backgroundExcluded = await observeInfinityCanvasBackground(page);
  await switchTo(include, true);
  await expect.poll(async () => (await observeInfinityCanvasBackground(page)).backgroundEnabled).toBe(true);
  const backgroundRestored = await observeInfinityCanvasBackground(page);
  await expectToolcraftInfinityCanvasBackgroundEvidence(
    { backgroundExcluded, backgroundRestored, infinite },
    { expectedBackgroundColor: "#000000", requirementId: "bleed.export.includeBackground", target: "export.includeBackground" },
  );
  await switchTo(infinity, false);
  const productSignature = await settledSignature(canvas);

  // Finite preview: the runtime background layer sits under a transparent BLEED foreground.
  const observeStacking = session.observe(() => {
    const layer = document.querySelector<HTMLElement>("[data-toolcraft-finite-background-layer]");
    const scene = document.querySelector<HTMLElement>("[data-toolcraft-product-scene]");
    const source = document.querySelector<HTMLCanvasElement>('canvas[data-bleed-product=""]');
    const small = document.createElement("canvas");
    small.width = 96;
    small.height = 64;
    const context = small.getContext("2d");
    let hash = 2_166_136_261;
    if (source && context) {
      context.drawImage(source, 0, 0, 96, 64);
      const { data } = context.getImageData(0, 0, 96, 64);
      for (let index = 0; index < data.length; index += 1) hash = Math.imul(hash ^ (data[index] ?? 0), 16_777_619) >>> 0;
    }
    const layers = [layer ? { element: layer, name: "background" } : null, scene ? { element: scene, name: "product" } : null]
      .filter((entry): entry is { element: HTMLElement; name: string } => entry !== null)
      .sort((left, right) => (left.element.compareDocumentPosition(right.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const backgroundColor = layer ? getComputedStyle(layer).backgroundColor : "";
    return {
      backgroundColor,
      backgroundVisible: layer !== null && layer.getBoundingClientRect().width > 0,
      canvasMode: (document.querySelector("[data-toolcraft-canvas-mode]")?.getAttribute("data-toolcraft-canvas-mode") === "infinite" ? "infinite" : "finite") as "finite" | "infinite",
      layerOrder: layers.map((entry) => entry.name),
      mediaVisible: false,
      outputSignature: `${backgroundColor || "none"}|${source ? `${source.width}x${source.height}` : "0x0"}:${hash}`,
      productForegroundTransparent: source !== null && getComputedStyle(source).backgroundColor === "rgba(0, 0, 0, 0)",
    };
  });
  const observePreview = session.observe(() => {
    const layer = document.querySelector<HTMLElement>("[data-toolcraft-finite-background-layer]");
    const source = document.querySelector<HTMLCanvasElement>('canvas[data-bleed-product=""]');
    const small = document.createElement("canvas");
    small.width = 96;
    small.height = 64;
    const context = small.getContext("2d");
    let hash = 2_166_136_261;
    if (source && context) {
      context.drawImage(source, 0, 0, 96, 64);
      const { data } = context.getImageData(0, 0, 96, 64);
      for (let index = 0; index < data.length; index += 1) hash = Math.imul(hash ^ (data[index] ?? 0), 16_777_619) >>> 0;
    }
    const backgroundColor = layer ? getComputedStyle(layer).backgroundColor : "";
    return {
      backgroundVisible: layer !== null,
      outputSignature: `${backgroundColor || "none"}|${source ? `${source.width}x${source.height}` : "0x0"}:${hash}`,
    };
  });
  const setInclude = (on: boolean) => session.controlAction("export.includeBackground", (control) => switchTo(control, on));
  await expectToolcraftBackgroundOutputSemantics(
    observePreview,
    setInclude(false),
    { backgroundVisible: false, outputSignature: `none|${productSignature}` },
    session.action((currentPage) => clickExport(currentPage)),
    async (download) => {
      const inspected = await inspectPng(download, [0, 0, 0, 0]);
      return { ...inspected.inspection, backgroundAlpha: inspected.observation.normalizedPixels[3] ?? -1 };
    },
    { requirementId: "bleed.export.includeBackground", stabilityIntervalMs: 0, stabilitySamples: 2, timeoutMs: 10_000 },
  );
  await expectToolcraftFiniteBackgroundMediaStacking(
    observeStacking,
    setInclude(true),
    {
      backgroundColor: "rgb(0, 0, 0)",
      backgroundVisible: true,
      canvasMode: "finite",
      layerOrder: ["background", "product"],
      mediaVisible: false,
      outputSignature: `rgb(0, 0, 0)|${productSignature}`,
      productForegroundTransparent: true,
    },
    { requirementId: "bleed.export.includeBackground", stabilityIntervalMs: 0, stabilitySamples: 2, timeoutMs: 10_000 },
  );

  // The background colour stays editable either way; included it fills the export, excluded the export stays transparent.
  const backgroundId = acceptanceId("bleed.appearance.background");
  const cases = [...getToolcraftControlApplicabilityCases({ schema: appSchema, sectionInventory: appControlSectionInventory, target: "appearance.background" })]
    .sort((left, right) => Number(left.selectorValue === true) - Number(right.selectorValue === true));
  for (const applicabilityCase of cases) {
    const included = applicabilityCase.selectorValue === true;
    await expectToolcraftControlApplicabilityState(session, setInclude(included), applicabilityCase, { baseRequirementId: backgroundId });
    await expectToolcraftExportedArtifact(
      session.controlAction("appearance.background", async (control, currentPage) => {
        if (included) {
          const hex = control.getByRole("textbox").first();
          await hex.fill("#203040");
          await hex.press("Enter");
          await expect(currentPage.locator("[data-toolcraft-finite-background-layer]")).toHaveCSS("background-color", "rgb(32, 48, 64)");
        }
        return clickExport(currentPage);
      }),
      async (download) => {
        const inspected = await inspectPng(download, included ? [32, 48, 64, 255] : [0, 0, 0, 0]);
        expect([...inspected.observation.normalizedPixels.subarray(0, 4)]).toEqual(included ? [32, 48, 64, 255] : [0, 0, 0, 0]);
        return inspected.inspection;
      },
      { requirementId: getToolcraftApplicabilityRequirementId(backgroundId, applicabilityCase) },
    );
  }
});

test("browser acceptance: BLEED export", async ({ page }) => {
  const { session } = await openProofSession(page);
  const resolution = await getToolcraftControlFieldByTarget(page, "export.image.resolution");
  await resolution.getByRole("combobox").click();
  for (const label of ["2K", "4K", "8K"]) await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("export.image.format", async (control, currentPage) => {
      await control.getByRole("combobox").click();
      await currentPage.getByRole("option", { name: "JPG", exact: true }).click();
      await expect(currentPage.getByRole("button", { name: "Export JPG" })).toBeVisible();
    }),
    { requirementId: "bleed.export.image.format", selector: '[data-toolcraft-control-target="actions.output"] button', timeoutMs: 10_000, ...quickStability },
  );
  await chooseOption(page, "export.image.format", "PNG");
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("export.image.resolution", async (control, currentPage) => {
      await control.getByRole("combobox").click();
      await currentPage.getByRole("option", { name: "2K", exact: true }).click();
    }),
    { requirementId: "bleed.export.image.resolution", selector: '[data-toolcraft-control-target="export.image.resolution"] [role="combobox"]', timeoutMs: 10_000, ...quickStability },
  );
  await expectToolcraftImageExportArtifact(session.targetAction("actions.output", (currentPage) => clickExport(currentPage)), {
    backgroundRgba: blackRgba,
    expectedBounds: default2kExport.bounds,
    expectedHeight: default2kExport.height,
    expectedMediaType: "image/png",
    expectedPixels: default2kExport.pixels,
    expectedWidth: default2kExport.width,
    page,
    requirementId: "bleed.actions.output",
  });
});

test("browser acceptance: BLEED render scale", async ({ page }) => {
  await openBleed(page);
  const control = (await getToolcraftControlFieldByTarget(page, "canvas.renderScale")).getByRole("slider");
  await expectToolcraftDiscreteSliderMarkers(page, "canvas.renderScale", "bleed.render-scale");
  await expectToolcraftCanvasRenderScaleEvidence(page, {
    canvasSelector,
    requirementId: "bleed.render-scale",
    selectedScale: 2,
    stateTransitions: [
      { run: async () => { await control.press("End"); await settle(page.locator(canvasSelector)); }, state: "interaction" },
      { run: async () => { await settle(page.locator(canvasSelector)); }, state: "steady" },
    ],
    target: "canvas.renderScale",
  });
  await control.press("Home");
  await expect
    .poll(() => page.locator(canvasSelector).evaluate((node) => (node as HTMLCanvasElement).width / (node as HTMLCanvasElement).clientWidth))
    .toBeCloseTo(1, 1);
});

test("browser acceptance: BLEED Infinity canvas", async ({ page }) => {
  const canvas = await openBleed(page);
  const infinity = page.locator('[data-toolcraft-control-target="canvas.infinity"]');
  const backing = () => canvas.getAttribute("data-bleed-backing");
  const continuity = async (
    host: Awaited<ReturnType<Locator["elementHandle"]>>,
    backingBefore: string | null,
  ) => ({
    productHostPreserved: await canvas.evaluate((node, initial) => node === initial, host),
    productOutputPreserved: (await backing()) === backingBefore && !(await canvas.getAttribute("data-bleed-failure")),
  });
  const observeAfter = async (mode: "finite" | "infinite") => {
    await expect.poll(async () => (await observeInfinityCanvas(page)).canvasMode).toBe(mode);
    await settle(canvas);
    return observeInfinityCanvas(page);
  };

  const before = await observeInfinityCanvas(page);
  let host = await canvas.elementHandle();
  let backingBefore = await backing();
  await switchTo(infinity, true);
  const enabled = await observeAfter("infinite");
  const beforeToEnabled = await continuity(host, backingBefore);
  await panViewport(page);
  await expect.poll(async () => (await observeInfinityCanvas(page)).viewport.offsetX).not.toBe(enabled.viewport.offsetX);
  const afterPan = await observeAfter("infinite");

  await page.reload();
  await openBleed(page, { navigate: false });
  const afterReload = await observeAfter("infinite");
  host = await canvas.elementHandle();
  backingBefore = await backing();
  await switchTo(infinity, false);
  const restored = await observeAfter("finite");
  const afterReloadToRestored = await continuity(host, backingBefore);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = await observeAfter("infinite");
  const restoredToUndone = await continuity(host, backingBefore);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const redone = await observeAfter("finite");
  const undoneToRedone = await continuity(host, backingBefore);

  await expectToolcraftInfinityCanvasModeEvidence(
    { afterPan, afterReload, before, enabled, redone, restored, undone },
    { afterReloadToRestored, beforeToEnabled, restoredToUndone, undoneToRedone },
    { expectedSceneRect: { height: 800, width: 1200, x: -600, y: -400 }, requirementId: "bleed.infinity-mode", target: "canvas.infinity" },
  );
});

test("browser acceptance: BLEED Infinity export", async ({ page }) => {
  await openBleed(page);
  await chooseOption(page, "export.image.resolution", "2K");
  const finite = await inspectToolcraftImageDownload({ backgroundRgba: blackRgba, download: await clickExport(page), page });
  await switchTo(page.locator('[data-toolcraft-control-target="canvas.infinity"]'), true);
  const infinite = await inspectToolcraftImageDownload({ backgroundRgba: blackRgba, download: await clickExport(page), page });
  await expectToolcraftInfinityCanvasImageExportEvidence(
    { finite: finite.inspection, infinite: infinite.inspection },
    { expectedSize: { height: default2kExport.height, width: default2kExport.width }, requirementId: "bleed.infinity-export", target: "canvas.infinity" },
  );
});

test("browser acceptance: BLEED viewport pan", async ({ page }) => {
  const { canvas, session } = await openProofSession(page);
  await expectToolcraftViewportSideEffect(
    observeViewport(session),
    session.targetAction("canvas.setOffset", (currentPage) => panViewport(currentPage)),
    { offsetX: 40, offsetY: 24, zoom: 100, ...(await outputSize(canvas)) },
    { requirementId: "bleed.viewport", stabilityIntervalMs: 0, stabilitySamples: 2, timeoutMs: 10_000 },
  );
  await expect(canvas).not.toHaveAttribute("data-bleed-failure", /.+/u);
});

test("browser acceptance: BLEED viewport zoom", async ({ page }) => {
  const { canvas, session } = await openProofSession(page);
  await expectToolcraftViewportSideEffect(
    observeViewport(session),
    session.targetAction("canvas.setViewport", async (currentPage) => {
      await currentPage.getByRole("button", { name: "Zoom in" }).click();
    }),
    { offsetX: 0, offsetY: 0, zoom: 110, ...(await outputSize(canvas)) },
    { requirementId: "bleed.viewport-zoom", stabilityIntervalMs: 0, stabilitySamples: 2, timeoutMs: 10_000 },
  );
  await expect(canvas).not.toHaveAttribute("data-bleed-failure", /.+/u);
});
