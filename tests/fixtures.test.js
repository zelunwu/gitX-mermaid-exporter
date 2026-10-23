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

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const domApi = require("../lib/dom.js");
const pageApi = require("../lib/page.js");
const pngApi = require("../lib/png.js");

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("Viewscreen monitor detects delayed SVG and multiple diagrams", async () => {
  const fixture = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://viewscreen.githubusercontent.com/renderer"
  });
  const counts = [];
  const monitor = domApi.createDiagramMonitor(fixture.window.document, (diagrams) => counts.push(diagrams.length));
  await tick();
  const first = fixture.window.document.createElement("div");
  first.className = "mermaid";
  first.innerHTML = '<svg viewBox="0 0 100 50"><foreignObject><svg viewBox="0 0 10 10"></svg></foreignObject></svg>';
  fixture.window.document.body.append(first);
  await tick();
  assert.equal(domApi.findDiagrams(fixture.window.document).length, 1, "nested SVGs are not separate diagrams");
  const second = first.cloneNode(true);
  fixture.window.document.body.append(second);
  await tick();
  assert.equal(domApi.findDiagrams(fixture.window.document).length, 2);
  assert.ok(counts.includes(0));
  assert.ok(counts.includes(1));
  assert.equal(counts.at(-1), 2);
  monitor.stop();
});

test("light and dark Viewscreen fixtures produce the visible background", () => {
  const light = new JSDOM('<html data-color-mode="light"><body style="background-color: rgb(255, 255, 255)"><svg></svg></body></html>');
  const dark = new JSDOM('<html data-color-mode="dark"><body style="background-color: rgb(13, 17, 23)"><svg></svg></body></html>');
  assert.equal(pngApi.backgroundFor(light.window.document.querySelector("svg")), "rgb(255, 255, 255)");
  assert.equal(pngApi.backgroundFor(dark.window.document.querySelector("svg")), "rgb(13, 17, 23)");
  assert.deepEqual(pngApi.dimensions(100.2, 50.2, 2), {
    logicalWidth: 100.2, logicalHeight: 50.2, pixelWidth: 201, pixelHeight: 101
  });
});

test("adaptive PNG planning removes long-diagram whitespace and chooses a safe readable scale", () => {
  const plan = pngApi.rasterPlan({
    width: 900,
    height: 20000,
    viewBox: { x: 0, y: 0, width: 100, height: 400 },
    contentBox: { x: 0, y: 0, width: 40, height: 400 },
    scale: "auto"
  });
  assert.equal(plan.logicalWidth, 900);
  assert.equal(plan.logicalHeight, 3600);
  assert.equal(plan.scale, 4);
  assert.equal(plan.pixelWidth, 3600);
  assert.equal(plan.pixelHeight, 14400);
  assert.deepEqual(plan.cropBox, { x: 0, y: 0, width: 100, height: 400 });
  assert.throws(() => pngApi.rasterPlan({
    width: 2000, height: 8000, scale: 4
  }), /choose 2× or lower/);
});

test("pgir geometry produces the exact GitHub viewBox dimensions", () => {
  const plan = pngApi.rasterPlan({
    width: 488,
    height: 1536,
    viewBox: { x: -36, y: -36, width: 488, height: 1536 },
    contentBox: { x: 12, y: 12, width: 392, height: 1440 },
    scale: "auto"
  });
  assert.equal(plan.scale, 6);
  assert.equal(plan.logicalWidth, 488);
  assert.equal(plan.logicalHeight, 1536);
  assert.equal(plan.pixelWidth, 2928);
  assert.equal(plan.pixelHeight, 9216);
});

test("GitHub SPA navigation and iframe reload fixtures are rediscovered", async () => {
  const fixture = new JSDOM(`<!doctype html><html><body>
    <iframe src="https://viewscreen.githubusercontent.com/one"></iframe>
  </body></html>`, { url: "https://github.com/acme/repo/blob/main/one.md" });
  const snapshots = [];
  const monitor = pageApi.createFrameMonitor(fixture.window.document, (frames) => snapshots.push(frames.map((f) => f.src)));
  await tick();
  fixture.window.history.pushState({}, "", "/acme/repo/blob/main/two.md");
  const oldFrame = fixture.window.document.querySelector("iframe");
  const replacement = fixture.window.document.createElement("iframe");
  replacement.src = "https://viewscreen.githubusercontent.com/two";
  oldFrame.replaceWith(replacement);
  await tick();
  assert.equal(fixture.window.location.pathname, "/acme/repo/blob/main/two.md");
  assert.deepEqual(pageApi.findViewscreenFrames(fixture.window.document).map((f) => f.src), [
    "https://viewscreen.githubusercontent.com/two"
  ]);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots.at(-1), ["https://viewscreen.githubusercontent.com/two"]);
  monitor.stop();
});
