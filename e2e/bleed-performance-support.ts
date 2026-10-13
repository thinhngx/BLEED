import { expect, type Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import type { ToolcraftCompiledFixtureApplications } from "./performance-compiled-fixture-runtime";

export const bleedCanvasSelector = 'canvas[data-bleed-product=""]';

export async function readBleedFrameCount(page: Page): Promise<number> {
  return Number(
    (await page.locator(bleedCanvasSelector).getAttribute("data-bleed-frame-count")) ?? 0,
  );
}

export async function waitForBleedFrameAfter(page: Page, before: number): Promise<void> {
  const canvas = page.locator(bleedCanvasSelector);
  await expect(canvas).not.toHaveAttribute("data-bleed-failure", /.+/u);
  await expect
    .poll(() => readBleedFrameCount(page), { timeout: 30_000 })
    .toBeGreaterThan(before);
}

export async function prepareBleedPerformance(page: Page): Promise<void> {
  await page.goto("/");
  await expect
    .poll(() => readBleedFrameCount(page), { timeout: 30_000 })
    .toBeGreaterThan(0);
}

async function setTextTarget(page: Page, target: string, value: number) {
  const input = (await getToolcraftControlFieldByTarget(page, target)).getByRole("textbox");
  await input.fill(String(value));
  await input.press("Enter");
}

async function setResolution(page: Page, value: string) {
  const trigger = (
    await getToolcraftControlFieldByTarget(page, "export.image.resolution")
  ).getByRole("combobox");
  const label = value.toUpperCase();
  if (!(await trigger.textContent())?.includes(label)) {
    await trigger.click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: label }).click();
  }
}

async function readResolution(page: Page): Promise<string> {
  const text = await (await getToolcraftControlFieldByTarget(page, "export.image.resolution"))
    .getByRole("combobox")
    .textContent();
  return text?.trim().toLowerCase() ?? "";
}

export function createBleedFixtureApplications(
  page: Page,
  dimensionIds: readonly string[],
): ToolcraftCompiledFixtureApplications {
  const available: ToolcraftCompiledFixtureApplications = {
    "export-long-edge": {
      applyValue: (value) => setResolution(page, String(value)),
      observeValue: () => readResolution(page),
    },
    "export-pixels": {
      applyValue: (value) => setResolution(page, String(value)),
      observeValue: () => readResolution(page),
    },
    "preview-pixels": {
      applyValue: async (value) => {
        const fixture = value as { canvasHeight: number; canvasWidth: number };
        await setTextTarget(page, "canvas.size.width", fixture.canvasWidth);
        await setTextTarget(page, "canvas.size.height", fixture.canvasHeight);
        await (await getToolcraftControlFieldByTarget(page, "canvas.renderScale"))
          .getByRole("slider")
          .press("End");
        await expect
          .poll(() =>
            page.locator(bleedCanvasSelector).evaluate((canvas) => ({
              height: (canvas as HTMLCanvasElement).height,
              width: (canvas as HTMLCanvasElement).width,
            })),
          )
          .toEqual({ height: fixture.canvasHeight * 2, width: fixture.canvasWidth * 2 });
      },
      observeValue: async () => {
        const size = await page.locator(bleedCanvasSelector).evaluate((canvas) => ({
          height: (canvas as HTMLCanvasElement).height,
          width: (canvas as HTMLCanvasElement).width,
        }));
        return {
          backingHeight: size.height,
          backingWidth: size.width,
          canvasHeight: size.height / 2,
          canvasWidth: size.width / 2,
          renderScale: 2,
        };
      },
    },
  };
  const selected: ToolcraftCompiledFixtureApplications = {};
  for (const id of dimensionIds) {
    const application = available[id];
    if (!application) throw new Error(`Missing BLEED fixture application for ${id}.`);
    selected[id] = application;
  }
  return selected;
}

const artworkSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#000"/></svg>';

export async function prepareBleedMediaImport(page: Page): Promise<void> {
  await prepareBleedPerformance(page);
  const field = await getToolcraftControlFieldByTarget(page, "source.mode");
  await field.getByText("Artwork", { exact: true }).click();
  await expect(page.locator('[data-toolcraft-control-target="source.artwork"]')).toBeVisible();
}

export async function importBleedArtwork(page: Page): Promise<void> {
  const before = await readBleedFrameCount(page);
  await page
    .locator('[data-toolcraft-control-target="source.artwork"] input[type="file"]')
    .setInputFiles({
      buffer: Buffer.from(artworkSvg),
      mimeType: "image/svg+xml",
      name: "bleed-artwork.svg",
    });
  await waitForBleedFrameAfter(page, before);
}

export async function performBleedPathAction(
  page: Page,
  interaction: string,
  targets: readonly string[],
): Promise<void> {
  const before = await readBleedFrameCount(page);
  if (interaction === "initial-render") {
    await page.reload();
    await expect
      .poll(() => readBleedFrameCount(page), { timeout: 30_000 })
      .toBeGreaterThan(0);
    return;
  }
  if (interaction === "media-import") {
    await importBleedArtwork(page);
    return;
  }
  if (interaction === "control-drag") {
    const target = targets.includes("inflate.amount") ? "inflate.amount" : "source.shiftX";
    await (await getToolcraftControlFieldByTarget(page, target))
      .getByRole("slider")
      .press("End");
  } else if (interaction === "control-change") {
    if (targets.includes("canvas.renderScale")) {
      await (await getToolcraftControlFieldByTarget(page, "canvas.renderScale"))
        .getByRole("slider")
        .press("Home");
    } else {
      const toggle = (await getToolcraftControlFieldByTarget(page, "shading.invert")).getByRole(
        "switch",
      );
      await toggle.click();
    }
  } else if (interaction === "viewport-drag") {
    const viewport = page.getByRole("application", { name: "Canvas viewport" });
    const box = await viewport.boundingBox();
    if (!box) throw new Error("Canvas viewport has no geometry.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await viewport.focus();
    await page.keyboard.down("Space");
    try {
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 16);
    } finally {
      await page.mouse.up();
      await page.keyboard.up("Space");
    }
    return;
  } else if (interaction === "viewport-zoom") {
    await page.getByRole("button", { name: "Zoom in" }).click();
    return;
  } else {
    throw new Error(`Unsupported BLEED performance action ${interaction}.`);
  }
  await waitForBleedFrameAfter(page, before);
}

export async function observeBleedOutcome(page: Page) {
  const canvas = page.locator(bleedCanvasSelector);
  return Object.freeze({
    backing: await canvas.getAttribute("data-bleed-backing"),
    failure: await canvas.getAttribute("data-bleed-failure"),
    frames: await canvas.getAttribute("data-bleed-frame-count"),
  });
}
