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
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright-core");
const { JSDOM } = require("jsdom");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");

function findChromium() {
  const base = path.join(os.homedir(), ".cache", "ms-playwright");
  if (!fs.existsSync(base)) return null;
  return fs.readdirSync(base)
    .filter((name) => name.startsWith("chromium-") && !name.includes("headless"))
    .sort().reverse()
    .map((name) => path.join(base, name, "chrome-linux64", "chrome"))
    .find((candidate) => fs.existsSync(candidate)) || null;
}

function fixturePage() {
  return `<!doctype html><html><body>
    <h1>Private fixture</h1>
    <iframe title="diagram one" src="https://viewscreen.githubusercontent.com/one"></iframe>
    <iframe title="diagram two" src="https://viewscreen.githubusercontent.com/two"></iframe>
  </body></html>`;
}

function viewscreenPage(delayed) {
  const svg = `<div class="mermaid"><svg viewBox="0 0 120 50" style="display:block;width:240px;height:120px;margin:0 175px;color:rgb(201,209,217)">
    <rect x="10" y="10" width="80" height="30" fill="rgb(31,111,235)"/>
    <foreignObject x="12" y="14" width="76" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="width:96px;white-space:nowrap;color:rgb(201,209,217);font:8px sans-serif">GitHub native fixture right-edge overflow<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg></div></foreignObject>
  </svg></div>`;
  return `<!doctype html><html data-color-mode="dark"><body style="margin:0;background:rgb(13,17,23)">
    ${delayed ? `<script>setTimeout(() => document.body.insertAdjacentHTML("beforeend", ${JSON.stringify(svg)}), 400)</script>` : svg}
  </body></html>`;
}

