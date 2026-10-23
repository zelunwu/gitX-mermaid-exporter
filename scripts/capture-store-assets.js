/*
 * Copyright (c) 2026 Zelun Wu
 * SPDX-License-Identifier: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "docs", "chrome-web-store");
const repositoryUrl = "https://github.com/zelunwu/gitX-mermaid-exporter#live-demo";

function findChromium() {
  const base = path.join(os.homedir(), ".cache", "ms-playwright");
  if (!fs.existsSync(base)) return null;
  return fs.readdirSync(base)
    .filter((name) => name.startsWith("chromium-") && !name.includes("headless"))
    .sort()
    .reverse()
    .map((name) => path.join(base, name, "chrome-linux64", "chrome"))
    .find((candidate) => fs.existsSync(candidate)) || null;
}

function verifyPng(file, width, height) {
  const png = PNG.sync.read(fs.readFileSync(file));
  assert.equal(png.width, width, `${path.basename(file)} width`);
  assert.equal(png.height, height, `${path.basename(file)} height`);
}

async function waitForExporterToolbar(page) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (!frame.url().startsWith("https://viewscreen.githubusercontent.com/")) continue;
      if (await frame.locator(".gme-toolbar").count()) return frame;
    }
    await page.waitForTimeout(250);
  }
  throw new Error("The live GitHub Viewscreen diagram did not expose the extension toolbar");
}

async function captureScreenshot(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(repositoryUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  const heading = page.locator("#user-content-live-demo");
  await heading.waitFor({ state: "visible", timeout: 60000 });
  const frame = await waitForExporterToolbar(page);
  await frame.locator(".gme-toolbar").waitFor({ state: "visible" });
  await heading.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: "instant" });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(outputDirectory, "screenshot-1280x800.png"),
    animations: "disabled"
  });
  await page.close();
}

async function capturePromo(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 280 });
  const icon = fs.readFileSync(path.join(root, "icons", "icon-128.png")).toString("base64");
  await page.setContent(`<!doctype html>
    <html><head><style>
      * { box-sizing: border-box; }
      html, body { width: 440px; height: 280px; margin: 0; overflow: hidden; }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        font-family: "DejaVu Sans", Arial, sans-serif;
      }
      main { display: flex; align-items: center; gap: 24px; width: 376px; }
      .icon { width: 128px; height: 128px; border-radius: 24px; box-shadow: 0 14px 32px #24175c66; }
      .copy { min-width: 0; }
      h1 { margin: 0 0 10px; font-size: 32px; line-height: 1.05; letter-spacing: -1px; }
      p { margin: 0; color: #ede9fe; font-size: 17px; line-height: 1.35; }
    </style></head><body><main>
      <img class="icon" src="data:image/png;base64,${icon}" alt="">
      <div class="copy"><h1>gitX Mermaid Exporter</h1><p>GitHub-rendered SVG &amp; PNG exports</p></div>
    </main></body></html>`);
  await page.screenshot({
    path: path.join(outputDirectory, "promo-440x280.png"),
    animations: "disabled"
  });
  await page.close();
}

async function main() {
  const executablePath = findChromium();
  if (!executablePath) throw new Error("A compatible Playwright Chromium installation is required");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gitx-store-assets-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: true,
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${root}`,
        `--load-extension=${root}`,
        "--no-sandbox"
      ]
    });
    await captureScreenshot(context);
    await capturePromo(context);
  } finally {
    if (context) await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  verifyPng(path.join(outputDirectory, "screenshot-1280x800.png"), 1280, 800);
  verifyPng(path.join(outputDirectory, "promo-440x280.png"), 440, 280);
  console.log(`Chrome Web Store assets written to ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