async function waitForDownloads(worker, count) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const items = await worker.evaluate(async () => chrome.downloads.search({}));
    if (items.length >= count && items.slice(0, count).every((item) => item.state === "complete")) return items;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${count} completed downloads`);
}

async function main() {
  const executablePath = findChromium();
  if (!executablePath) {
    console.log("SKIP: compatible cached Chromium was not found");
    return;
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gme-chromium-"));
  const key = path.join(temp, "key.pem");
  const cert = path.join(temp, "cert.pem");
  const generated = spawnSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=github.com",
    "-addext", "subjectAltName=DNS:github.com,DNS:viewscreen.githubusercontent.com",
    "-keyout", key, "-out", cert
  ], { encoding: "utf8" });
  if (generated.status !== 0) throw new Error(generated.stderr || "Could not create fixture certificate");

  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (request, response) => {
    const host = String(request.headers.host || "").split(":")[0];
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (host === "github.com") response.end(fixturePage());
    else if (host === "viewscreen.githubusercontent.com") response.end(viewscreenPage(request.url.includes("two")));
    else { response.statusCode = 404; response.end("not found"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(temp, "profile"), {
      executablePath,
      headless: true,
      acceptDownloads: true,
      downloadsPath: path.join(temp, "downloads"),
      ignoreHTTPSErrors: true,
      args: [
        `--disable-extensions-except=${root}`,
        `--load-extension=${root}`,
        `--host-resolver-rules=MAP github.com:443 127.0.0.1:${port},MAP viewscreen.githubusercontent.com:443 127.0.0.1:${port}`,
        "--no-proxy-server",
        "--no-sandbox"
      ]
    });
    const page = await context.newPage();
    await page.goto("https://github.com/acme/private-repo/blob/main/docs/Architecture.md");
    const frames = page.frames().filter((frame) => frame.url().startsWith("https://viewscreen.githubusercontent.com/"));
    await page.waitForFunction(() => document.querySelectorAll("iframe").length === 2);
    const first = page.frame({ url: /viewscreen\.githubusercontent\.com\/one/ });
    const second = page.frame({ url: /viewscreen\.githubusercontent\.com\/two/ });
    assert.ok(first && second);
    assert.equal(frames.length, 2);
    await first.locator(".gme-toolbar").waitFor();
    await second.locator(".gme-toolbar").waitFor();
    const svgBounds = await first.locator(".mermaid > svg").boundingBox();
    const toolbarBounds = await first.locator(".gme-toolbar").boundingBox();
    assert.ok(toolbarBounds.x >= svgBounds.x && toolbarBounds.x <= svgBounds.x + 12, "toolbar should be at the upper-left");

    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await first.getByRole("button", { name: "SVG" }).click();
    let downloads = await waitForDownloads(worker, 1);
    await first.locator(".gme-toast").waitFor({ state: "visible" });
    assert.match(await first.locator(".gme-toast").textContent(), /private-repo-Architecture-diagram-01\.svg/);

    await second.getByRole("button", { name: "SVG" }).click();
    downloads = await waitForDownloads(worker, 2);
    assert.match(await second.locator(".gme-toast").textContent(), /private-repo-Architecture-diagram-02\.svg/);

    await first.getByLabel("PNG scale").selectOption("auto");
    await first.getByRole("button", { name: "PNG", exact: true }).click();
    downloads = await waitForDownloads(worker, 3);
    assert.match(await first.locator(".gme-toast").textContent(), /private-repo-Architecture-diagram-01\.png/);
    const firstThree = downloads.slice(0, 3).map((item) => fs.readFileSync(item.filename));
    const png = firstThree.find((data) => data.subarray(1, 4).toString("ascii") === "PNG");
    assert.ok(png, "a parseable PNG download should exist");
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1440);
    assert.equal(png.readUInt32BE(20), 600, "GitHub viewBox aspect ratio should remove bottom whitespace without clipping branches");
    const decodedPng = PNG.sync.read(png);
    assert.deepEqual([...decodedPng.data.subarray(0, 4)], [13, 17, 23, 255]);
    const centerOffset = (300 * decodedPng.width + 600) * 4;
    assert.deepEqual(
      [...decodedPng.data.subarray(centerOffset, centerOffset + 4)],
      [31, 111, 235, 255],
      "GitHub page margins must not shift PNG content or clip its right edge"
    );
    for (let y = 0; y < decodedPng.height; y += Math.max(1, Math.floor(decodedPng.height / 20))) {
      const offset = (y * decodedPng.width + decodedPng.width - 1) * 4;
      assert.deepEqual([...decodedPng.data.subarray(offset, offset + 4)], [13, 17, 23, 255]);
    }

    const picker = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return chrome.tabs.sendMessage(tab.id, { type: "gme:open-picker" });
    });
    assert.deepEqual(picker, { ok: true, count: 2 });
    await page.locator("[data-gme-picker]").waitFor();
    assert.equal((await worker.evaluate(async () => chrome.downloads.search({}))).length, 3, "opening the picker must not download");
    const pickerRows = page.locator(".gme-picker-row");
    assert.equal(await pickerRows.count(), 2);
    await pickerRows.nth(1).locator("select").selectOption("png:auto");
    await page.getByRole("button", { name: "Export selected" }).click();
    downloads = await waitForDownloads(worker, 5);
    const svgTexts = downloads
      .map((item) => fs.readFileSync(item.filename))
      .filter((data) => data.subarray(0, 5).toString("utf8") === "<?xml")
      .map((data) => data.toString("utf8"));
    assert.equal(svgTexts.length, 3);
    for (const text of svgTexts) {
      const parsed = new JSDOM(text, { contentType: "image/svg+xml" });
      assert.equal(parsed.window.document.documentElement.localName, "svg");
      assert.match(text, /GitHub native fixture/);
      assert.equal(text.includes("gme-toolbar"), false);
      assert.equal(text.includes("PNG 2×"), false);
    }
    const pngBuffers = downloads
      .map((item) => fs.readFileSync(item.filename))
      .filter((data) => data.subarray(1, 4).toString("ascii") === "PNG");
    assert.equal(pngBuffers.length, 2);
    console.log("Chromium MV3 integration: foreignObject PNG, upper-left controls, picker, mixed formats, reparsing, and UI exclusion passed");
  } finally {
    if (context) await context.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
